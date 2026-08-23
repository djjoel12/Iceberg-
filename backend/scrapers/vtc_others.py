from typing import Dict, List, Any
from datetime import datetime

class OtherVTCScraper:
    def __init__(self):
        pass

    async def get_estimates(self, distance_km: float, duration_min: float) -> List[Dict[str, Any]]:
        if distance_km <= 0:
            return []

        surge = self._get_surge_multiplier()
        results = []

        # Heetch (généralement un peu plus cher que Yango Eco)
        heetch_raw = (900 + (distance_km * 300) + (duration_min * 48)) * surge
        results.append({
            "provider": "Heetch",
            "category": "Classique",
            "price": max(1800, self._round_price(heetch_raw)),
            "currency": "XOF",
            "eta_minutes": 6,
            "distance_km": round(distance_km, 1),
            "duration_min": round(duration_min, 0),
            "is_estimate": True
        })

        # InDrive (souvent un peu moins cher car négociable)
        indrive_raw = (700 + (distance_km * 250) + (duration_min * 40)) * surge
        results.append({
            "provider": "InDrive",
            "category": "Offre recommandée",
            "price": max(1500, self._round_price(indrive_raw)),
            "currency": "XOF",
            "eta_minutes": 7,
            "distance_km": round(distance_km, 1),
            "duration_min": round(duration_min, 0),
            "is_estimate": True
        })

        return results

    def _get_surge_multiplier(self) -> float:
        hour = datetime.now().hour
        if hour in [7, 8, 9, 17, 18, 19]:
            return 1.40
        elif hour in [6, 10, 16, 20]:
            return 1.20
        elif hour >= 22 or hour <= 5:
            return 1.30
        return 1.0

    def _round_price(self, price: float) -> int:
        return int(round(price / 100) * 100)
