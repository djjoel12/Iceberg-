"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  searchPlaces,
  reverseGeocode,
  GeoResult,
} from "../lib/geocode";

const Map = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center bg-slate-100">
      <div className="text-sm text-slate-500">
        Chargement de la carte...
      </div>
    </div>
  ),
});

type Point = {
  lat: number;
  lng: number;
  name: string;
};

type EventItem = {
  type?: string;
  label?: string;
  impact_percent?: number;
  reason?: string;
};

type Scenario = {
  event?: string;
  impact_percent?: number;
  price?: number;
  currency?: string;
  reason?: string;
};

type ResultItem = {
  provider: string;
  category: string;
  price: number;
  currency: string;
  eta_minutes?: number;
  recommendation?: boolean;
  difference_from_cheapest_percent?: number;
  confidence?: string;

  price_analysis?: {
    reference_price?: number;
    currency?: string;
    events_detected?: EventItem[];
    scenarios?: Scenario[];

    combined_scenario?: {
      total_impact_percent?: number;
      minimum_price?: number;
      maximum_price?: number;
      currency?: string;
    };

    message?: string;
  };
};

type Route = {
  id: number;
  label: string;
  distance_km: number;
  duration_min: number;
  geometry?: any;
  is_shortest?: boolean;
  is_fastest?: boolean;
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
  const [openDetails, setOpenDetails] = useState<number | null>(null);

  // ============================================================
  // NOUVEAU : Gestion des 2 chemins
  // ============================================================

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(1);

  const startTimeout = useRef<NodeJS.Timeout | null>(null);
  const endTimeout = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // RECHERCHE DEPART
  // ============================================================

  useEffect(() => {
    if (startTimeout.current) {
      clearTimeout(startTimeout.current);
    }

    if (startQuery.length < 3) {
      setStartSuggestions([]);
      return;
    }

    startTimeout.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(startQuery);
        setStartSuggestions(results);
      } catch {
        setStartSuggestions([]);
      }
    }, 400);

    return () => {
      if (startTimeout.current) {
        clearTimeout(startTimeout.current);
      }
    };
  }, [startQuery]);

  // ============================================================
  // RECHERCHE ARRIVEE
  // ============================================================

  useEffect(() => {
    if (endTimeout.current) {
      clearTimeout(endTimeout.current);
    }

    if (endQuery.length < 3) {
      setEndSuggestions([]);
      return;
    }

    endTimeout.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(endQuery);
        setEndSuggestions(results);
      } catch {
        setEndSuggestions([]);
      }
    }, 400);

    return () => {
      if (endTimeout.current) {
        clearTimeout(endTimeout.current);
      }
    };
  }, [endQuery]);

  // ============================================================
  // SELECTION DEPART
  // ============================================================

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

  // ============================================================
  // SELECTION ARRIVEE
  // ============================================================

  function selectEnd(place: GeoResult) {
    setEnd({
      lat: place.lat,
      lng: place.lng,
      name: place.displayName,
    });

    setEndQuery(place.displayName);
    setEndSuggestions([]);
  }

  // ============================================================
  // CLIC SUR LA CARTE
  // ============================================================

  async function handleMapClick(lat: number, lng: number) {
    try {
      const name = await reverseGeocode(lat, lng);

      if (selecting === "start") {
        setStart({
          lat,
          lng,
          name,
        });

        setStartQuery(name);
        setSelecting("end");
      } else {
        setEnd({
          lat,
          lng,
          name,
        });

        setEndQuery(name);
      }
    } catch {
      const name = "Position sélectionnée";

      if (selecting === "start") {
        setStart({
          lat,
          lng,
          name,
        });

        setStartQuery(name);
        setSelecting("end");
      } else {
        setEnd({
          lat,
          lng,
          name,
        });

        setEndQuery(name);
      }
    }
  }

  // ============================================================
  // COMPARAISON
  // ============================================================

  async function compare() {
    setError(null);
    setResult(null);
    setRouteGeometry([]);
    setRoutes([]);
    setOpenDetails(null);
    setSelectedRouteId(1);

    if (!start || !end) {
      setError("Veuillez choisir un départ et une destination.");
      return;
    }

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

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Erreur réseau ${resp.status}: ${txt}`);
      }

      const data = await resp.json();

      if (!data || !data.success) {
        throw new Error("Réponse invalide du serveur.");
      }

      setResult(data);

      // Sauvegarde les chemins disponibles
      if (data.routes) {
        setRoutes(data.routes);
      }

      // Sélectionne le chemin actif
      if (data.selected_route?.geometry?.coordinates) {
        const coords = data.selected_route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]] as [number, number]
        );
        setRouteGeometry(coords);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Impossible de récupérer les résultats.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // CHANGER DE CHEMIN
  // ============================================================

  async function selectRoute(routeId: number) {
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
          const coords = data.selected_route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number]
          );
          setRouteGeometry(coords);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // RESET
  // ============================================================

  function resetSearch() {
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
    setOpenDetails(null);
    setSelectedRouteId(1);
    setSelecting("start");
  }

  const results: ResultItem[] = Array.isArray(result?.results) ? result.results : [];
  const bestPrice = result?.best_price;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">

          <div>
            <div className="text-2xl font-black tracking-tight">
              ICEBERG
            </div>

            <div className="text-xs text-slate-400">
              Comparez avant de partir
            </div>
          </div>

          {result && (
            <button
              onClick={resetSearch}
              className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Nouveau trajet
            </button>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-5">

        {/* ====================================================
            FORMULAIRE
        ==================================================== */}

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">

          <div className="p-4 sm:p-6">

            {/* DEPART */}

            <div className="relative mb-3">

              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Départ
              </label>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-slate-900 focus-within:bg-white">

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  📍
                </div>

                <input
                  value={startQuery}
                  onChange={(e) => setStartQuery(e.target.value)}
                  onFocus={() => setSelecting("start")}
                  type="text"
                  placeholder="Où partez-vous ?"
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                />

              </div>

              {startSuggestions.length > 0 && (
                <ul className="absolute left-0 right-0 z-40 mt-2 max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {startSuggestions.map((s, i) => (
                    <li
                      key={i}
                      onClick={() => selectStart(s)}
                      className="cursor-pointer border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50"
                    >
                      {s.displayName}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* DESTINATION */}

            <div className="relative mb-4">

              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Destination
              </label>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-slate-900 focus-within:bg-white">

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                  🎯
                </div>

                <input
                  value={endQuery}
                  onChange={(e) => setEndQuery(e.target.value)}
                  onFocus={() => setSelecting("end")}
                  type="text"
                  placeholder="Où allez-vous ?"
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                />

              </div>

              {endSuggestions.length > 0 && (
                <ul className="absolute left-0 right-0 z-40 mt-2 max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {endSuggestions.map((s, i) => (
                    <li
                      key={i}
                      onClick={() => selectEnd(s)}
                      className="cursor-pointer border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50"
                    >
                      {s.displayName}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* MODE CARTE */}

            <div className="mb-4 grid grid-cols-2 gap-2">

              <button
                type="button"
                onClick={() => setSelecting("start")}
                className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  selecting === "start"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                📍 Choisir départ
              </button>

              <button
                type="button"
                onClick={() => setSelecting("end")}
                className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  selecting === "end"
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🎯 Choisir arrivée
              </button>

            </div>

            {/* BOUTON */}

            <button
              onClick={compare}
              disabled={loading}
              className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Analyse du trajet..." : "Comparer les prix"}
            </button>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

          </div>

        </div>

        {/* ====================================================
            CARTE
        ==================================================== */}

        <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <Map
            start={start}
            end={end}
            routeGeometry={routeGeometry}
            onMapClick={handleMapClick}
          />
        </div>

        {/* ====================================================
            SÉLECTION DES CHEMINS (NOUVEAU)
        ==================================================== */}

        {routes.length > 1 && (
          <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                Choisissez votre itinéraire
              </div>
              <div className="grid grid-cols-2 gap-3">
                {routes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => selectRoute(route.id)}
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      selectedRouteId === route.id
                        ? "border-slate-900 bg-slate-100"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-bold">{route.label}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      📏 {route.distance_km} km • ⏱ {route.duration_min} min
                    </div>
                    <div className="mt-2 flex gap-2">
                      {route.is_shortest && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          📍 Plus court
                        </span>
                      )}
                      {route.is_fastest && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          ⚡ Plus rapide
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            RESULTATS
        ==================================================== */}

        {result && (
          <div className="mt-6 space-y-5">

            {/* TRAJET */}

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">

              <div className="mb-4 flex items-center justify-between">

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Votre trajet
                  </div>

                  <h2 className="mt-1 text-lg font-black">
                    Comparaison des prix
                  </h2>
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Distance</div>
                  <div className="mt-1 text-xl font-black">
                    {result.route?.distance_km ?? "—"} km
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Durée</div>
                  <div className="mt-1 text-xl font-black">
                    {result.route?.duration_min ?? "—"} min
                  </div>
                </div>

              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-500">

                <div className="flex gap-2">
                  <span>📍</span>
                  <span className="line-clamp-2">{start?.name}</span>
                </div>

                <div className="flex gap-2">
                  <span>🎯</span>
                  <span className="line-clamp-2">{end?.name}</span>
                </div>

              </div>

            </div>

            
            {/* =================================================
                MEILLEUR PRIX
            ================================================= */}

            {bestPrice && (
              <div className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-xl">

                <div className="mb-4 flex items-center justify-between">

                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-emerald-400">
                      ⭐ Meilleure offre
                    </div>

                    <div className="mt-1 text-xl font-black">
                      {bestPrice.provider}
                    </div>

                    <div className="text-sm text-slate-400">
                      {bestPrice.category}
                    </div>
                  </div>

                  <div className="text-right">

                    <div className="text-3xl font-black">
                      {bestPrice.price}
                    </div>

                    <div className="text-xs font-bold text-slate-400">
                      {bestPrice.currency}
                    </div>

                  </div>

                </div>

                <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
                  ICEBERG recommande cette offre parmi les prix actuellement estimés.
                </div>

              </div>
            )}

            {/* =================================================
                COMPARAISON
            ================================================= */}

            <div>

              <div className="mb-3 px-1">

                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Comparaison
                </div>

                <h2 className="mt-1 text-xl font-black">
                  Les offres disponibles
                </h2>

              </div>

              <div className="space-y-3">

                {results.map((r, i) => {

                const analysis = r.price_analysis;
                  const events = analysis?.events_detected || [];
                  const scenarios = analysis?.scenarios || [];
                  const combined = analysis?.combined_scenario;
                  const isOpen = openDetails === i;

                  return (
                    <div
                      key={`${r.provider}-${r.category}-${i}`}
                      className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 transition ${
                        r.recommendation ? "ring-emerald-300" : "ring-slate-200"
                      }`}
                    >

                      {/* CARTE PRINCIPALE */}

                      <div className="p-4">

                        <div className="flex items-start justify-between gap-4">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <h3 className="font-black">
                                {r.provider}
                              </h3>

                              {r.recommendation && (
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
                                  MEILLEUR PRIX
                                </span>
                              )}

                            </div>

                            <div className="mt-1 text-sm text-slate-500">
                              {r.category}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">

                              {r.eta_minutes != null && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                  🕐 {r.eta_minutes} min
                                </span>
                              )}

                              {r.difference_from_cheapest_percent != null && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                  +{r.difference_from_cheapest_percent}% vs meilleur
                                </span>
                              )}

                            </div>
                              </div>

                          <div className="shrink-0 text-right">

                            <div className="text-2xl font-black">
                              {r.price}
                            </div>

                            <div className="text-xs font-bold text-slate-400">
                              {r.currency}
                            </div>

                          </div>

                        </div>

                        <button
                          onClick={() => setOpenDetails(isOpen ? null : i)}
                          className="mt-4 flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold transition hover:bg-slate-100"
                        >

                          <span>
                            {isOpen ? "Masquer les détails" : "Pourquoi ce prix ?"}
                          </span>

                          <span>{isOpen ? "⌃" : "⌄"}</span>

                        </button>

                      </div>

                      {/* =================================================
                          DETAILS
                      ================================================= */}

                      {isOpen && (
                        <div className="border-t border-slate-100 bg-slate-50 p-4">

                          {/* TRAJET */}

                          <div className="mb-5">

                            <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
                              Données du trajet
                            </div>

                            <div className="grid grid-cols-2 gap-3">

                              <div className="rounded-2xl bg-white p-3">
                                <div className="text-xs text-slate-400">Distance</div>
                                <div className="mt-1 font-black">
                                  {result.route?.distance_km} km
                                </div>
                              </div>

                              <div className="rounded-2xl bg-white p-3">
                                <div className="text-xs text-slate-400">Durée</div>
                                <div className="mt-1 font-black">
                                  {result.route?.duration_min} min
                                </div>
                              </div>

                            </div>
                            </div>

                          {/* FACTEURS */}

                          <div className="mb-5">

                            <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
                              Éléments détectés
                            </div>

                            {events.length > 0 ? (

                              <div className="space-y-2">

                                {events.map((event, eventIndex) => (
                                  <div key={eventIndex} className="rounded-2xl bg-white p-4">

                                    <div className="flex items-center justify-between gap-3">

                                      <div className="font-bold">
                                        {event.label}
                                      </div>

                                      <div className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                                        +{event.impact_percent}%
                                      </div>

                                    </div>

                                    {event.reason && (
                                      <div className="mt-2 text-xs leading-5 text-slate-500">
                                        {event.reason}
                                      </div>
                                    )}

                                  </div>
                                ))}

                              </div>

                            ) : (

                              <div className="rounded-2xl bg-white p-4 text-sm text-slate-500">
                                Aucun événement particulier détecté.
                              </div>

                            )}

                          </div>

                          {/* SCENARIOS */}

                          {scenarios.length > 0 && (
                            <div className="mb-5">

                              <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
                                Si ces événements se produisent
                              </div>

                              <div className="space-y-2">


                                {scenarios.map((scenario, scenarioIndex) => (
                                  <div
                                    key={scenarioIndex}
                                    className="flex items-center justify-between rounded-2xl bg-white p-4"
                                  >

                                    <div>
                                      <div className="text-sm font-bold">
                                        {scenario.event}
                                      </div>

                                      <div className="mt-1 text-xs text-slate-400">
                                        +{scenario.impact_percent}%
                                      </div>
                                    </div>

                                    <div className="text-right">

                                      <div className="font-black">
                                        {scenario.price} {scenario.currency}
                                      </div>

                                      <div className="text-[10px] text-slate-400">
                                        prix potentiel
                                      </div>

                                    </div>

                                  </div>
                                ))}

                              </div>

                            </div>
                          )}

                          {/* SCENARIO COMBINE */}

                          {combined && (
                            <div className="rounded-3xl bg-white p-5 ring-1 ring-orange-200">

                              <div className="text-xs font-black uppercase tracking-widest text-orange-600">
                                📈 Scénario combiné
                              </div>

                              <div className="mt-4 flex items-end justify-between gap-3">

                                <div>
                                  <div className="text-xs text-slate-400">Prix normal</div>
                                  <div className="text-2xl font-black">
                                    {combined.minimum_price} {combined.currency}
                                  </div>
                                </div>

                                <div className="pb-2 text-xl text-slate-300">→</div>

                                <div className="text-right">


                                  
                                  <div className="text-xs text-slate-400">Prix potentiel</div>

                                  <div className="text-2xl font-black text-orange-600">
                                    {combined.maximum_price} {combined.currency}
                                  </div>

                                </div>

                              </div>

                              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">

                                <div
                                  className="h-full rounded-full bg-orange-500"
                                  style={{
                                    width: `${Math.min(combined.total_impact_percent || 0, 100)}%`,
                                  }}
                                />

                              </div>

                              <div className="mt-2 text-xs text-slate-500">
                                Impact potentiel total :{" "}
                                <strong>+{combined.total_impact_percent}%</strong>
                              </div>

                            </div>
                          )}

                          {/* CONFIANCE */}

                          {r.confidence && (
                            <div className="mt-4 text-center text-xs text-slate-400">
                              Niveau de confiance :{" "}
                              <strong className="text-slate-600">{r.confidence}</strong>
                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  );
                })}

              </div>

            </div>

            {/* =================================================
                MESSAGE
            ================================================= */}

            {result.pricing?.message && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
                ℹ️ {result.pricing.message}
              </div>
            )}

          </div>
        )}
        </section>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="mx-auto max-w-5xl px-4 pb-8 pt-4 text-center text-xs text-slate-400">
        ICEBERG · Comparateur de transports à Abidjan
      </footer>

    </main>
  );
}
