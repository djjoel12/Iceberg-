import httpx
from typing import Dict, List, Any

class YangoScraper:
    def __init__(self):
        # Endpoint d'estimation des tarifs Yango / Yandex Go
        self.url = "https://route-estimator.yandex.net/v1/estimate"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    async def get_estimates(self, start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> List[Dict[str, Any]]:
        """
        Envoie les coordonnées GPS à Yango et extrait les prix et la durée.
        """
        # Format des coordonnées pour Yango : [longitude, latitude]
        payload = {
            "route": [
                [start_lng, start_lat],
                [end_lng, end_lat]
            ],
            "currency_code": "XOF"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.url, json=payload, headers=self.headers, timeout=10.0)
                
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    
                    # Extraction des données de chaque catégorie de course
                    for option in data.get("options", []):
                        results.append({
                            "provider": "Yango",
                            "category": option.get("class_text", "Eco"),
                            "price": option.get("price"),
                            "currency": "XOF",
                            "eta_minutes": option.get("waiting_time_minutes", 3),
                            "distance_km": round(data.get("distance_meters", 0) / 1000, 2),
                            "duration_min": round(data.get("time_seconds", 0) / 60, 1)
                        })
                    return results
                else:
                    return []
            except Exception as e:
                print(f"Erreur Yango : {e}")
                return []
