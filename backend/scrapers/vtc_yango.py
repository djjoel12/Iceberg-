from typing import Dict, List, Any
from math import radians, cos, sin, asin, sqrt
from datetime import datetime

class YangoScraper:
    def __init__(self):
        pass

    async def get_estimates(self, start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> List[Dict[str, Any]]:
        distance_km = self._calculate_distance(start_lat, start_lng, end_lat, end_lng)
        duration_min = self._estimate_duration(distance_km)
        surge = self._get_surge_multiplier()

        # Formule calibrée sur les prix réels 2026 (ex: Siporex → Ebimpé = 6900F)
        base = 800
        price_per_km = 280
        price_per_min = 45

        eco_raw = (base + (distance_km * price_per_km) + (duration_min * price_per_min)) * surge
        comfort_raw = eco_raw * 1.18

        eco_price = max(1500, self._round_price(eco_raw))
        comfort_price = max(2000, self._round_price(comfort_raw))

        return [
            {
                "provider": "Yango",
                "category": "Yango Eco",
                "price": eco_price,
                "currency": "XOF",
                "eta_minutes": 4,
                "distance_km": round(distance_km, 1),
                "duration_min": round(duration_min, 0),
                "is_estimate": True
            },
            {
                "provider": "Yango",
                "category": "Yango Comfort",
                "price": comfort_price,
                "currency": "XOF",
                "eta_minutes": 5,
                "distance_km": round(distance_km, 1),
                "duration_min": round(duration_min, 0),
                "is_estimate": True
            }
        ]

    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        lon1, lat1, lon2, lat2 = map(radians, [lng1, lat1, lng2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        return 6371 * 2 * asin(sqrt(a))

    def _estimate_duration(self, distance_km: float) -> float:
        # Vitesse moyenne réaliste à Abidjan (trafic inclus)
        if distance_km < 5:
            return distance_km * 4.5 + 6
        elif distance_km < 15:
            return distance_km * 3.8 + 8
        else:
            return distance_km * 3.2 + 12

    def _get_surge_multiplier(self) -> float:
        hour = datetime.now().hour
        # Heures de pointe Abidjan
        if hour in [7, 8, 9, 17, 18, 19]:
            return 1.45
        elif hour in [6, 10, 16, 20]:
            return 1.25
        elif hour >= 22 or hour <= 5:
            return 1.35
        return 1.0

    def _round_price(self, price: float) -> int:
        return int(round(price / 100) * 100)
