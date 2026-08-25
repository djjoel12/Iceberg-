from typing import Dict, List, Any, Optional
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

        eco = self._estimate_eco(distance_km)
        low, high = self._price_range(eco)

        combo = max(1100, self._round(eco * 0.80))
        confort = max(1600, self._round(eco * 1.12))
        confort_plus = max(2000, self._round(eco * 1.28))

        return [
            self._item(
                provider="Yango",
                category="Combo",
                price=combo,
                distance_km=distance_km,
                duration_min=duration_min,
                eta=5,
            ),
            self._item(
                provider="Yango",
                category="Éco",
                price=eco,
                distance_km=distance_km,
                duration_min=duration_min,
                eta=4,
                price_min=low,
                price_max=high,
            ),
            self._item(
                provider="Yango",
                category="Confort",
                price=confort,
                distance_km=distance_km,
                duration_min=duration_min,
                eta=5,
            ),
            self._item(
                provider="Yango",
                category="Confort+",
                price=confort_plus,
                distance_km=distance_km,
                duration_min=duration_min,
                eta=8,
            ),
        ]

    def _estimate_eco(self, d: float) -> int:
        """
        Formule ICEBERG V1 — calibrée sur observations Yango Abidjan.
        Paliers car le prix/km diminue avec la distance.
        """
        if d <= 5:
            price = 1500 + (d - 3) * 150
        elif d <= 10:
            price = 1800 + (d - 5) * 180
        elif d <= 20:
            price = 3200 + (d - 10) * 90
        elif d <= 30:
            price = 4100 + (d - 20) * 80
        elif d <= 40:
            price = 4900 + (d - 30) * 120
        else:
            # Longues distances (ex: Dabou → Abidjan)
            price = 6100 + (d - 40) * 160

        return max(1500, self._round(price))

    def _price_range(self, base: int) -> tuple:
        """Fourchette ±8 % autour du prix central."""
        margin = 0.08
        low = max(1500, self._round(base * (1 - margin)))
        high = self._round(base * (1 + margin))
        return low, high

    def _round(self, price: float) -> int:
        return int(round(price / 100) * 100)

    def _item(
        self,
        provider: str,
        category: str,
        price: int,
        distance_km: float,
        duration_min: float,
        eta: int,
        price_min: Optional[int] = None,
        price_max: Optional[int] = None,
    ) -> Dict[str, Any]:

        item = {
            "provider": provider,
            "category": category,
            "price": price,
            "currency": "XOF",
            "eta_minutes": eta,
            "distance_km": round(distance_km, 1),
            "duration_min": round(duration_min, 0),
            "is_estimate": True,
            "price_source": "iceberg_model_v1",
        }

        if price_min is not None and price_max is not None:
            item["price_min"] = price_min
            item["price_max"] = price_max

        return item
