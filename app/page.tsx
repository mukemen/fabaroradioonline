"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StationList from "./components/StationList";
import Player from "./components/Player";
import RegisterSW from "./components/RegisterSW";
import InstallPrompt from "./components/InstallPrompt";
import InstallButton from "./components/InstallButton";

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
  const [stableOnly, setStableOnly] = useState(true); // ✅ Mode Stabil

  useEffect(() => {
    try { const raw = localStorage.getItem("fabaro_favs"); if (raw) setFavorites(JSON.parse(raw)); } catch {}
    try { const last = localStorage.getItem("fabaro_last_station"); if (last) setCurrent(JSON.parse(last)); } catch {}
    fetchStations();
  }, []);

  const toggleFav = useCallback((s: Station) => {
    setFavorites(prev => {
      const obj = { ...prev, [s.stationuuid]: !prev[s.stationuuid] };
      try { localStorage.setItem("fabaro_favs", JSON.stringify(obj)); } catch {}
      return obj;
    });
  }, []);

  const onPlay = useCallback((s: Station) => {
    setCurrent(s);
    try { localStorage.setItem("fabaro_last_station", JSON.stringify(s)); } catch {}
  }, []);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (country) params.set("country", country);
    if (tag) params.set("tag", tag);
    const res = await fetch(`/api/stations?${params.toString()}`, { cache: "no-store" });
    let data: Station[] = await res.json();

    if (stableOnly) {
      data = data.filter(s => {
        const url = (s.url_resolved || s.url || "").toLowerCase();
        const isHttps = url.startsWith("https://");
        const codec = (s.codec || "").toLowerCase();
        const isMp3OrAac = codec.includes("mp3") || codec.includes("aac");
        const okBitrate = s.bitrate ? s.bitrate <= 128 : true;
        return isHttps && isMp3OrAac && okBitrate;
      });
      // urutkan yang lebih ringan dulu
      data.sort((a, b) => (a.bitrate || 999) - (b.bitrate || 999));
    }

    setStations(data.slice(0, 80));
    setLoading(false);
  }, [q, country, tag, stableOnly]);

  const filtered = useMemo(
    () => (showFavs ? stations.filter((s) => favorites[s.stationuuid]) : stations),
    [stations, favorites, showFavs]
  );

  return (
    <main className="w-full mx-auto max-w-screen-sm px-4 space-y-4 pb-56 overflow-x-hidden">
      <RegisterSW />
      <InstallPrompt />

      {/* HEADER */}
      <header className="flex items-center gap-3">
        <img src="/logo.png" alt="FABARO" className="w-10 h-10 rounded" />
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold leading-tight truncate">FABARO Radio Online</h1>
          <p className="text-sm text-neutral-400">Streaming radio dunia & Indonesia</p>
        </div>
        <div className="ml-auto">
          <InstallButton />
        </div>
      </header>

      {/* FORM */}
      <section className="grid gap-3">
        <input
          className="input"
          placeholder="Cari stasiun/genre (jazz, news, quran, k-pop)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Negara (Indonesia, Japan)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <select
            className="input"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Genre</option>
            <option value="news">news</option>
            <option value="quran">quran</option>
            <option value="jazz">jazz</option>
            <option value="k-pop">k-pop</option>
            <option value="j-pop">j-pop</option>
            <option value="classical">classical</option>
            <option value="pop">pop</option>
            <option value="rock">rock</option>
            <option value="edm">edm</option>
            <option value="hip-hop">hip-hop</option>
          </select>
        </div>

        {/* 🔒 Mode Stabil */}
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={stableOnly}
            onChange={(e)=>setStableOnly(e.target.checked)}
          />
          Mode Stabil (HTTPS + MP3/AAC ≤128kbps)
        </label>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={fetchStations} className="button bg-white text-black">Cari</button>
          <button
            onClick={() => setShowFavs((v) => !v)}
            className={"button " + (showFavs ? "bg-yellow-300 text-black" : "bg-neutral-800")}
          >
            Favorit
          </button>
        </div>
      </section>

      {/* LIST */}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <StationList
          stations={filtered}
          onPlay={onPlay}
          toggleFav={toggleFav}
          favorites={favorites}
        />
      )}

      <Player station={current} />
    </main>
  );
}
