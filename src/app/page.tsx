"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { searchPlaces, reverseGeocode, GeoResult } from "../lib/geocode";
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import RouteSelector from "./components/RouteSelector";
import TripSummary from "./components/TripSummary";
import BestPriceCard from "./components/BestPriceCard";
import OfferCard from "./components/OfferCard";
import "./globals.css";

const Map = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-500">Chargement de la carte...</div>
    </div>
  ),
});

type Point = { lat: number; lng: number; name: string };
type Route = { id: number; label: string; distance_km: number; duration_min: number; geometry?: any; is_shortest?: boolean; is_fastest?: boolean };

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startSuggestions, setStartSuggestions] = useState<GeoResult[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<GeoResult[]>([]);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(1);

  const startTimeout = useRef<NodeJS.Timeout | null>(null);
  const endTimeout = useRef<NodeJS.Timeout | null>(null);

  // Recherche
  useEffect(() => {
    if (startTimeout.current) clearTimeout(startTimeout.current);
    if (startQuery.length < 3) { setStartSuggestions([]); return; }
    startTimeout.current = setTimeout(async () => {
      try { setStartSuggestions(await searchPlaces(startQuery)); } catch { setStartSuggestions([]); }
    }, 400);
    return () => { if (startTimeout.current) clearTimeout(startTimeout.current); };
  }, [startQuery]);

  useEffect(() => {
    if (endTimeout.current) clearTimeout(endTimeout.current);
    if (endQuery.length < 3) { setEndSuggestions([]); return; }
    endTimeout.current = setTimeout(async () => {
      try { setEndSuggestions(await searchPlaces(endQuery)); } catch { setEndSuggestions([]); }
    }, 400);
    return () => { if (endTimeout.current) clearTimeout(endTimeout.current); };
  }, [endQuery]);

  const selectStart = (place: GeoResult) => {
    setStart({ lat: place.lat, lng: place.lng, name: place.displayName });
    setStartQuery(place.displayName);
    setStartSuggestions([]);
    setSelecting("end");
  };

  const selectEnd = (place: GeoResult) => {
    setEnd({ lat: place.lat, lng: place.lng, name: place.displayName });
    setEndQuery(place.displayName);
    setEndSuggestions([]);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    try {
      const name = await reverseGeocode(lat, lng);
      if (selecting === "start") {
        setStart({ lat, lng, name });
        setStartQuery(name);
        setSelecting("end");
      } else {
        setEnd({ lat, lng, name });
        setEndQuery(name);
      }
    } catch {
      const name = "Position sélectionnée";
      if (selecting === "start") {
        setStart({ lat, lng, name });
        setStartQuery(name);
        setSelecting("end");
      } else {
        setEnd({ lat, lng, name });
        setEndQuery(name);
      }
    }
  };

  const compare = async () => {
    setError(null);
    setResult(null);
    setRouteGeometry([]);
    setRoutes([]);
    if (!start || !end) { setError("Veuillez choisir un départ et une destination."); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_lat: String(start.lat),
        start_lng: String(start.lng),
        end_lat: String(end.lat),
        end_lng: String(end.lng),
        route_id: String(selectedRouteId),
      });
      const resp = await fetch(`/api/compare?${params.toString()}`);
      if (!resp.ok) throw new Error(`Erreur réseau ${resp.status}`);
      const data = await resp.json();
      if (!data || !data.success) throw new Error("Réponse invalide.");
      setResult(data);
      if (data.routes) setRoutes(data.routes);
      if (data.selected_route?.geometry?.coordinates) {
        setRouteGeometry(data.selected_route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]));
      }
    } catch (err: any) {
      setError(err?.message || "Impossible de récupérer les résultats.");
    } finally {
      setLoading(false);
    }
  };

  const selectRoute = async (routeId: number) => {
    setSelectedRouteId(routeId);
    if (!start || !end) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_lat: String(start.lat),
        start_lng: String(start.lng),
        end_lat: String(end.lat),
        end_lng: String(end.lng),
        route_id: String(routeId),
      });
      const resp = await fetch(`/api/compare?${params.toString()}`);
      const data = await resp.json();
      if (data.success) {
        setResult(data);
        if (data.selected_route?.geometry?.coordinates) {
          setRouteGeometry(data.selected_route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]));
        }
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const resetSearch = () => {
    setStart(null);
    setEnd(null);
    setStartQuery("");
    setEndQuery("");
    setStartSuggestions([]);
    setEndSuggestions([]);
    setResult(null);
    setError(null);
    setRouteGeometry([]);
    setRoutes([]);
    setSelectedRouteId(1);
    setSelecting("start");
  };

  const results = Array.isArray(result?.results) ? result.results : [];
  const bestPrice = result?.best_price;

  return (
    <main className="page">
      <Header onReset={resetSearch} hasResult={!!result} />

      <div className="container">
        <SearchForm
          startQuery={startQuery}
          endQuery={endQuery}
          startSuggestions={startSuggestions}
          endSuggestions={endSuggestions}
          selecting={selecting}
          loading={loading}
          error={error}
          onStartChange={setStartQuery}
          onEndChange={setEndQuery}
          onSelectStart={selectStart}
          onSelectEnd={selectEnd}
          onSelecting={setSelecting}
          onCompare={compare}
        />

        <div className="card">
          <Map start={start} end={end} routeGeometry={routeGeometry} onMapClick={handleMapClick} />
        </div>

        <RouteSelector routes={routes} selectedId={selectedRouteId} onSelect={selectRoute} />

        {result && (
          <>
            <TripSummary
              distance={result.route?.distance_km}
              duration={result.route?.duration_min}
              startName={start?.name}
              endName={end?.name}
            />

            {bestPrice && (
              <BestPriceCard
                provider={bestPrice.provider}
                category={bestPrice.category}
                price={bestPrice.price}
                currency={bestPrice.currency}
              />
            )}

            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
                Comparaison
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 16 }}>Les offres disponibles</h2>

              {results.map((r: any, i: number) => (
                <OfferCard key={i} offer={r} index={i} route={result.route} />
              ))}
            </div>

            {result.pricing?.message && (
              <div className="disclaimer">ℹ️ {result.pricing.message}</div>
            )}
          </>
        )}

        <footer className="disclaimer" style={{ marginTop: 24 }}>
          ICEBERG · Comparateur de transport à Abidjan
        </footer>
      </div>
    </main>
  );
                                                                 }
