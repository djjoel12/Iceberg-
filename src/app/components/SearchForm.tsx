"use client";

import { GeoResult } from "../../lib/geocode";

type Props = {
  startQuery: string;
  endQuery: string;
  startSuggestions: GeoResult[];
  endSuggestions: GeoResult[];
  selecting: "start" | "end";
  loading: boolean;
  error: string | null;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onSelectStart: (place: GeoResult) => void;
  onSelectEnd: (place: GeoResult) => void;
  onSelecting: (type: "start" | "end") => void;
  onCompare: () => void;
};

export default function SearchForm({
  startQuery,
  endQuery,
  startSuggestions,
  endSuggestions,
  selecting,
  loading,
  error,
  onStartChange,
  onEndChange,
  onSelectStart,
  onSelectEnd,
  onSelecting,
  onCompare,
}: Props) {
  return (
    <div className="form-card">

      {/* DÉPART */}
      <div className="input-group">
        <label>📍 Départ</label>
        <div className="input-wrapper">
          <div className="input-icon start">📍</div>
          <input
            value={startQuery}
            onChange={(e) => onStartChange(e.target.value)}
            onFocus={() => onSelecting("start")}
            type="text"
            placeholder="Où partez-vous ?"
          />
        </div>
        {startSuggestions.length > 0 && (
          <ul className="suggestions">
            {startSuggestions.map((s, i) => (
              <li key={i} onClick={() => onSelectStart(s)} className="suggestion-item">
                {s.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* DESTINATION */}
      <div className="input-group">
        <label>🎯 Destination</label>
        <div className="input-wrapper">
          <div className="input-icon end">🎯</div>
          <input
            value={endQuery}
            onChange={(e) => onEndChange(e.target.value)}
            onFocus={() => onSelecting("end")}
            type="text"
            placeholder="Où allez-vous ?"
          />
        </div>
        {endSuggestions.length > 0 && (
          <ul className="suggestions">
            {endSuggestions.map((s, i) => (
              <li key={i} onClick={() => onSelectEnd(s)} className="suggestion-item">
                {s.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* BOUTONS SÉLECTION */}
      <div className="select-btns">
        <button
          onClick={() => onSelecting("start")}
          className={`select-btn ${selecting === "start" ? "active-start" : ""}`}
        >
          📍 Choisir départ
        </button>
        <button
          onClick={() => onSelecting("end")}
          className={`select-btn ${selecting === "end" ? "active-end" : ""}`}
        >
          🎯 Choisir arrivée
        </button>
      </div>

      {/* BOUTON COMPARER */}
      <button className="btn-primary" onClick={onCompare} disabled={loading}>
        {loading ? "Comparaison en cours..." : "Comparer les prix"}
      </button>

      {error && <div className="error-box">{error}</div>}
    </div>
  );
          }
