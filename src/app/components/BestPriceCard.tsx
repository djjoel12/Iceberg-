"use client";

type Props = {
  provider: string;
  category: string;
  price: number;
  currency: string;
};

export default function BestPriceCard({ provider, category, price, currency }: Props) {
  return (
    <div className="best-card">
      <div className="label">⭐ Meilleure offre</div>
      <div className="price">
        {price} {currency}
      </div>
      <div className="provider">
        {provider} — {category}
      </div>
      <div style={{ fontSize: "0.8rem", color: "#94A3B8", marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
        ICEBERG recommande cette offre parmi les prix actuellement estimés.
      </div>
    </div>
  );
}
