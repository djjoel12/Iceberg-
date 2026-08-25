from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import httpx
import uvicorn

from scrapers.vtc_yango import YangoScraper
from scrapers.vtc_others import OtherVTCScraper


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="Iceberg VTC Comparator",
    description="Comparateur de prix VTC à Abidjan",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

yango_scraper = YangoScraper()
other_scraper = OtherVTCScraper()


# ============================================================
# ROUTING - RETOURNE 2 CHEMINS
# ============================================================

async def get_road_routes(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float
):
    """Retourne le chemin le plus court et le plus rapide."""
    
    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{start_lng},{start_lat};"
        f"{end_lng},{end_lat}"
    )

    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
        "alternatives": "true"  # ← Demande plusieurs itinéraires
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            return []

        routes = data["routes"]
        
        if len(routes) == 1:
            # Un seul chemin disponible
            route = routes[0]
            return [{
                "id": 1,
                "label": "Itinéraire unique",
                "distance_km": round(route["distance"] / 1000, 2),
                "duration_min": round(route["duration"] / 60, 1),
                "geometry": route.get("geometry"),
                "is_shortest": True,
                "is_fastest": True,
            }]
        
        # Trouve le PLUS COURT et le PLUS RAPIDE
        shortest = min(routes, key=lambda r: r["distance"])
        fastest = min(routes, key=lambda r: r["duration"])
        
        result = []
        
        # 1. Chemin le PLUS COURT
        result.append({
            "id": 1,
            "label": "Le moins cher",
            "distance_km": round(shortest["distance"] / 1000, 2),
            "duration_min": round(shortest["duration"] / 60, 1),
            "geometry": shortest.get("geometry"),
            "is_shortest": True,
            "is_fastest": False,
        })
        
        # 2. Chemin le PLUS RAPIDE (si différent du plus court)
        if shortest["distance"] != fastest["distance"]:
            result.append({
                "id": 2,
                "label": "Le plus rapide",
                "distance_km": round(fastest["distance"] / 1000, 2),
                "duration_min": round(fastest["duration"] / 60, 1),
                "geometry": fastest.get("geometry"),
                "is_shortest": False,
                "is_fastest": True,
            })
        
        return result

    except Exception as e:
        print(f"Erreur route: {e}")
        return []


# ============================================================
# ANALYSE DES PRIX
# ============================================================

def add_price_analysis(results):
    if not results:
        return results

    prices = [item["price"] for item in results if item.get("price") is not None]
    if not prices:
        return results

    minimum = min(prices)

    for item in results:
        price = item["price"]
        item["recommendation"] = (price == minimum)
        
        if minimum > 0:
            difference = ((price - minimum) / minimum) * 100
        else:
            difference = 0
            
        item["difference_from_cheapest_percent"] = round(difference, 1)
        item["confidence"] = "medium"

    return results


def round_price(price):
    return int(round(price / 100) * 100)


def generate_scenarios(
    price: float,
    distance_km: float,
    duration_min: float,
    provider: str
) -> List[Dict[str, Any]]:
    scenarios = []
    
    scenarios.append({
        "event": "Heure de pointe matin",
        "impact_percent": 20,
        "price": round_price(price * 1.20),
        "currency": "FCFA",
        "reason": "Si la course est demandée entre 7h et 9h"
    })
    
    scenarios.append({
        "event": "Heure de pointe soir",
        "impact_percent": 25,
        "price": round_price(price * 1.25),
        "currency": "FCFA",
        "reason": "Si la course est demandée entre 17h et 19h"
    })
    
    scenarios.append({
        "event": "Tarif de nuit",
        "impact_percent": 15,
        "price": round_price(price * 1.15),
        "currency": "FCFA",
        "reason": "Si la course est demandée entre 22h et 5h"
    })
    
    scenarios.append({
        "event": "Demande modérée",
        "impact_percent": 10,
        "price": round_price(price * 1.10),
        "currency": "FCFA",
        "reason": "Si la course est demandée en début/fin de pointe"
    })
    
    if distance_km >= 20:
        scenarios.append({
            "event": "Trajet long",
            "impact_percent": 10,
            "price": round_price(price * 1.10),
            "currency": "FCFA",
            "reason": "Les longs trajets peuvent avoir une variation de prix"
        })
    
    return scenarios


# ============================================================
# API
# ============================================================

@app.get("/")
async def root():
    return {
        "message": "Iceberg API is running",
        "version": "1.2.0",
        "endpoint": "/api/vtc/compare",
        "status": "ready"
    }


@app.get("/api/vtc/compare")
async def compare_vtc(
    start_lat: float = Query(..., description="Latitude de départ"),
    start_lng: float = Query(..., description="Longitude de départ"),
    end_lat: float = Query(..., description="Latitude d'arrivée"),
    end_lng: float = Query(..., description="Longitude d'arrivée"),
    route_id: Optional[int] = Query(1, description="ID du chemin (1=plus court, 2=plus rapide)")
):

    try:
        # ====================================================
        # 1. ROUTES (2 chemins)
        # ====================================================
        routes = await get_road_routes(start_lat, start_lng, end_lat, end_lng)
        
        if not routes:
            raise HTTPException(
                status_code=503,
                detail="Impossible de calculer l'itinéraire."
            )

        # Sélectionne le chemin demandé
        selected_route = None
        for r in routes:
            if r["id"] == route_id:
                selected_route = r
                break
        
        if not selected_route:
            selected_route = routes[0]  # Fallback sur le premier
        
        distance_km = selected_route["distance_km"]
        duration_min = selected_route["duration_min"]

        # ====================================================
        # 2. YANGO
        # ====================================================
        yango_results = await yango_scraper.get_estimates(distance_km, duration_min)

        # ====================================================
        # 3. AUTRES VTC
        # ====================================================
        other_results = await other_scraper.get_estimates(distance_km, duration_min)

        # ====================================================
        # 4. COMBINAISON
        # ====================================================
        all_results = yango_results + other_results

        # ====================================================
        # 5. ANALYSE DES PRIX
        # ====================================================
        all_results = add_price_analysis(all_results)
        all_results.sort(key=lambda item: item["price"])

        # ====================================================
        # 6. AJOUT DES SCÉNARIOS
        # ====================================================
        for item in all_results:
            existing_analysis = item.get("price_analysis", {})
            existing_events = existing_analysis.get("events_detected", [])
            
            scenarios = generate_scenarios(
                price=item["price"],
                distance_km=distance_km,
                duration_min=duration_min,
                provider=item["provider"]
            )
            
            max_impact = max((s.get("impact_percent", 0) for s in scenarios), default=0)
            max_price = max([s.get("price", item["price"]) for s in scenarios] + [item["price"]])
            
            item["price_analysis"] = {
                "events_detected": existing_events,
                "scenarios": scenarios,
                "combined_scenario": {
                    "total_impact_percent": max_impact,
                    "minimum_price": item["price"],
                    "maximum_price": max_price,
                    "currency": "FCFA"
                },
                "confidence": "medium"
            }

        # ====================================================
        # 7. MEILLEUR PRIX
        # ====================================================
        best_price = None
        if all_results:
            best = all_results[0]
            best_price = {
                "provider": best["provider"],
                "category": best["category"],
                "price": best["price"],
                "currency": best["currency"]
            }

        # ====================================================
        # 8. REPONSE
        # ====================================================
        return {
            "success": True,
            "from": {"lat": start_lat, "lng": start_lng},
            "to": {"lat": end_lat, "lng": end_lng},
            "routes": routes,  # ← TOUS les chemins disponibles
            "selected_route_id": route_id,
            "selected_route": selected_route,
            "route": {
                "distance_km": round(distance_km, 2),
                "duration_min": round(duration_min, 1),
                "geometry": selected_route.get("geometry")
            },
            "best_price": best_price,
            "results": all_results,
            "pricing": {
                "type": "estimated",
                "source": "iceberg_model",
                "real_time": False,
                "message": "Les prix sont des estimations ICEBERG."
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du calcul : {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
