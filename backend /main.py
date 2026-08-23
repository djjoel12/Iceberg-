from fastapi import FastAPI, Query
from typing import Dict, List, Any
from scrapers.vtc_yango import YangoScraper
from scrapers.vtc_others import OtherVTCScraper

app = FastAPI(
    title="Iceberg API",
    description="Backend du comparateur universel Iceberg (VTC, E-commerce, Resto) à Abidjan",
    version="1.0.0"
)

# Initialisation des scrapers VTC
yango_scraper = YangoScraper()
others_scraper = OtherVTCScraper()

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "Bienvenue sur l'API Iceberg 🧊",
        "city": "Abidjan"
    }

@app.get("/api/vtc/compare")
async def compare_vtc(
    start_lat: float = Query(..., description="Latitude du point de départ"),
    start_lng: float = Query(..., description="Longitude du point de départ"),
    end_lat: float = Query(..., description="Latitude du point d'arrivée"),
    end_lng: float = Query(..., description="Longitude du point d'arrivée")
) -> Dict[str, Any]:
    """
    Endpoint d'estimation VTC Iceberg.
    Exemple Yopougon -> Plateau :
    /api/vtc/compare?start_lat=5.3484&start_lng=-4.0305&end_lat=5.3261&end_lng=-4.0202
    """
    # 1. Récupération des offres Yango
    yango_results = await yango_scraper.get_estimates(start_lat, start_lng, end_lat, end_lng)
    
    all_results = list(yango_results)
    
    # 2. Calcul Heetch et InDrive basé sur la distance retournée
    if yango_results and len(yango_results) > 0:
        distance_km = yango_results[0].get("distance_km", 0)
        duration_min = yango_results[0].get("duration_min", 0)
        
        other_results = await others_scraper.get_estimates(distance_km, duration_min)
        all_results.extend(other_results)
    else:
        # Fallback de secours si Yango ne répond pas
        fallback_results = await others_scraper.get_estimates(distance_km=5.0, duration_min=15.0)
        all_results.extend(fallback_results)

    # 3. Tri de toutes les offres Iceberg du moins cher au plus cher
    all_results_sorted = sorted(all_results, key=lambda x: x.get("price", 999999))

    return {
        "app": "Iceberg",
        "count": len(all_results_sorted),
        "results": all_results_sorted
    }
