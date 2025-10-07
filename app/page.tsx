"use client";

import { useEffect, useMemo, useState } from "react";
import StationList from "./components/StationList";
import Player from "./components/Player";
import RegisterSW from "./components/RegisterSW";
import InstallPrompt from "./components/InstallPrompt";
import InstallButton from "./components/InstallButton";

// ====== DATA: GENRE & NEGARA ======
const GENRES = [
  "top 40","hits","pop","rock","alternative","indie","metal","punk",
  "hip-hop","rap","r&b","soul","dance","edm","house","trance","techno",
  "k-pop","j-pop","mandopop","latin","reggaeton","salsa","bachata",
  "afrobeats","reggae","ska","country","folk","world","bollywood",
  "jazz","smooth jazz","blues","classical","opera","soundtrack",
  "lofi","chillout","ambient","new age",
  "oldies","70s","80s","90s","00s",
  "news","talk","business","sports","weather","traffic","comedy","education","kids",
  "quran","religion","gospel","christian","islamic"
];

const COUNTRIES = [
  // Asia
  "Indonesia","Malaysia","Singapore","Brunei","Thailand","Vietnam","Philippines","Myanmar","Cambodia","Laos",
  "Japan","South Korea","China","Taiwan","Hong Kong","Mongolia",
  "India","Pakistan","Bangladesh","Sri Lanka","Nepal",
  "United Arab Emirates","Saudi Arabia","Qatar","Kuwait","Bahrain","Oman","Turkey","Iran","Iraq","Israel","Jordan","Lebanon","Egypt",
  // Eropa
  "United Kingdom","Ireland","France","Germany","Netherlands","Belgium","Luxembourg","Switzerland","Austria",
  "Italy","Spain","Portugal","Norway","Sweden","Finland","Denmark","Iceland",
  "Poland","Czech Republic","Slovakia","Hungary","Romania","Bulgaria","Greece","Albania","North Macedonia",
  "Serbia","Bosnia and Herzegovina","Croatia","Slovenia","Montenegro",
  "Lithuania","Latvia","Estonia","Ukraine","Russia","Belarus","Georgia","Armenia","Azerbaijan",
  // Amerika
  "United States Of America","Canada","Mexico","Brazil","Argentina","Chile","Peru","Colombia","Venezuela","Uruguay","Paraguay","Bolivia","Ecuador","Guatemala","Costa Rica","Panama","Dominican Republic","Puerto Rico",
  // Afrika
  "South Africa","Kenya","Nigeria","Ghana","Ethiopia","Morocco","Algeria","Tunisia","Libya","Sudan",
  // Oceania
  "Australia","New Zealand"
];

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
  const [genre, setGenre] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [current, setCurrent] = useState<Station | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showFavs, setShowFavs] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem("fabaro_favs"); if (raw) setFavorites(JSON.parse(raw)); } catch {}
    try { const last = localStorage.getItem("fabaro_last_station"); if (last) setCurrent(JSON.parse(last)); } catch {}
    fetchStations(); // initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // === PENTING: try/finally supaya loading pasti berhenti ===
  const fetchStations = async () => {
    setLoading(true);
    try {
      setErrorMsg(""); // reset error
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (country) params.set("country", country);
      if (genre) params.set("tag", genre);

      const res = await fetch(`/api/stations?${params.toString()}`, { cache: "no-store" });

      if (!res.ok) {
        setStations([]);
        setErrorMsg("Gagal memuat daftar stasiun. Coba lagi sebentar.");
        return;
      }

      const data = await res.json();
      const list = (Array.isArray(data) ? data : []).slice(0, 80);
      setStations(list);
      if (list.length === 0) {
        setErrorMsg("Tidak ada hasil. Ubah kata kunci/negara/genre lalu cari lagi.");
      }
    } catch (err) {
      console.warn("stations API error:", err);
      setStations([]);
      setErrorMsg("Jaringan sedang lambat atau server sibuk. Coba lagi.");
    } finally {
      setLoading(false); // <-- spinner pasti berhenti
    }
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
          {/* NEGARA */}
          <select
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Negara (semua)</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* GENRE */}
          <select
            className="input"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          >
            <option value="">Genre (semua)</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
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

        {/* Pesan error ringan */}
        {!!errorMsg && (
          <div className="text-sm text-red-400">{errorMsg}</div>
        )}
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
