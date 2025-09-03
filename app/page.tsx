"use client";
import { useEffect, useMemo, useState } from "react";
import StationList from "./components/StationList";
import Player from "./components/Player";

type Station = {
  stationuuid: string;
  name: string;
  favicon: string;
  tags: string;
  country: string;
  url: string;
  url_resolved: string;
  homepage: string;
  codec: string;
  bitrate: number;
};

export default function Home() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [tag, setTag] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [current, setCurrent] = useState<Station | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showFavs, setShowFavs] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("fabaro_favs");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const saveFavs = (obj: Record<string, boolean>) => {
    setFavorites(obj);
    try { localStorage.setItem("fabaro_favs", JSON.stringify(obj)); } catch {}
  };

  const toggleFav = (s: Station) => {
    const obj = { ...favorites };
    obj[s.stationuuid] = !obj[s.stationuuid];
    saveFavs(obj);
  };

  const fetchStations = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (country) params.set("country", country);
    if (tag) params.set("tag", tag);
    const res = await fetch(`/api/stations?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setStations(data.slice(0, 60));
    setLoading(false);
  };

  useEffect(() => { fetchStations(); }, []);

  const filtered = useMemo(
    () => (showFavs ? stations.filter((s) => favorites[s.stationuuid]) : stations),
    [stations, favorites, showFavs]
  );

  return (
    <main className="mx-auto max-w-5xl p-4 space-y-4 pb-28">
      <header className="flex items-center gap-3">
        <img src="/logo.png" alt="FABARO" className="w-10 h-10" />
        <div>
          <h1 className="text-2xl font-semibold leading-tight">FABARO Radio Online</h1>
          <p className="text-sm text-neutral-400">Streaming radio dunia & Indonesia</p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input flex-1"
          placeholder="Cari stasiun/genre (jazz, news, quran, k-pop)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="input w-[48vw] max-w-[220px]"
            placeholder="Negara (Indonesia, Japan)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <select
            className="input w-[36vw] max-w-[160px]"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Genre</option>
            <option value="pop">pop</option>
            <option value="news">news</option>
            <option value="jazz">jazz</option>
            <option value="quran">quran</option>
            <option value="k-pop">k-pop</option>
            <option value="classical">classical</option>
            <option value="indonesia">indonesia</option>
            <option value="japan">japan</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchStations} className="button bg-white text-black">Cari</button>
          <button
            onClick={() => setShowFavs((v) => !v)}
            className={"button " + (showFavs ? "bg-yellow-300 text-black" : "bg-neutral-800")}
          >
            Favorit
          </button>
        </div>
      </div>

      {loading ? (
        <p>Memuat…</p>
      ) : (
        <StationList
          stations={filtered}
          onPlay={setCurrent}
          toggleFav={toggleFav}
          favorites={favorites}
        />
      )}

      <Player station={current} />
    </main>
  );
}
