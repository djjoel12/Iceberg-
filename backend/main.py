from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import httpx
import uvicorn

from scrapers.vtc_yango import YangoScraper
from scrapers.vtc_others import OtherVTCScraper


app = FastAPI(
    title="Iceberg VTC Comparator",
    description="Comparateur de prix VTC à Abidjan",
    version="1.1.0"
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


async def get_road_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float
):
    """
    Calcule un itinéraire routier avec OSRM.
    """

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
            response = await client.get(url, params=params)
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


def add_price_analysis(results):

    if not results:
        return results

    prices = [item["price"] for item in results]

    minimum = min(prices)
    maximum = max(prices)

    for item in results:

        price = item["price"]

        if price == minimum:
            item["recommendation"] = True
        else:
            item["recommendation"] = False

        # Écart par rapport au prix le moins cher
        if minimum > 0:
            difference = ((price - minimum) / minimum) * 100
        else:
            difference = 0

        item["difference_from_cheapest_percent"] = round(
            difference,
            1
        )

        # Niveau de confiance actuel.
        # Ce n'est PAS une probabilité de prix réel.
        item["confidence"] = "medium"

    return results


@app.get("/")
async def root():

    return {
        "message": "Iceberg API is running",
        "version": "1.1.0",
        "endpoint": "/api/vtc/compare",
        "status": "ready"
    }


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

        # ==========================================
        # 1. ROUTING
        # ==========================================

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


        # ==========================================
        # 2. PRIX YANGO
        # ==========================================

        yango_results = await yango_scraper.get_estimates(
            distance_km,
            duration_min
        )


        # ==========================================
        # 3. PRIX HEETCH + INDRIVE
        # ==========================================

        other_results = await other_scraper.get_estimates(
            distance_km,
            duration_min
        )


        # ==========================================
        # 4. COMBINAISON
        # ==========================================

        all_results = (
            yango_results +
            other_results
        )


        # ==========================================
        # 5. ANALYSE DES PRIX
        # ==========================================

        all_results = add_price_analysis(
            all_results
        )


        # ==========================================
        # 6. TRI DU MOINS CHER AU PLUS CHER
        # ==========================================

        all_results.sort(
            key=lambda item: item["price"]
        )


        # ==========================================
        # 7. MEILLEUR PRIX
        # ==========================================

        best_price = None

        if all_results:

            best = all_results[0]

            best_price = {
                "provider": best["provider"],
                "category": best["category"],
                "price": best["price"],
                "currency": best["currency"]
            }


        # ==========================================
        # 8. RÉPONSE
        # ==========================================

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
                    "Les prix affichés sont des estimations "
                    "Iceberg et ne représentent pas encore "
                    "les tarifs temps réel des plateformes."
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


if __name__ == "__main__":

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
        )
