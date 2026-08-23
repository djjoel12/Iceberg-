import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap
} from "react-leaflet";

import L from "leaflet";

const API_URL = "http://localhost:8000";

const defaultPosition = [5.3364, -4.0267];

function createIcon(type) {
  return L.divIcon({
    className: "",
    html: `
      <div class="map-marker ${type}">
        ${type === "start" ? "📍" : "🎯"}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });
}

function MapController({ route }) {
  const map = useMap();

  if (route?.length) {
    const bounds = L.latLngBounds(route);
    map.fitBounds(bounds, {
      padding: [40, 40]
    });
  }

  return null;
}

function PriceCard({ item, index }) {
  return (
    <div className={`price-card ${item.recommendation ? "best" : ""}`}>
      <div className="provider-row">
        <div>
          <div className="provider">
            {index === 0 && "🏆 "}
            {item.provider}
          </div>

          <div className="category">
            {item.category}
          </div>
        </div>

        <div className="price">
          {item.price.toLocaleString("fr-FR")} FCFA
        </div>
      </div>

      <div className="details">
        <span>⏱️ {Math.round(item.duration_min)} min</span>
        <span>📍 {item.distance_km} km</span>
      </div>

      {item.recommendation && (
        <div className="best-label">
          Meilleur prix estimé
        </div>
      )}

      <div className="estimate">
        Estimation Iceberg
      </div>
    </div>
  );
}

export default function App() {
  const [start, setStart] = useState({
    lat: 5.3555,
    lng: -4.0744
  });

  const [destination, setDestination] = useState({
    lat: 5.4807,
    lng: -4.0746
  });

  const [results, setResults] = useState([]);
  const [route, setRoute] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function comparePrices() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        start_lat: start.lat,
        start_lng: start.lng,
        end_lat: destination.lat,
        end_lng: destination.lng
      });

      const response = await fetch(
        `${API_URL}/api/vtc/compare?${params}`
      );

      if (!response.ok) {
        throw new Error("Impossible de contacter Iceberg.");
      }

      const data = await response.json();

      setResults(data.results || []);

      setRouteInfo({
        distance: data.route.distance_km,
        duration: data.route.duration_min
      });

      const coordinates =
        data.route.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );

      setRoute(coordinates);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">

      <header className="header">
        <div className="logo">
          ICEBERG
        </div>

        <div className="subtitle">
          Comparez les prix VTC à Abidjan
        </div>
      </header>

      <main className="content">

        <section className="search-panel">

          <div className="field">
            <label>📍 Départ</label>

            <div className="coordinate-box">
              {start.lat}, {start.lng}
            </div>
          </div>

          <div className="field">
            <label>🎯 Destination</label>

            <div className="coordinate-box">
              {destination.lat}, {destination.lng}
            </div>
          </div>

          <button
            className="compare-button"
            onClick={comparePrices}
            disabled={loading}
          >
            {loading ? "Comparaison..." : "Comparer les prix"}
          </button>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

        </section>

        <section className="map-wrapper">

          <MapContainer
            center={defaultPosition}
            zoom={12}
            className="map"
          >

            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker
              position={[start.lat, start.lng]}
              icon={createIcon("start")}
            >
              <Popup>
                Départ
              </Popup>
            </Marker>

            <Marker
              position={[destination.lat, destination.lng]}
              icon={createIcon("end")}
            >
              <Popup>
                Destination
              </Popup>
            </Marker>

            {route.length > 0 && (
              <>
                <Polyline
                  positions={route}
                  pathOptions={{
                    weight: 6
                  }}
                />

                <MapController route={route} />
              </>
            )}

          </MapContainer>

        </section>

        {routeInfo && (
          <section className="route-info">

            <div>
              <strong>
                {routeInfo.distance} km
              </strong>

              <span>
                Distance
              </span>
            </div>

            <div>
              <strong>
                {Math.round(routeInfo.duration)} min
              </strong>

              <span>
                Durée estimée
              </span>
            </div>

          </section>
        )}

        {results.length > 0 && (
          <section className="results">

            <div className="results-title">
              Comparaison
            </div>

            {results.map((item, index) => (
              <PriceCard
                key={`${item.provider}-${item.category}`}
                item={item}
                index={index}
              />
            ))}

          </section>
        )}

      </main>

    </div>
  );
            }
