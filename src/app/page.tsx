"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Map = dynamic(
  () => import("../components/Map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-gray-200">
        Chargement de la carte...
      </div>
    ),
  }
);

export default function Home() {
  const [loading, setLoading] = useState(false);

  // contrôles pour coordonnées (strings pour faciliter la saisie)
  const [startLat, setStartLat] = useState("5.3364");
  const [startLng, setStartLng] = useState("-4.0267");
  const [endLat, setEndLat] = useState("5.3600");
  const [endLng, setEndLng] = useState("-4.0150");

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function compare() {
    setError(null);
    setResult(null);

    const sLat = parseFloat(startLat);
    const sLng = parseFloat(startLng);
    const eLat = parseFloat(endLat);
    const eLng = parseFloat(endLng);

    if (
      Number.isNaN(sLat) ||
      Number.isNaN(sLng) ||
      Number.isNaN(eLat) ||
      Number.isNaN(eLng)
    ) {
      setError("Veuillez saisir des coordonnées valides (lat/lng).");
      return;
    }

    setLoading(true);

    try {
      // Appel via le proxy Next.js (même origine) — en dev, BACKEND_URL doit pointer vers http://localhost:8000
      const resp = await fetch(
        `/api/compare?start_lat=${sLat}&start_lng=${sLng}&end_lat=${eLat}&end_lng=${eLng}`
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
        <p className="mt-1 text-sm text-gray-400">Comparez les prix de transport à Abidjan</p>
      </header>

      <section className="mx-auto max-w-3xl p-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block font-semibold">📍 Départ (lat)</label>
              <input value={startLat} onChange={(e)=>setStartLat(e.target.value)}
                type="text" placeholder="Latitude"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="mb-2 block font-semibold">📍 Départ (lng)</label>
              <input value={startLng} onChange={(e)=>setStartLng(e.target.value)}
                type="text" placeholder="Longitude"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500" />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block font-semibold">🎯 Destination (lat)</label>
              <input value={endLat} onChange={(e)=>setEndLat(e.target.value)}
                type="text" placeholder="Latitude"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="mb-2 block font-semibold">🎯 Destination (lng)</label>
              <input value={endLng} onChange={(e)=>setEndLng(e.target.value)}
                type="text" placeholder="Longitude"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500" />
            </div>
          </div>

          <button onClick={compare} disabled={loading}
            className="w-full rounded-xl bg-gray-950 p-4 font-bold text-white transition hover:bg-gray-800 disabled:opacity-60">
            {loading ? "Comparaison..." : "Comparer les prix"}
          </button>

          {error && <div className="mt-4 text-red-600 font-medium">Erreur : {error}</div>}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl shadow-sm">
          <Map />
        </div>

        <div className="mt-6">
          {result && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold mb-3">Résultat</h2>

              <div className="mb-4">
                <strong>Trajet :</strong>
                <div>Distance : {result.route?.distance_km ?? "—"} km</div>
                <div>Durée : {result.route?.duration_min ?? "—"} min</div>
              </div>

              <div className="mb-4">
                <strong>Meilleur prix :</strong>
                {result.best_price ? (
                  <div>
                    {result.best_price.provider} — {result.best_price.category} : {result.best_price.price} {result.best_price.currency}
                  </div>
                ) : <div>Aucun résultat</div>}
              </div>

              <div>
                <strong>Offres :</strong>
                <ul className="mt-2 space-y-2">
                  {Array.isArray(result.results) && result.results.length ? result.results.map((r: any, i: number) => (
                    <li key={i} className="p-3 border rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-semibold">{r.provider} — {r.category}</div>
                          <div className="text-sm text-gray-500">ETA: {r.eta_minutes} min — distance: {r.distance_km} km</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{r.price} {r.currency}</div>
                          <div className="text-sm text-gray-500">{r.difference_from_cheapest_percent}%</div>
                        </div>
                      </div>
                    </li>
                  )) : <li>Aucune offre</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

      </section>
    </main>
  );
}
