"use client";
import { useEffect, useMemo, useState } from "react";
import StationList from "./components/StationList";
import Player from "./components/Player";
import InstallPrompt from "./components/InstallPrompt";
import RegisterSW from "./components/RegisterSW";

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

const PRESET_TAGS = ["pop","news","jazz","quran","k-pop","classical","indonesia","japan"];

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
    try { const raw = localStorage.getItem("fabaro_favs"); if (raw) setFavorites(JSON.parse(raw)); } catch {}
    fetchStations();
    try { const last = localStorage.getItem("fabaro_last_station"); if (last) setCurrent(JSON.parse(last)); } catch {}
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

  const onPlay = (s: Station) => {
    setCurrent(s);
    try { localStorage.setItem("fabaro_last_station", JSON.stringify(s)); } catch {}
  };

  const filtered = useMemo(
    () => (showFavs ? stations.filter((s) => favorites[s.stationuuid]) : stations),
    [stations, favorites, showFavs]
  );

  return (
    <main className="w-full mx-auto max-w-screen-sm px-4 space-y-4 pb-56">
      <RegisterSW />
      <InstallPrompt />

      {/* HEADER */}
      <header className="grid grid-cols-[40px_1fr] items-center gap-3">
        <img src="/logo.png" alt="FABARO" className="w-10 h-10 rounded" />
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold leading-tight truncate">FABARO Radio Online</h1>
          <p className="text-sm text-neutral-400">Streaming radio dunia & Indonesia</p>
        </div>
      </header>

      {/* FORM: 1 kolom di HP, rapi dan penuh lebar */}
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
            {PRESET_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

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

      {/* PRESET PILLS */}
      <div className="flex gap-2 flex-wrap text-sm">
        <button onClick={() => { setCountry("Indonesia"); setTag(""); setQ(""); fetchStations(); }} className="px-3 py-2 rounded-xl bg-neutral-800">Top Indonesia</button>
        <button onClick={() => { setCountry(""); setTag("news"); setQ(""); fetchStations(); }} className="px-3 py-2 rounded-xl bg-neutral-800">Global News</button>
        <button onClick={() => { setCountry(""); setTag("quran"); setQ(""); fetchStations(); }} className="px-3 py-2 rounded-xl bg-neutral-800">Religi: Quran</button>
        <button onClick={() => { setCountry("Japan"); setTag("j-pop"); setQ(""); fetchStations(); }} className="px-3 py-2 rounded-xl bg-neutral-800">J-Pop</button>
        <button onClick={() => { setCountry("South Korea"); setTag("k-pop"); setQ(""); fetchStations(); }} className="px-3 py-2 rounded-xl bg-neutral-800">K-Pop</button>
        <button onClick={() => { setCountry(""); setTag("jazz"); setQ(""); fetchStations(); }} className="px-3 py-2 rounded-xl bg-neutral-800">Jazz</button>
        <button onClick={() => { setCountry(""); setTag("classical"); setQ(""); fetchStations(); }} className="px-3 py-2 rounded-xl bg-neutral-800">Classical</button>
      </div>

      {/* LIST */}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <StationList stations={filtered} onPlay={onPlay} toggleFav={toggleFav} favorites={favorites} />
      )}

      <Player station={current} />
    </main>
  );
}
