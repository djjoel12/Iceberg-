from typing import Dict, List, Any

class OtherVTCScraper:
    def __init__(self):
        # Grilles tarifaires approximatives observées à Abidjan (en FCFA)
        
        # Heetch (Tarif fixe de prise en charge + coût au km + coût à la min)
        self.heetch_base = 300
        self.heetch_per_km = 180
        self.heetch_per_min = 25
        self.heetch_min_price = 1000  # Course minimum à Abidjan

        # InDrive (Modèle de négociation - estimation moyenne de départ)
        self.indrive_base = 250
        self.indrive_per_km = 160
        self.indrive_per_min = 20
        self.indrive_min_price = 800   # Prix minimum proposé aux chauffeurs

    def _round_to_hundred(self, price: float) -> int:
        """Arrondit le prix à la centaine de FCFA la plus proche (ex: 1430 -> 1400, 1470 -> 1500)."""
        return int(round(price / 100.0) * 100)

    async def get_estimates(self, distance_km: float, duration_min: float) -> List[Dict[str, Any]]:
        """
        Calcule les prix estimés pour Heetch et InDrive basés sur la distance et la durée du trajet.
        """
        results = []

        if distance_km <= 0:
            return results

        # --- Calcul Heetch ---
        raw_heetch = self.heetch_base + (distance_km * self.heetch_per_km) + (duration_min * self.heetch_per_min)
        final_heetch = max(self.heetch_min_price, raw_heetch)
        
        results.append({
            "provider": "Heetch",
            "category": "Classique",
            "price": self._round_to_hundred(final_heetch),
            "currency": "XOF",
            "eta_minutes": 5,
            "distance_km": distance_km,
            "duration_min": duration_min
        })

        # --- Calcul InDrive ---
        raw_indrive = self.indrive_base + (distance_km * self.indrive_per_km) + (duration_min * self.indrive_per_min)
        final_indrive = max(self.indrive_min_price, raw_indrive)

        results.append({
            "provider": "InDrive",
            "category": "Offre recommandée",
            "price": self._round_to_hundred(final_indrive),
            "currency": "XOF",
            "eta_minutes": 6,
            "distance_km": distance_km,
            "duration_min": duration_min
        })

        return results
