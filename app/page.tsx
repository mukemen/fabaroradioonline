"use client";
import { useEffect, useMemo, useState } from "react";
import StationList from "../components/StationList";
import Player from "../components/Player";

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

const PRESET_TAGS = ["pop", "news", "jazz", "quran", "k-pop", "classical", "indonesia", "japan"];

export default function Home() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [tag, setTag] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [current, setCurrent] = useState<Station | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showFavs, setShowFavs] = useState(false);

  // load favorites from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fabaro_favs");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const saveFavs = (obj: Record<string, boolean>) => {
    setFavorites(obj);
    try {
      localStorage.setItem("fabaro_favs", JSON.stringify(obj));
    } catch {}
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

  useEffect(() => {
    fetchStations();
  }, []);

  // basic analytics crash + perf
  useEffect(() => {
    const onErr = (e: any) => {
      try {
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evt: "error", msg: e?.message || String(e) }),
        });
      } catch {}
    };
    const onRej = (e: any) => {
      try {
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evt: "unhandledrejection", msg: String(e?.reason || e) }),
        });
      } catch {}
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!showFavs) return stations;
    return stations.filter((s) => favorites[s.stationuuid]);
  }, [stations, favorites, showFavs]);

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="FABARO" className="w-10 h-10" />
        <h1 className="text-2xl font-semibold">FABARO Radio Online</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          className="flex-1 min-w-[220px] bg-neutral-900 rounded px-3 py-2 outline-none"
          placeholder="Cari stasiun/genre (mis. jazz, news, quran, k-pop)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="w-48 bg-neutral-900 rounded px-3 py-2 outline-none"
          placeholder="Negara (mis. Indonesia, Japan)"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <select
          className="w-40 bg-neutral-900 rounded px-3 py-2 outline-none"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">Genre</option>
          {PRESET_TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button onClick={fetchStations} className="px-4 py-2 rounded bg-white text-black font-medium">
          Cari
        </button>
        <button
          onClick={() => setShowFavs((v) => !v)}
          className={
            "px-4 py-2 rounded font-medium " +
            (showFavs ? "bg-yellow-300 text-black" : "bg-neutral-800")
          }
        >
          Favorit
        </button>
      </div>

      {/* Curated quick presets */}
      <div className="flex gap-2 flex-wrap text-sm">
        <button
          onClick={() => {
            setCountry("Indonesia");
            setTag("");
            setQ("");
            fetchStations();
          }}
          className="px-3 py-1 rounded bg-neutral-800"
        >
          Top Indonesia
        </button>
        <button
          onClick={() => {
            setCountry("");
            setTag("news");
            setQ("");
            fetchStations();
          }}
          className="px-3 py-1 rounded bg-neutral-800"
        >
          Global News
        </button>
        <button
          onClick={() => {
            setCountry("");
            setTag("quran");
            setQ("");
            fetchStations();
          }}
          className="px-3 py-1 rounded bg-neutral-800"
        >
          Religi: Quran
        </button>
        <button
          onClick={() => {
            setCountry("Japan");
            setTag("j-pop");
            setQ("");
            fetchStations();
          }}
          className="px-3 py-1 rounded bg-neutral-800"
        >
          J-Pop
        </button>
        <button
          onClick={() => {
            setCountry("South Korea");
            setTag("k-pop");
            setQ("");
            fetchStations();
          }}
          className="px-3 py-1 rounded bg-neutral-800"
        >
          K-Pop
        </button>
        <button
          onClick={() => {
            setCountry("");
            setTag("jazz");
            setQ("");
            fetchStations();
          }}
          className="px-3 py-1 rounded bg-neutral-800"
        >
          Jazz
        </button>
        <button
          onClick={() => {
            setCountry("");
            setTag("classical");
            setQ("");
            fetchStations();
          }}
          className="px-3 py-1 rounded bg-neutral-800"
        >
          Classical
        </button>
      </div>

      <Player station={current} />

      {loading ? (
        <p>Memuat…</p>
      ) : (
        <StationList stations={filtered} onPlay={setCurrent} toggleFav={toggleFav} favorites={favorites} />
      )}
    </main>
  );
}
