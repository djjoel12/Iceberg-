"use client";

type Props = {
  onReset?: () => void;
  hasResult?: boolean;
};

export default function Header({ onReset, hasResult }: Props) {
  return (
    <header className="header">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>ICEBERG</h1>
          <p>Comparez les prix de transport à Abidjan</p>
        </div>
        {hasResult && (
          <button
            onClick={onReset}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "white",
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Nouveau trajet
          </button>
        )}
      </div>
    </header>
  );
}
