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

  // Restore favorites, UI state, dan last station
  useEffect(() => {
    try {
      const rawFav = localStorage.getItem("fabaro_favs");
      if (rawFav) setFavorites(JSON.parse(rawFav));
    } catch {}
    try {
      const ui = JSON.parse(localStorage.getItem("fabaro_ui") || "{}");
      if (typeof ui.q === "string") setQ(ui.q);
      if (typeof ui.country === "string") setCountry(ui.country);
      if (typeof ui.tag === "string") setTag(ui.tag);
      if (typeof ui.showFavs === "boolean") setShowFavs(ui.showFavs);
      const last = localStorage.getItem("fabaro_last_station");
      if (last) setCurrent(JSON.parse(last));
      // fetch pertama pakai nilai yang direstore
      fetchStations({ q: ui.q || "", country: ui.country || "", tag: ui.tag || "" });
    } catch {
      fetchStations();
    }
  }, []);

  // Persist UI state
  useEffect(() => {
    try {
      localStorage.setItem("fabaro_ui", JSON.stringify({ q, country, tag, showFavs }));
    } catch {}
  }, [q, country, tag, showFavs]);

  const saveFavs = (obj: Record<string, boolean>) => {
    setFavorites(obj);
    try { localStorage.setItem("fabaro_favs", JSON.stringify(obj)); } catch {}
  };

  const toggleFav = (s: Station) => {
    const obj = { ...favorites };
    obj[s.stationuuid] = !obj[s.stationuuid];
    saveFavs(obj);
  };

  const fetchStations = async (opts?: { q?: string; country?: string; tag?: string }) => {
    setLoading(true);
    const qq = opts?.q ?? q;
    const cc = opts?.country ?? country;
    const tt = opts?.tag ?? tag;
    const params = new URLSearchParams();
    if (qq) params.set("q", qq);
    if (cc) params.set("country", cc);
    if (tt) params.set("tag", tt);
    const res = await fetch(`/api/stations?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setStations(data.slice(0, 60));
    setLoading(false);
  };

  const handlePlay = (s: Station) => {
    setCurrent(s);
    try { localStorage.setItem("fabaro_last_station", JSON.stringify(s)); } catch {}
  };

  const filtered = useMemo(() => (showFavs ? stations.filter(s => favorites[s.stationuuid]) : stations),
    [stations, favorites, showFavs]);

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
        <input className="input flex-1" placeholder="Cari stasiun/genre (jazz, news, quran, k-pop)…"
               value={q} onChange={(e)=>setQ(e.target.value)} />
        <div className="flex gap-2">
          <input className="input w-[48vw] max-w-[220px]" placeholder="Negara (Indonesia, Japan)"
                 value={country} onChange={(e)=>setCountry(e.target.value)} />
          <select className="input w-[36vw] max-w-[160px]" value={tag} onChange={(e)=>setTag(e.target.value)}>
            <option value="">Genre</option>
            {PRESET_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>fetchStations()} className="button bg-white text-black">Cari</button>
          <button onClick={()=>setShowFavs(v=>!v)}
                  className={"button " + (showFavs ? "bg-yellow-300 text-black":"bg-neutral-800")}>
            Favorit
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-sm">
        <button onClick={()=>{setCountry("Indonesia"); setTag(""); setQ(""); fetchStations({country:"Indonesia", tag:"", q:""});}} className="px-3 py-2 rounded-xl bg-neutral-800">Top Indonesia</button>
        <button onClick={()=>{setCountry(""); setTag("news"); setQ(""); fetchStations({country:"", tag:"news", q:""});}} className="px-3 py-2 rounded-xl bg-neutral-800">Global News</button>
        <button onClick={()=>{setCountry(""); setTag("quran"); setQ(""); fetchStations({country:"", tag:"quran", q:""});}} className="px-3 py-2 rounded-xl bg-neutral-800">Religi: Quran</button>
        <button onClick={()=>{setCountry("Japan"); setTag("j-pop"); setQ(""); fetchStations({country:"Japan", tag:"j-pop", q:""});}} className="px-3 py-2 rounded-xl bg-neutral-800">J-Pop</button>
        <button onClick={()=>{setCountry("South Korea"); setTag("k-pop"); setQ(""); fetchStations({country:"South Korea", tag:"k-pop", q:""});}} className="px-3 py-2 rounded-xl bg-neutral-800">K-Pop</button>
        <button onClick={()=>{setCountry(""); setTag("jazz"); setQ(""); fetchStations({country:"", tag:"jazz", q:""});}} className="px-3 py-2 rounded-xl bg-neutral-800">Jazz</button>
        <button onClick={()=>{setCountry(""); setTag("classical"); setQ(""); fetchStations({country:"", tag:"classical", q:""});}} className="px-3 py-2 rounded-xl bg-neutral-800">Classical</button>
      </div>

      {loading ? <p>Memuat…</p> :
        <StationList stations={filtered} onPlay={handlePlay} toggleFav={toggleFav} favorites={favorites} />}

      <Player station={current} />
    </main>
  );
}
