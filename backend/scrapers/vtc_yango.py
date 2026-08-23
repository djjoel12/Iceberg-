import httpx
from typing import List, Dict, Any

class YangoScraper:
    def __init__(self):
        # L'URL exacte capturée depuis tes DevTools
        self.url = "https://ya-authproxy.yango.com/4.0/persuggest/v1/routestats"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
            "Content-Type": "application/json",
            "Origin": "https://yango.com",
            "Referer": "https://yango.com/",
            "X-Taxi": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 turboapp_taxi brand_yango"
        }

    async def get_estimates(self, start_lat: float, start_lng: float, end_lat: float, end_lng: float, distance_km: float = 5.0, duration_min: float = 15.0) -> List[Dict[str, Any]]:
        # Le payload exact capturé dans tes DevTools
        payload = {
            "route": [[start_lng, start_lat], [end_lng, end_lat]],
            "selected_class": "",
            "format_currency": True,
            "is_lightweight": False,
            "summary_version": 2,
            "supported_markup": "tml-0.1",
            "supports_paid_options": True,
            "use_toll_roads": False,
            "tariff_requirements": [{"class": "econom", "requirements": {"coupon": ""}}]
        }

        # 1. Envoi de la requête directe à l'API Yango issue des DevTools
        try:
            async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
                response = await client.post(self.url, json=payload, headers=self.headers)
                
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    
                    # Traitement de la réponse JSON de Yango
                    service_levels = data.get("service_levels", []) or data.get("options", [])
                    for level in service_levels:
                        name = level.get("title") or level.get("class_text") or "Yango Eco"
                        price_str = level.get("price") or level.get("cost")
                        
                        if price_str:
                            # Extraction du prix numérique
                            price = int(''.join(filter(str.isdigit, str(price_str))))
                            results.append({
                                "provider": "Yango",
                                "category": f"Yango {name}",
                                "price": price,
                                "currency": "XOF",
                                "eta_minutes": 3,
                                "distance_km": distance_km,
                                "duration_min": duration_min
                            })
                    
                    if results:
                        return results
        except Exception as e:
            print(f"Information Yango Direct API : {e}")

        # 2. Secours automatique avec la grille tarifaire d'Abidjan si l'API ne répond pas
        raw_price_eco = 400 + (distance_km * 110) + (duration_min * 15)
        raw_price_comfort = 700 + (distance_km * 160) + (duration_min * 25)
        
        price_eco = max(int(round(raw_price_eco / 50.0) * 50), 400)
        price_comfort = max(int(round(raw_price_comfort / 50.0) * 50), 700)

        return [
            {
                "provider": "Yango",
                "category": "Yango Eco",
                "price": price_eco,
                "currency": "XOF",
                "eta_minutes": 3,
                "distance_km": distance_km,
                "duration_min": duration_min
            },
            {
                "provider": "Yango",
                "category": "Yango Comfort",
                "price": price_comfort,
                "currency": "XOF",
                "eta_minutes": 3,
                "distance_km": distance_km,
                "duration_min": duration_min
            }
        ]
