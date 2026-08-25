from typing import Dict, List, Any, Optional
from datetime import datetime


class OtherVTCScraper:

    def __init__(self):
        pass

    async def get_estimates(
        self,
        distance_km: float,
        duration_min: float
    ) -> List[Dict[str, Any]]:

        if distance_km <= 0 or duration_min <= 0:
            return []

        # On repart de la même base Éco que Yango
        eco = self._estimate_eco(distance_km)

        # Heetch ≈ légèrement au-dessus de Yango Confort
        heetch = max(1800, self._round(eco * 1.15))
        heetch_low, heetch_high = self._price_range(heetch)

        # InDrive ≈ un peu en dessous (négociation possible)
        indrive = max(1500, self._round(eco * 0.88))
        indrive_low, indrive_high = self._price_range(indrive)

        return [
            self._item(
                provider="Heetch",
                category="Classique",
                price=heetch,
                distance_km=distance_km,
                duration_min=duration_min,
                eta=6,
                price_min=heetch_low,
                price_max=heetch_high,
            ),
            self._item(
                provider="InDrive",
                category="Offre recommandée",
                price=indrive,
                distance_km=distance_km,
                duration_min=duration_min,
                eta=7,
                price_min=indrive_low,
                price_max=indrive_high,
            ),
        ]

    def _estimate_eco(self, d: float) -> int:
        """Même formule de base que Yango Éco (référence)."""
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
            price = 6100 + (d - 40) * 160

        return max(1500, self._round(price))

    def _price_range(self, base: int) -> tuple:
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
