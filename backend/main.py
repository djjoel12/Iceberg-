from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional
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
# ANALYSE DES EVENEMENTS
# ============================================================

def analyze_events(
    price: float,
    distance_km: float,
    duration_min: float,
    provider: str
):

    now = datetime.now()

    hour = now.hour

    events = []


    # --------------------------------------------------------
    # 1. HEURE DE POINTE
    # --------------------------------------------------------

    rush_hour = (
        6 <= hour < 9
        or
        16 <= hour < 20
    )

    if rush_hour:

        events.append({
            "type": "rush_hour",
            "label": "Heure de pointe",
            "impact_percent": 10,
            "reason": (
                "La demande peut être plus élevée "
                "pendant les heures de pointe."
            )
        })


    # --------------------------------------------------------
    # 2. TRAJET LONG
    # --------------------------------------------------------

    if distance_km >= 20:

        events.append({
            "type": "long_distance",
            "label": "Trajet long",
            "impact_percent": 5,
            "reason": (
                "Les longs trajets peuvent présenter "
                "une variation supérieure à la moyenne."
            )
        })


    # --------------------------------------------------------
    # 3. TRAJET TRES LONG
    # --------------------------------------------------------

    if distance_km >= 40:

        events.append({
            "type": "very_long_distance",
            "label": "Très longue distance",
            "impact_percent": 8,
            "reason": (
                "Les très longues distances peuvent "
                "avoir un comportement tarifaire différent."
            )
        })


    # --------------------------------------------------------
    # 4. DUREE IMPORTANTE
    # --------------------------------------------------------

    if duration_min >= 35:

        events.append({
            "type": "long_duration",
            "label": "Durée importante",
            "impact_percent": 5,
            "reason": (
                "Une durée de trajet importante peut "
                "augmenter le prix final."
            )
        })


    # --------------------------------------------------------
    # 5. FORTE DEMANDE
    #
    # IMPORTANT :
    # Pour l'instant c'est une estimation.
    # Plus tard cette valeur viendra des données ICEBERG.
    # --------------------------------------------------------

    if rush_hour:

        events.append({
            "type": "high_demand",
            "label": "Demande potentiellement élevée",
            "impact_percent": 15,
            "reason": (
                "Les heures de pointe peuvent correspondre "
                "à une demande plus importante."
            )
        })


    # --------------------------------------------------------
    # CALCUL DES SCENARIOS
    # --------------------------------------------------------

    scenarios = []

    for event in events:

        impact = event["impact_percent"]

        scenario_price = round_price(
            price * (1 + impact / 100)
        )

        scenarios.append({

            "event": event["label"],

            "impact_percent": impact,

            "price": scenario_price,

            "currency": "FCFA",

            "reason": event["reason"]
        })


    # --------------------------------------------------------
    # SCENARIO COMBINE
    #
    # On évite d'additionner directement tous les %
    # pour ne pas créer des prix absurdes.
    #
    # Plafond actuel : +40 %
    # --------------------------------------------------------

    total_impact = sum(
        event["impact_percent"]
        for event in events
    )

    total_impact = min(
        total_impact,
        40
    )

    maximum_price = round_price(
        price * (1 + total_impact / 100)
    )


    # --------------------------------------------------------
    # FOURCHETTE
    # --------------------------------------------------------

    minimum_price = round_price(price)

    return {

        "reference_price": round_price(price),

        "currency": "FCFA",

        "events_detected": events,

        "scenarios": scenarios,

        "combined_scenario": {

            "total_impact_percent": total_impact,

            "minimum_price": minimum_price,

            "maximum_price": maximum_price,

            "currency": "FCFA"
        },

        "message": (
            "Le prix de référence correspond à l'estimation "
            "dans des conditions normales. Les scénarios "
            "montrent comment le prix pourrait évoluer "
            "selon les facteurs détectés."
        )
    }


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
        # 5. ANALYSE
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
        # 7. ANALYSE DES EVENEMENTS POUR CHAQUE VTC
        # ====================================================

        for item in all_results:

            item["price_analysis"] = analyze_events(

                price=item["price"],

                distance_km=distance_km,

                duration_min=duration_min,

                provider=item["provider"]
            )


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
