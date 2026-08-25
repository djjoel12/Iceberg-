"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { searchPlaces, reverseGeocode, GeoResult } from "../lib/geocode";

const Map = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-2xl bg-gray-200">
      Chargement de la carte...
    </div>
  ),
});

type Point = {
  lat: number;
  lng: number;
  name: string;
};

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

  const startTimeout = useRef<NodeJS.Timeout | null>(null);
  const endTimeout = useRef<NodeJS.Timeout | null>(null);

  // Recherche départ
  useEffect(() => {
    if (startTimeout.current) clearTimeout(startTimeout.current);

    if (startQuery.length < 3) {
      setStartSuggestions([]);
      return;
    }

    startTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(startQuery);
      setStartSuggestions(results);
    }, 400);

    return () => {
      if (startTimeout.current) clearTimeout(startTimeout.current);
    };
  }, [startQuery]);

  // Recherche arrivée
  useEffect(() => {
    if (endTimeout.current) clearTimeout(endTimeout.current);

    if (endQuery.length < 3) {
      setEndSuggestions([]);
      return;
    }

    endTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(endQuery);
      setEndSuggestions(results);
    }, 400);

    return () => {
      if (endTimeout.current) clearTimeout(endTimeout.current);
    };
  }, [endQuery]);

  function selectStart(place: GeoResult) {
    setStart({
      lat: place.lat,
      lng: place.lng,
      name: place.displayName,
    });
    setStartQuery(place.displayName);
    setStartSuggestions([]);
    setSelecting("end");
  }

  function selectEnd(place: GeoResult) {
    setEnd({
      lat: place.lat,
      lng: place.lng,
      name: place.displayName,
    });
    setEndQuery(place.displayName);
    setEndSuggestions([]);
  }

  async function handleMapClick(lat: number, lng: number) {
    const name = await reverseGeocode(lat, lng);

    if (selecting === "start") {
      setStart({ lat, lng, name });
      setStartQuery(name);
      setSelecting("end");
    } else {
      setEnd({ lat, lng, name });
      setEndQuery(name);
    }
  }

  async function compare() {
    setError(null);
    setResult(null);
    setRouteGeometry([]);

    if (!start || !end) {
      setError("Veuillez choisir un point de départ et une destination.");
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch(
        `/api/compare?start_lat=\( {start.lat}&start_lng= \){start.lng}&end_lat=\( {end.lat}&end_lng= \){end.lng}`
      );

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Erreur réseau ${resp.status}: ${txt}`);
      }

      const data = await resp.json();

      if (!data || !data.success) {
        setError("Réponse invalide du serveur.");
        setResult(data);
      } else {
        setResult(data);

        // Convertir GeoJSON [lng, lat] → Leaflet [lat, lng]
        if (data.route?.geometry?.coordinates) {
          const coords = data.route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number]
          );
          setRouteGeometry(coords);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Erreur lors de l'appel API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-gray-950 px-5 py-6 text-white">
        <h1 className="text-3xl font-bold tracking-wide">ICEBERG</h1>
        <p className="mt-1 text-sm text-gray-400">
          Comparez les prix de transport à Abidjan
        </p>
      </header>

      <section className="mx-auto max-w-3xl p-5">
        {/* Formulaire */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {/* Départ */}
          <div className="mb-4 relative">
            <label className="mb-2 block font-semibold">
              📍 Départ
            </label>
            <input
              value={startQuery}
              onChange={(e) => setStartQuery(e.target.value)}
              onFocus={() => setSelecting("start")}
              type="text"
              placeholder="Ex: Cocody Angré, Plateau..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500"
            />
            {startSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-48 overflow-auto">
                {startSuggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => selectStart(s)}
                    className="cursor-pointer px-4 py-3 hover:bg-gray-100 text-sm border-b last:border-0"
                  >
                    {s.displayName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Arrivée */}
          <div className="mb-4 relative">
            <label className="mb-2 block font-semibold">
              🎯 Destination
            </label>
            <input
              value={endQuery}
              onChange={(e) => setEndQuery(e.target.value)}
              onFocus={() => setSelecting("end")}
              type="text"
              placeholder="Ex: Zone 4, Aéroport..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500"
            />
            {endSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-48 overflow-auto">
                {endSuggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => selectEnd(s)}
                    className="cursor-pointer px-4 py-3 hover:bg-gray-100 text-sm border-b last:border-0"
                  >
                    {s.displayName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mode sélection carte */}
          <div className="mb-4 flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSelecting("start")}
              className={`flex-1 rounded-lg px-3 py-2 ${
                selecting === "start"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100"
              }`}
            >
              Cliquer départ
            </button>
            <button
              type="button"
              onClick={() => setSelecting("end")}
              className={`flex-1 rounded-lg px-3 py-2 ${
                selecting === "end"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100"
              }`}
            >
              Cliquer arrivée
            </button>
          </div>

          <button
            onClick={compare}
            disabled={loading}
            className="w-full rounded-xl bg-gray-950 p-4 font-bold text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Comparaison..." : "Comparer les prix"}
          </button>

          {error && (
            <div className="mt-4 text-red-600 font-medium">Erreur : {error}</div>
          )}
        </div>

        {/* Carte */}
        <div className="mt-5 overflow-hidden rounded-2xl shadow-sm">
          <Map
            start={start}
            end={end}
            routeGeometry={routeGeometry}
            onMapClick={handleMapClick}
          />
        </div>

        {/* Résultats */}
        <div className="mt-6">
          {result && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold mb-3">Résultat</h2>

              <div className="mb-4 text-sm text-gray-600">
                <div>
                  <strong>Départ :</strong> {start?.name}
                </div>
                <div>
                  <strong>Arrivée :</strong> {end?.name}
                </div>
              </div>

              <div className="mb-4">
                <strong>Trajet :</strong>
                <div>Distance : {result.route?.distance_km ?? "—"} km</div>
                <div>Durée : {result.route?.duration_min ?? "—"} min</div>
              </div>

              <div className="mb-4">
                <strong>Meilleur prix :</strong>
                {result.best_price ? (
                  <div>
                    {result.best_price.provider} — {result.best_price.category} :{" "}
                    {result.best_price.price} {result.best_price.currency}
                  </div>
                ) : (
                  <div>Aucun résultat</div>
                )}
              </div>

              <div>
                <strong>Offres :</strong>
                <ul className="mt-2 space-y-2">
                  {Array.isArray(result.results) && result.results.length ? (
                    result.results.map((r: any, i: number) => (
                      <li key={i} className="p-3 border rounded-lg">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-semibold">
                              {r.provider} — {r.category}
                              {r.recommendation && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  Recommandé
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              ETA: {r.eta_minutes} min
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">
                              {r.price} {r.currency}
                            </div>
                            <div className="text-sm text-gray-500">
                              +{r.difference_from_cheapest_percent}%
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>Aucune offre</li>
                  )}
                </ul>
              </div>

              {result.pricing?.message && (
                <p className="mt-4 text-xs text-gray-500">
                  {result.pricing.message}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
    }
