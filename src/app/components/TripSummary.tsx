"use client";

type Props = {
  distance: number;
  duration: number;
  startName?: string;
  endName?: string;
};

export default function TripSummary({ distance, duration, startName, endName }: Props) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.04em" }}>
          Votre trajet
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div style={{ background: "var(--bg)", padding: 12, borderRadius: 14 }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Distance</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>{distance ?? "—"} km</div>
          </div>
          <div style={{ background: "var(--bg)", padding: 12, borderRadius: 14 }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Durée</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>{duration ?? "—"} min</div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <div>📍 {startName}</div>
          <div>🎯 {endName}</div>
        </div>
      </div>
    </div>
  );
}
