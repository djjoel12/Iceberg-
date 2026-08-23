from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn

from scrapers.vtc_yango import YangoScraper
from scrapers.vtc_others import OtherVTCScraper


app = FastAPI(
    title="Iceberg VTC Comparator",
    description="Comparateur de prix VTC à Abidjan (Yango, Heetch, InDrive)",
    version="1.1.0"
)


# CORS
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
    Récupère un itinéraire routier réel via OSRM.

    Retourne :
    - distance_km
    - duration_min
    - geometry
    """

    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{start_lng},{start_lat};{end_lng},{end_lat}"
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

        distance_km = route["distance"] / 1000
        duration_min = route["duration"] / 60

        return {
            "distance_km": distance_km,
            "duration_min": duration_min,
            "geometry": route.get("geometry")
        }

    except Exception:
        return None


@app.get("/")
async def root():
    return {
        "message": "Iceberg API is running",
        "version": "1.1.0",
        "endpoint": "/api/vtc/compare",
        "example": (
            "/api/vtc/compare"
            "?start_lat=5.3555"
            "&start_lng=-4.0744"
            "&end_lat=5.4807"
            "&end_lng=-4.0746"
        )
    }


@app.get("/api/vtc/compare")
async def compare_vtc(
    start_lat: float = Query(..., description="Latitude de départ"),
    start_lng: float = Query(..., description="Longitude de départ"),
    end_lat: float = Query(..., description="Latitude d'arrivée"),
    end_lng: float = Query(..., description="Longitude d'arrivée")
):

    try:

        # ---------------------------------------------------------
        # 1. CALCUL DE L'ITINÉRAIRE ROUTIER
        # ---------------------------------------------------------

        route = await get_road_route(
            start_lat,
            start_lng,
            end_lat,
            end_lng
        )

        if not route:
            raise HTTPException(
                status_code=503,
                detail="Impossible de calculer l'itinéraire routier."
            )

        distance_km = route["distance_km"]
        duration_min = route["duration_min"]

        # ---------------------------------------------------------
        # 2. ESTIMATION YANGO
        # ---------------------------------------------------------

        yango_results = await yango_scraper.get_estimates(
            start_lat,
            start_lng,
            end_lat,
            end_lng
        )

        # ---------------------------------------------------------
        # 3. IMPORTANT :
        #    ON FORCE YANGO À UTILISER LA DISTANCE ROUTIÈRE
        # ---------------------------------------------------------

        for result in yango_results:
            result["distance_km"] = round(distance_km, 1)
            result["duration_min"] = round(duration_min, 0)

        # ---------------------------------------------------------
        # 4. HEETCH + INDRIVE
        # ---------------------------------------------------------

        other_results = await other_scraper.get_estimates(
            distance_km,
            duration_min
        )

        # ---------------------------------------------------------
        # 5. COMBINAISON
        # ---------------------------------------------------------

        all_results = yango_results + other_results

        # Distance/durée routières pour tous
        for result in all_results:
            result["distance_km"] = round(distance_km, 1)
            result["duration_min"] = round(duration_min, 0)

        # Classement par prix
        all_results = sorted(
            all_results,
            key=lambda x: x["price"]
        )

        # ---------------------------------------------------------
        # 6. RÉSULTAT
        # ---------------------------------------------------------

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
                "distance_km": round(distance_km, 2),
                "duration_min": round(duration_min, 1),
                "geometry": route["geometry"]
            },

            "results": all_results,

            "note": (
                "La distance et la durée sont calculées "
                "à partir d'un itinéraire routier. "
                "Les prix restent des estimations."
            )
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
