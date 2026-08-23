from typing import Dict, List, Any
from datetime import datetime


class YangoScraper:

    def __init__(self):
        pass

    async def get_estimates(
        self,
        distance_km: float,
        duration_min: float
    ) -> List[Dict[str, Any]]:

        if distance_km <= 0 or duration_min <= 0:
            return []

        surge = self._get_surge_multiplier()

        # Modèle Iceberg — ESTIMATION uniquement
        base = 800
        price_per_km = 280
        price_per_min = 45

        eco_raw = (
            base
            + distance_km * price_per_km
            + duration_min * price_per_min
        ) * surge

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
                "is_estimate": True,
                "price_source": "iceberg_model"
            },
            {
                "provider": "Yango",
                "category": "Yango Comfort",
                "price": comfort_price,
                "currency": "XOF",
                "eta_minutes": 5,
                "distance_km": round(distance_km, 1),
                "duration_min": round(duration_min, 0),
                "is_estimate": True,
                "price_source": "iceberg_model"
            }
        ]

    def _get_surge_multiplier(self) -> float:

        hour = datetime.now().hour

        if hour in [7, 8, 9, 17, 18, 19]:
            return 1.45

        if hour in [6, 10, 16, 20]:
            return 1.25

        if hour >= 22 or hour <= 5:
            return 1.35

        return 1.0

    def _round_price(self, price: float) -> int:
        return int(round(price / 100) * 100)
