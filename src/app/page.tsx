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
  
  // NOUVEAU : Gestion des 2 chemins
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(1);

  const startTimeout = useRef<NodeJS.Timeout | null>(null);
  const endTimeout = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // RECHERCHE DÉPART
  // ============================================================

  useEffect(() => {
    if (startTimeout.current) clearTimeout(startTimeout.current);
    if (startQuery.length < 3) {
      setStartSuggestions([]);
      return;
    }
    startTimeout.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(startQuery);
        setStartSuggestions(results);
      } catch (err) {
        console.error(err);
        setStartSuggestions([]);
      }
    }, 400);
    return () => {
      if (startTimeout.current) clearTimeout(startTimeout.current);
    };
  }, [startQuery]);

  // ============================================================
  // RECHERCHE ARRIVÉE
  // ============================================================

  useEffect(() => {
    if (endTimeout.current) clearTimeout(endTimeout.current);
    if (endQuery.length < 3) {
      setEndSuggestions([]);
      return;
    }
    endTimeout.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(endQuery);
        setEndSuggestions(results);
      } catch (err) {
        console.error(err);
        setEndSuggestions([]);
      }
    }, 400);
    return () => {
      if (endTimeout.current) clearTimeout(endTimeout.current);
    };
  }, [endQuery]);

  // ============================================================
  // SÉLECTIONS
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
        setStart({ lat, lng, name });
        setStartQuery(name);
        setSelecting("end");
      } else {
        setEnd({ lat, lng, name });
        setEndQuery(name);
      }
    } catch (err) {
      console.error(err);
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

    if (!start || !end) {
      setError("Veuillez choisir un point de départ et une destination.");
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch(
        `/api/compare?start_lat=${start.lat}&start_lng=${start.lng}&end_lat=${end.lat}&end_lng=${end.lng}&route_id=${selectedRouteId}`
      );

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Erreur réseau ${resp.status}: ${txt}`);
      }

      const data = await resp.json();

      if (!data || !data.success) {
        setError("Réponse invalide du serveur.");
        setResult(data);
        return;
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
      setError(err.message ?? "Erreur lors de l'appel API.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // CHANGER DE CHEMIN
  // ============================================================

  async function selectRoute(routeId: number) {
    setSelectedRouteId(routeId);
    
    // Re-fait la comparaison avec le nouveau chemin
    if (start && end) {
      setLoading(true);
      try {
        const resp = await fetch(
          `/api/compare?start_lat=${start.lat}&start_lng=${start.lng}&end_lat=${end.lat}&end_lng=${end.lng}&route_id=${routeId}`
        );
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
  }

  return (
    <main className="min-h-screen bg-gray-50">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="bg-gray-950 px-5 py-6 text-white">
        <h1 className="text-3xl font-bold tracking-wide">ICEBERG</h1>
        <p className="mt-1 text-sm text-gray-400">
          Comparez les prix de transport à Abidjan
        </p>
      </header>

      <section className="mx-auto max-w-3xl p-5">

        {/* ====================================================
            FORMULAIRE
        ==================================================== */}

        <div className="rounded-2xl bg-white p-5 shadow-sm">

          {/* DÉPART */}
          <div className="relative mb-4">
            <label className="mb-2 block font-semibold">📍 Départ</label>
            <input
              value={startQuery}
              onChange={(e) => setStartQuery(e.target.value)}
              onFocus={() => setSelecting("start")}
              type="text"
              placeholder="Ex: Cocody Angré, Plateau..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500"
            />
            {startSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-white shadow-lg">
                {startSuggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => selectStart(s)}
                    className="cursor-pointer border-b px-4 py-3 text-sm last:border-0 hover:bg-gray-100"
                  >
                    {s.displayName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ARRIVÉE */}
          <div className="relative mb-4">
            <label className="mb-2 block font-semibold">🎯 Destination</label>
            <input
              value={endQuery}
              onChange={(e) => setEndQuery(e.target.value)}
              onFocus={() => setSelecting("end")}
              type="text"
              placeholder="Ex: Zone 4, Aéroport..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500"
            />
            {endSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-white shadow-lg">
                {endSuggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => selectEnd(s)}
                    className="cursor-pointer border-b px-4 py-3 text-sm last:border-0 hover:bg-gray-100"
                  >
                    {s.displayName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* SÉLECTION CARTE */}
          <div className="mb-4 flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSelecting("start")}
              className={`flex-1 rounded-lg px-3 py-2 ${
                selecting === "start" ? "bg-green-600 text-white" : "bg-gray-100"
              }`}
            >
              Cliquer départ
            </button>
            <button
              type="button"
              onClick={() => setSelecting("end")}
              className={`flex-1 rounded-lg px-3 py-2 ${
                selecting === "end" ? "bg-red-600 text-white" : "bg-gray-100"
              }`}
            >
              Cliquer arrivée
            </button>
          </div>

          {/* BOUTON */}
          <button
            onClick={compare}
            disabled={loading}
            className="w-full rounded-xl bg-gray-950 p-4 font-bold text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Comparaison..." : "Comparer les prix"}
          </button>

          {/* ERREUR */}
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-4 font-medium text-red-600">
              {error}
            </div>
          )}

        </div>

        {/* ====================================================
            CARTE
        ==================================================== */}

        <div className="mt-5 overflow-hidden rounded-2xl shadow-sm">
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
          <div className="mt-5 grid grid-cols-2 gap-3">
            {routes.map((route) => (
              <button
                key={route.id}
                onClick={() => selectRoute(route.id)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  selectedRouteId === route.id
                    ? "border-gray-950 bg-gray-100"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="font-bold">{route.label}</div>
                <div className="text-sm text-gray-500">
                  📏 {route.distance_km} km • ⏱ {route.duration_min} min
                </div>
                {route.is_shortest && (
                  <span className="text-xs text-green-600">📍 Plus court</span>
                )}
                {route.is_fastest && (
                  <span className="text-xs text-blue-600">⚡ Plus rapide</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ====================================================
            RÉSULTATS
        ==================================================== */}

        {result && (
          <div className="mt-6 space-y-5">

            {/* RÉSUMÉ TRAJET */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">Résultat du trajet</h2>
              <div className="space-y-2 text-sm">
                <div><strong>📍 Départ :</strong> {start?.name}</div>
                <div><strong>🎯 Arrivée :</strong> {end?.name}</div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Distance</div>
                  <div className="mt-1 text-lg font-bold">
                    {result.route?.distance_km ?? "—"} km
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Durée</div>
                  <div className="mt-1 text-lg font-bold">
                    {result.route?.duration_min ?? "—"} min
                  </div>
                </div>
              </div>
            </div>

            {/* MEILLEUR PRIX */}
            <div className="rounded-2xl bg-gray-950 p-5 text-white shadow-sm">
              <div className="text-sm text-gray-400">Meilleur prix estimé</div>
              {result.best_price ? (
                <>
                  <div className="mt-2 text-2xl font-bold">
                    {result.best_price.price} {result.best_price.currency}
                  </div>
                  <div className="mt-1 text-sm text-gray-300">
                    {result.best_price.provider} — {result.best_price.category}
                  </div>
                </>
              ) : (
                <div className="mt-2">Aucun résultat</div>
              )}
            </div>

            {/* OFFRES VTC */}
            <div>
              <h2 className="mb-4 text-xl font-bold">Comparaison des services</h2>
              <div className="space-y-5">
                {Array.isArray(result.results) && result.results.length ? (
                  result.results.map((r: any, i: number) => {
                    const analysis = r.price_analysis;
                    const events = analysis?.events_detected ?? [];
                    const scenarios = analysis?.scenarios ?? [];
                    const combined = analysis?.combined_scenario;

                    return (
                      <div key={i} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                        {/* EN-TÊTE SERVICE */}
                        <div className="border-b p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold">{r.provider}</h3>
                                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                                  {r.category}
                                </span>
                                {r.recommendation && (
                                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                    ⭐ Recommandé
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 text-sm text-gray-500">
                                🕐 Chauffeur disponible : {r.eta_minutes ?? "—"} min
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                {r.price} {r.currency}
                              </div>
                              {r.difference_from_cheapest_percent !== undefined && (
                                <div className="text-sm text-gray-500">
                                  +{r.difference_from_cheapest_percent}%
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* TRAJET */}
                        <div className="border-b p-5">
                          <h4 className="mb-3 font-semibold">🚗 Trajet</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-gray-50 p-3">
                              <div className="text-xs text-gray-500">Distance</div>
                              <div className="font-semibold">
                                {result.route?.distance_km ?? "—"} km
                              </div>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                              <div className="text-xs text-gray-500">Durée</div>
                              <div className="font-semibold">
                                {result.route?.duration_min ?? "—"} min
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ÉVÉNEMENTS DÉTECTÉS */}
                        <div className="border-b p-5">
                          <h4 className="mb-3 font-semibold">📊 Éléments pouvant influencer le prix</h4>
                          {events.length > 0 ? (
                            <div className="space-y-3">
                              {events.map((event: any, eventIndex: number) => (
                                <div key={eventIndex} className="rounded-xl bg-gray-50 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium">{event.label}</div>
                                    <div className="font-bold text-orange-600">
                                      +{event.impact_percent}%
                                    </div>
                                  </div>
                                  {event.reason && (
                                    <div className="mt-1 text-sm text-gray-500">
                                      {event.reason}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
                              Aucun événement particulier détecté. Le prix affiché correspond aux conditions normales estimées.
                            </div>
                          )}
                        </div>

                        {/* SCÉNARIOS */}
                        <div className="border-b p-5">
                          <h4 className="mb-3 font-semibold">🔮 Si ces événements se produisent</h4>
                          {scenarios.length > 0 ? (
                            <div className="space-y-3">
                              {scenarios.map((scenario: any, scenarioIndex: number) => (
                                <div key={scenarioIndex} className="flex items-center justify-between rounded-xl border p-4">

                                  <div>
                                    <div className="font-medium">{scenario.event}</div>
                                    <div className="text-sm text-gray-500">
                                      Impact potentiel : +{scenario.impact_percent}%
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold">
                                      {scenario.price} {scenario.currency}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">Aucun scénario particulier.</div>
                          )}
                        </div>

                        {/* SCÉNARIO COMBINÉ */}
                        {combined && (
                          <div className="border-b p-5">
                            <h4 className="mb-3 font-semibold">📈 Scénario combiné</h4>
                            <div className="rounded-xl bg-orange-50 p-4">
                              <div className="text-sm text-gray-600">Impact maximal estimé :</div>
                              <div className="mt-1 text-xl font-bold text-orange-700">
                                +{combined.total_impact_percent}%
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <div>
                                  <div className="text-xs text-gray-500">Prix normal</div>
                                  <div className="font-semibold">{combined.minimum_price} FCFA</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">Prix potentiel</div>
                                  <div className="font-semibold">{combined.maximum_price} FCFA</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* CONFIANCE */}
                        <div className="p-5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Niveau de confiance</span>
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                              {analysis?.confidence ?? r.confidence ?? "medium"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
            <div className="rounded-2xl bg-white p-5 text-gray-500 shadow-sm">
                    Aucune offre disponible.
                  </div>
                )}
              </div>
            </div>

            {/* MESSAGE PRIX */}
            {result.pricing?.message && (
              <div className="rounded-xl bg-gray-100 p-4 text-xs text-gray-500">
                {result.pricing.message}
              </div>
            )}

          </div>
        )}

      </section>

    </main>
  );
}
