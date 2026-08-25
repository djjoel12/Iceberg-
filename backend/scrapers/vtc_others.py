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

        base_eco = self._estimate_eco(distance_km)
        events = self._detect_events()

        # Heetch un peu au-dessus
        heetch_base = max(1800, self._round(base_eco * 1.15))
        heetch_final = self._apply_events(heetch_base, events)
        heetch_low, heetch_high = self._price_range(heetch_final)

        # InDrive un peu en dessous (négociation)
        indrive_base = max(1500, self._round(base_eco * 0.88))
        indrive_final = self._apply_events(indrive_base, events)
        indrive_low, indrive_high = self._price_range(indrive_final)

        return [
            self._item(
                "Heetch",
                "Classique",
                heetch_base,
                heetch_final,
                distance_km,
                duration_min,
                6,
                events,
                heetch_low,
                heetch_high,
            ),
            self._item(
                "InDrive",
                "Offre recommandée",
                indrive_base,
                indrive_final,
                distance_km,
                duration_min,
                7,
                events,
                indrive_low,
                indrive_high,
            ),
        ]

    def _estimate_eco(self, d: float) -> int:
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

    def _detect_events(self) -> List[Dict[str, Any]]:
        hour = datetime.now().hour
        events = []

        if hour in [7, 8, 9]:
            events.append({
                "label": "Heure de pointe (matin)",
                "impact_percent": 18,
                "reason": "Forte demande entre 7h et 9h"
            })
        elif hour in [17, 18, 19]:
            events.append({
                "label": "Heure de pointe (soir)",
                "impact_percent": 22,
                "reason": "Forte demande entre 17h et 19h"
            })
        elif hour in [6, 10, 16, 20]:
            events.append({
                "label": "Demande modérée",
                "impact_percent": 8,
                "reason": "Légère hausse de la demande"
            })
        elif hour >= 22 or hour <= 5:
            events.append({
                "label": "Tarif de nuit",
                "impact_percent": 12,
                "reason": "Tarification nocturne"
            })

        return events

    def _apply_events(self, base_price: int, events: List[Dict[str, Any]]) -> int:
        total_impact = sum(e["impact_percent"] for e in events)
        multiplier = 1 + (total_impact / 100)
        return max(1500, self._round(base_price * multiplier))

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
        base_price: int,
        final_price: int,
        distance_km: float,
        duration_min: float,
        eta: int,
        events: List[Dict[str, Any]],
        price_min: Optional[int] = None,
        price_max: Optional[int] = None,
    ) -> Dict[str, Any]:

        item = {
            "provider": provider,
            "category": category,
            "price": final_price,
            "currency": "XOF",
            "eta_minutes": eta,
            "distance_km": round(distance_km, 1),
            "duration_min": round(duration_min, 0),
            "is_estimate": True,
            "price_source": "iceberg_model_v1",
            "price_analysis": {
                "base_price": base_price,
                "final_price": final_price,
                "events_detected": events,
            },
        }

        if price_min is not None and price_max is not None:
            item["price_min"] = price_min
            item["price_max"] = price_max

        return item
