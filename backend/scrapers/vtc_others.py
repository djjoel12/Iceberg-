from typing import Dict, List, Any, Optional
from datetime import datetime, timezone


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
        scenarios = self._get_scenarios()

        # === NOUVEAUX MULTIPLICATEURS ===
        heetch_base = max(1800, self._round(base_eco * 1.10))   # 1.15 → 1.10
        heetch_final = self._apply_events(heetch_base, events)
        heetch_low, heetch_high = self._price_range(heetch_final)

        indrive_base = max(1500, self._round(base_eco * 1.00))  # 0.88 → 1.00
        indrive_final = self._apply_events(indrive_base, events)
        indrive_low, indrive_high = self._price_range(indrive_final)

        return [
            self._item(
                "Heetch", "Classique",
                heetch_base, heetch_final,
                distance_km, duration_min, 6,
                events, scenarios, heetch_low, heetch_high
            ),
            self._item(
                "InDrive", "Offre recommandée",
                indrive_base, indrive_final,
                distance_km, duration_min, 7,
                events, scenarios, indrive_low, indrive_high
            ),
        ]

    def _estimate_eco(self, d: float) -> int:
        # === NOUVELLES AUGMENTATIONS ===
        if d <= 5:
            price = 1500 + (d - 3) * 120   # 150 → 120
        elif d <= 10:
            price = 1800 + (d - 5) * 150   # 180 → 150
        elif d <= 20:
            price = 3200 + (d - 10) * 70   # 90 → 70
        elif d <= 30:
            price = 4100 + (d - 20) * 60   # 80 → 60
        elif d <= 40:
            price = 4900 + (d - 30) * 100  # 120 → 100
        else:
            price = 6100 + (d - 40) * 130  # 160 → 130
        return max(1500, self._round(price))

    def _detect_events(self) -> List[Dict[str, Any]]:
        """Événements RÉELS et ACTIFS maintenant (inchangés)."""
        hour = datetime.now(timezone.utc).hour
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

    def _get_scenarios(self) -> List[Dict[str, Any]]:
        """Scénarios POSSIBLES (inchangés)."""
        return [
            {
                "label": "Heure de pointe matin",
                "impact_percent": 18,
                "reason": "Si la course est demandée entre 7h et 9h"
            },
            {
                "label": "Heure de pointe soir",
                "impact_percent": 22,
                "reason": "Si la course est demandée entre 17h et 19h"
            },
            {
                "label": "Tarif de nuit",
                "impact_percent": 12,
                "reason": "Si la course est demandée entre 22h et 5h"
            },
            {
                "label": "Demande modérée",
                "impact_percent": 8,
                "reason": "Si la course est demandée en début/fin de pointe"
            },
        ]

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
        scenarios: List[Dict[str, Any]],
        price_min: Optional[int] = None,
        price_max: Optional[int] = None,
    ) -> Dict[str, Any]:

        max_impact = max((s["impact_percent"] for s in scenarios), default=0)
        potential_price = self._round(base_price * (1 + max_impact / 100))

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
                "events_detected": events,
                "scenarios": scenarios,
                "combined_scenario": {
                    "max_impact_percent": max_impact,
                    "normal_price": final_price,
                    "potential_price": max(final_price, potential_price),
                },
            },
        }

        if price_min is not None and price_max is not None:
            item["price_min"] = price_min
            item["price_max"] = price_max

        return item
