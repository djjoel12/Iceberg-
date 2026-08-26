"use client";
import { useState } from "react";

type ResultItem = {
  provider: string;
  category: string;
  price: number;
  currency: string;
  eta_minutes?: number;
  recommendation?: boolean;
  difference_from_cheapest_percent?: number;
  price_analysis?: any;
};

type Props = {
  offer: ResultItem;
  index: number;
  route: { distance_km?: number; duration_min?: number };
};

export default function OfferCard({ offer, index, route }: Props) {
  const [open, setOpen] = useState(false);
  const events = offer.price_analysis?.events_detected || [];
  const scenarios = offer.price_analysis?.scenarios || [];
  const combined = offer.price_analysis?.combined_scenario;

  return (
    <div className="offer-card">

      {/* HEADER */}
      <div className="offer-header">
        <div>
          <div className="offer-provider">{offer.provider}</div>
          <div className="offer-category">{offer.category}</div>
          {offer.recommendation && <span className="badge-best">★ MEILLEUR PRIX</span>}
        </div>
        <div className="offer-price">
          <div className="amount">{offer.price}</div>
          <div className="currency">{offer.currency}</div>
        </div>
      </div>

      {/* META */}
      <div className="offer-meta">
        <span>🕐 {offer.eta_minutes ?? "—"} min</span>
        {offer.difference_from_cheapest_percent !== undefined && (
          <span>
            {offer.difference_from_cheapest_percent === 0
              ? "Meilleur prix"
              : `+${offer.difference_from_cheapest_percent}% vs meilleur`}
          </span>
        )}
      </div>

      {/* BOUTON */}
      <button className="btn-why" onClick={() => setOpen(!open)}>
        {open ? "Masquer les détails" : "Pourquoi ce prix ?"}
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {/* DÉTAILS */}
      {open && (
        <div style={{ padding: "0 18px 18px", background: "#F8FAFC" }}>
          {/* Événements */}
          {events.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
                📊 Éléments détectés
              </div>
              {events.map((e: any, idx: number) => (
                <div key={idx} style={{ background: "white", padding: 12, borderRadius: 12, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{e.label}</div>
                  <div style={{ color: "var(--warning)", fontWeight: 700 }}>+{e.impact_percent}%</div>
                </div>
              ))}
            </div>
          )}

          {/* Scénarios */}
          {scenarios.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
                🔮 Si ces événements se produisent
              </div>
              {scenarios.map((s: any, idx: number) => (
                <div key={idx} style={{ background: "white", padding: 12, borderRadius: 12, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{s.event}</div>
                  <div style={{ fontWeight: 700 }}>{s.price} {s.currency}</div>
                </div>
              ))}
            </div>
          )}

          {/* Combiné */}
          {combined && (
            <div style={{ background: "white", padding: 16, borderRadius: 14, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--warning)" }}>📈 Scénario combiné</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Prix normal</div>
                  <div style={{ fontWeight: 700 }}>{combined.minimum_price} {combined.currency}</div>
                </div>
                <div style={{ fontSize: "1.2rem", color: "var(--text-secondary)" }}>→</div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Prix potentiel</div>
                  <div style={{ fontWeight: 700, color: "var(--warning)" }}>{combined.maximum_price} {combined.currency}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                +{combined.total_impact_percent}% d'impact maximal
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
        }
