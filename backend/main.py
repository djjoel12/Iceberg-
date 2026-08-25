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
# ROUTING
# ============================================================

async def get_road_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float
):

    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{start_lng},{start_lat};"
        f"{end_lng},{end_lat}"
    )

    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false"
    }

    try:

        async with httpx.AsyncClient(timeout=10.0) as client:

            response = await client.get(
                url,
                params=params
            )

            response.raise_for_status()

            data = response.json()

        if data.get("code") != "Ok":
            return None

        route = data["routes"][0]

        return {
            "distance_km": route["distance"] / 1000,
            "duration_min": route["duration"] / 60,
            "geometry": route.get("geometry")
        }

    except Exception:

        return None


# ============================================================
# ANALYSE DES PRIX
# ============================================================

def add_price_analysis(results):

    if not results:
        return results

    prices = [
        item["price"]
        for item in results
        if item.get("price") is not None
    ]

    if not prices:
        return results

    minimum = min(prices)

    for item in results:

        price = item["price"]

        item["recommendation"] = (
            price == minimum
        )

        if minimum > 0:

            difference = (
                (price - minimum)
                / minimum
            ) * 100

        else:

            difference = 0

        item["difference_from_cheapest_percent"] = round(
            difference,
            1
        )

        item["confidence"] = "medium"

    return results


# ============================================================
# ARRONDI
# ============================================================

def round_price(price):

    return int(round(price / 100) * 100)


# ============================================================
# GÉNÉRATEUR DE SCÉNARIOS (prospectifs, n'affectent pas le prix)
# ============================================================

def generate_scenarios(
    price: float,
    distance_km: float,
    duration_min: float,
    provider: str
) -> List[Dict[str, Any]]:
    """Génère des scénarios prospectifs SANS affecter le prix actuel."""
    
    scenarios = []
    
    # Scénario 1 : Heure de pointe matin
    scenarios.append({
        "event": "Heure de pointe matin",
        "impact_percent": 20,
        "price": round_price(price * 1.20),
        "currency": "FCFA",
        "reason": "Si la course est demandée entre 7h et 9h"
    })
    
    # Scénario 2 : Heure de pointe soir
    scenarios.append({
        "event": "Heure de pointe soir",
        "impact_percent": 25,
        "price": round_price(price * 1.25),
        "currency": "FCFA",
        "reason": "Si la course est demandée entre 17h et 19h"
    })
    
    # Scénario 3 : Tarif de nuit
    scenarios.append({
        "event": "Tarif de nuit",
        "impact_percent": 15,
        "price": round_price(price * 1.15),
        "currency": "FCFA",
        "reason": "Si la course est demandée entre 22h et 5h"
    })
    
    # Scénario 4 : Demande modérée
    scenarios.append({
        "event": "Demande modérée",
        "impact_percent": 10,
        "price": round_price(price * 1.10),
        "currency": "FCFA",
        "reason": "Si la course est demandée en début/fin de pointe"
    })
    
    # Scénario 5 : Trajet long
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


# ============================================================
# COMPARAISON
# ============================================================

@app.get("/api/vtc/compare")
async def compare_vtc(

    start_lat: float = Query(
        ...,
        description="Latitude de départ"
    ),

    start_lng: float = Query(
        ...,
        description="Longitude de départ"
    ),

    end_lat: float = Query(
        ...,
        description="Latitude d'arrivée"
    ),

    end_lng: float = Query(
        ...,
        description="Longitude d'arrivée"
    )
):

    try:

        # ====================================================
        # 1. ROUTE
        # ====================================================

        route = await get_road_route(
            start_lat,
            start_lng,
            end_lat,
            end_lng
        )

        if not route:

            raise HTTPException(
                status_code=503,
                detail="Impossible de calculer l'itinéraire."
            )


        distance_km = route["distance_km"]

        duration_min = route["duration_min"]


        # ====================================================
        # 2. YANGO
        # ====================================================

        yango_results = await yango_scraper.get_estimates(
            distance_km,
            duration_min
        )


        # ====================================================
        # 3. AUTRES VTC
        # ====================================================

        other_results = await other_scraper.get_estimates(
            distance_km,
            duration_min
        )


        # ====================================================
        # 4. COMBINAISON
        # ====================================================

        all_results = (
            yango_results
            +
            other_results
        )


        # ====================================================
        # 5. ANALYSE DES PRIX (recommandation, % diff)
        # ====================================================

        all_results = add_price_analysis(
            all_results
        )


        # ====================================================
        # 6. TRI
        # ====================================================

        all_results.sort(
            key=lambda item: item["price"]
        )


        # ====================================================
        # 7. AJOUT DES SCÉNARIOS PROSPECTIFS (sans écraser)
        # ====================================================

        for item in all_results:
            # Récupère l'analyse existante des scraper
            existing_analysis = item.get("price_analysis", {})
            existing_events = existing_analysis.get("events_detected", [])
            
            # Génère les scénarios prospectifs
            scenarios = generate_scenarios(
                price=item["price"],
                distance_km=distance_km,
                duration_min=duration_min,
                provider=item["provider"]
            )
            
            # Calcule l'impact max des scénarios
            max_impact = max((s.get("impact_percent", 0) for s in scenarios), default=0)
            max_price = max([s.get("price", item["price"]) for s in scenarios] + [item["price"]])
            
            # Fusionne : garde les événements réels + ajoute les scénarios
            item["price_analysis"] = {
                "events_detected": existing_events,  # ← Événements réels des scraper
                "scenarios": scenarios,               # ← Scénarios prospectifs
                "combined_scenario": {
                    "total_impact_percent": max_impact,
                    "minimum_price": item["price"],
                    "maximum_price": max_price,
                    "currency": "FCFA"
                },
                "confidence": "medium"
            }


        # ====================================================
        # 8. MEILLEUR PRIX
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
        # 9. REPONSE
        # ====================================================

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


            "route": {

                "distance_km": round(
                    distance_km,
                    2
                ),

                "duration_min": round(
                    duration_min,
                    1
                ),

                "geometry": route["geometry"]
            },


            "best_price": best_price,


            "results": all_results,


            "pricing": {

                "type": "estimated",

                "source": "iceberg_model",

                "real_time": False,

                "message": (
                    "Les prix sont des estimations ICEBERG. "
                    "Les scénarios indiquent comment le prix "
                    "pourrait évoluer selon différents événements."
                )
            }

        }


    except HTTPException:

        raise


    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=f"Erreur lors du calcul : {str(e)}"
        )


# ============================================================
# LANCEMENT LOCAL
# ============================================================

if __name__ == "__main__":

    uvicorn.run(

        "main:app",

        host="0.0.0.0",

        port=8000,

        reload=True
        )
