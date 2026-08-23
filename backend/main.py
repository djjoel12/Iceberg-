from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uvicorn

from scrapers.vtc_yango import YangoScraper
from scrapers.vtc_others import OtherVTCScraper

app = FastAPI(
    title="Iceberg VTC Comparator",
    description="Comparateur de prix VTC à Abidjan (Yango, Heetch, InDrive)",
    version="1.0.0"
)

# Autoriser les appels depuis n'importe où (important pour le front)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

yango_scraper = YangoScraper()
other_scraper = OtherVTCScraper()

@app.get("/")
async def root():
    return {
        "message": "Iceberg API is running",
        "endpoint": "/api/vtc/compare",
        "example": "/api/vtc/compare?start_lat=5.3555&start_lng=-4.0744&end_lat=5.4807&end_lng=-4.0746"
    }

@app.get("/api/vtc/compare")
async def compare_vtc(
    start_lat: float = Query(..., description="Latitude de départ"),
    start_lng: float = Query(..., description="Longitude de départ"),
    end_lat: float = Query(..., description="Latitude d'arrivée"),
    end_lng: float = Query(..., description="Longitude d'arrivée")
):
    try:
        # 1. Récupérer les estimations Yango
        yango_results = await yango_scraper.get_estimates(
            start_lat, start_lng, end_lat, end_lng
        )

        # 2. Calculer distance et durée pour les autres
        if yango_results:
            distance_km = yango_results[0]["distance_km"]
            duration_min = yango_results[0]["duration_min"]
        else:
            # Fallback si Yango échoue
            from math import radians, cos, sin, asin, sqrt
            lon1, lat1, lon2, lat2 = map(radians, [start_lng, start_lat, end_lng, end_lat])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            distance_km = 6371 * 2 * asin(sqrt(a))
            duration_min = distance_km * 3.5 + 8

        # 3. Récupérer Heetch + InDrive
        other_results = await other_scraper.get_estimates(distance_km, duration_min)

        # 4. Combiner tous les résultats
        all_results = yango_results + other_results

        # Trier par prix croissant
        all_results = sorted(all_results, key=lambda x: x["price"])

        return {
            "success": True,
            "from": {
                "lat": start_lat,
                "lng": start_lng
            },
            "to": {
                "lat": end_lat,
                "lng": end_lng
            },
            "distance_km": round(distance_km, 1),
            "duration_min": round(duration_min, 0),
            "results": all_results,
            "note": "Les prix sont des estimations. Les tarifs réels peuvent varier selon le trafic et la demande."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du calcul : {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
