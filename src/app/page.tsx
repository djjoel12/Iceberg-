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

  async function compare() {
    setLoading(true);

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">

      <header className="bg-gray-950 px-5 py-6 text-white">
        <h1 className="text-3xl font-bold tracking-wide">
          ICEBERG
        </h1>

        <p className="mt-1 text-sm text-gray-400">
          Comparez les prix de transport à Abidjan
        </p>
      </header>

      <section className="mx-auto max-w-3xl p-5">

        <div className="rounded-2xl bg-white p-5 shadow-sm">

          <div className="mb-4">
            <label className="mb-2 block font-semibold">
              📍 Départ
            </label>

            <input
              type="text"
              placeholder="Votre position"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500"
            />
          </div>

          <div className="mb-5">
            <label className="mb-2 block font-semibold">
              🎯 Destination
            </label>

            <input
              type="text"
              placeholder="Où allez-vous ?"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 outline-none focus:border-gray-500"
            />
          </div>

          <button
            onClick={compare}
            disabled={loading}
            className="w-full rounded-xl bg-gray-950 p-4 font-bold text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {loading
              ? "Comparaison..."
              : "Comparer les prix"}
          </button>

        </div>

        <div className="mt-5 overflow-hidden rounded-2xl shadow-sm">
          <Map />
        </div>

      </section>

    </main>
  );
        }
