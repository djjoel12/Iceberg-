"use client";

type Route = {
  id: number;
  label: string;
  distance_km: number;
  duration_min: number;
  is_shortest?: boolean;
  is_fastest?: boolean;
};

type Props = {
  routes: Route[];
  selectedId: number;
  onSelect: (id: number) => void;
};

export default function RouteSelector({ routes, selectedId, onSelect }: Props) {
  if (routes.length <= 1) return null;

  return (
    <div className="card">
      <div className="card-body">
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 12 }}>
          Choisissez votre itinéraire
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {routes.map((route) => (
            <button
              key={route.id}
              onClick={() => onSelect(route.id)}
              style={{
                padding: 12,
                borderRadius: 14,
                border: `2px solid ${selectedId === route.id ? "var(--primary)" : "var(--border)"}`,
                background: selectedId === route.id ? "#F8FAFC" : "white",
                textAlign: "left",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontWeight: 700 }}>{route.label}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                📏 {route.distance_km} km • ⏱ {route.duration_min} min
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {route.is_shortest && (
                  <span style={{ background: "#D1FAE5", color: "#065F46", fontSize: "0.65rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
                    📍 Plus court
                  </span>
                )}
                {route.is_fastest && (
                  <span style={{ background: "#DBEAFE", color: "#1E40AF", fontSize: "0.65rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
                    ⚡ Plus rapide
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
              }
