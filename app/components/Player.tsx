"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Station = any;

export default function Player({ station }: { station: Station | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);

  const retryTimer = useRef<NodeJS.Timeout | null>(null);
  const sleepTimer = useRef<NodeJS.Timeout | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const usedProxyRef = useRef<boolean>(false);

  const needsProxy = (u: string) =>
    typeof window !== "undefined" && window.location.protocol === "https:" && u?.startsWith("http://");
  const buildSrc = (u: string, forceProxy = false) =>
    forceProxy || needsProxy(u) ? `/api/proxy?url=${encodeURIComponent(u)}` : u;

  // helper: coba play, handle autoplay policy
  const attemptPlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
      setNeedTap(false);
    } catch {
      setNeedTap(true);
    }
  };

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) await attemptPlay();
    else a.pause();
  };

  // setup player tiap ganti station
  useEffect(() => {
    setErr("");
    setNow("");
    setNeedTap(false);
    usedProxyRef.current = false;
    const audio = audioRef.current;
    if (!audio || !station) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);

    const raw = station.url_resolved || station.url || "";
    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    const tryPlay = (src: string) => {
      cleanup();
      if (src.includes(".m3u8") && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(audio);
        hls.on(Hls.Events.MANIFEST_PARSED, () => attemptPlay());
        hls.on(Hls.Events.ERROR, () => fallbackToProxy());
      } else {
        audio.src = src;
        audio.load();
        attemptPlay();
        audio.onerror = () => fallbackToProxy();
      }
    };

    const fallbackToProxy = () => {
      if (usedProxyRef.current) {
        setErr("Gagal memutar (CORS/geo-block/URL rusak).");
        return;
      }
      usedProxyRef.current = true;
      setErr("Mencoba mode proxy…");
      const proxied = buildSrc(raw, true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => tryPlay(proxied), 300);
    };

    tryPlay(buildSrc(raw));

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      cleanup();
    };
  }, [station]);

  // Now Playing polling
  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    const pull = async () => {
      if (!station) return;
      try {
        const raw = station.url_resolved || station.url;
        const src = usedProxyRef.current ? `/api/proxy?url=${encodeURIComponent(raw)}` : raw;
        const res = await fetch(`/api/nowplaying?url=${encodeURIComponent(src)}`, { cache: "no-store" });
        const j = await res.json();
        if (j && j.title) setNow(j.title);
      } catch {}
    };
    pull();
    t = setInterval(pull, 15000);
    return () => t && clearInterval(t);
  }, [station]);

  // Sleep timer
  useEffect(() => {
    if (sleepTimer.current) {
      clearTimeout(sleepTimer.current);
      sleepTimer.current = null;
    }
    if (sleepMin > 0 && audioRef.current) {
      sleepTimer.current = setTimeout(() => {
        audioRef.current?.pause();
      }, sleepMin * 60 * 1000);
    }
    return () => {
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
    };
  }, [sleepMin]);

  // UI
  return (
    <>
      {/* Sheet expanded */}
      {expanded && station && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={() => setExpanded(false)}>
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-neutral-900 p-4 space-y-3"
            style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-12 bg-neutral-700 rounded-full mx-auto" />
            <div className="font-semibold">{station.name}</div>
            <div className="text-xs text-neutral-400">{station.country} • {station.tags}</div>
            {now && <div className="text-sm text-green-300">Now Playing: {now}</div>}
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <audio ref={audioRef} controls className="w-full" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-400">Sleep (menit)</span>
              <input
                type="number"
                min={0}
                max={180}
                value={sleepMin}
                onChange={(e) => setSleepMin(parseInt(e.target.value || "0"))}
                className="w-24 bg-neutral-800 rounded px-2 py-2 outline-none"
              />
              <div className="flex gap-2">
                {[15, 30, 60].map((m) => (
                  <button key={m} onClick={() => setSleepMin(m)} className="px-3 py-2 rounded bg-neutral-800">
                    {m}m
                  </button>
                ))}
              </div>
              <button onClick={() => setSleepMin(0)} className="px-3 py-2 rounded bg-neutral-800">Reset</button>
              <button onClick={() => audioRef.current?.pause()} className="ml-auto px-3 py-2 rounded bg-white text-black">Pause</button>
              <button onClick={() => setExpanded(false)} className="px-3 py-2 rounded bg-neutral-800">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Mini player - selalu terlihat */}
      <div
        className="fixed left-0 right-0 z-[60] bottom-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0px)" }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mx-3 rounded-2xl bg-neutral-900/95 backdrop-blur border border-neutral-800 px-3 py-2">
            {station ? (
              <div className="flex items-center gap-3">
                <img
                  src={station.favicon || "/icon-192.png"}
                  alt=""
                  className="w-8 h-8 rounded"
                  onError={(e: any) => { e.currentTarget.src = "/icon-192.png"; }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{station.name}</div>
                  <div className="text-xs text-neutral-400 truncate">{now || station.country}</div>
                </div>

                {/* Play / Pause langsung di mini-bar */}
                <button
                  onClick={togglePlay}
                  className="ml-auto px-3 py-2 rounded-lg bg-white text-black text-sm"
                >
                  {needTap ? "Putar" : (isPlaying ? "Pause" : "Play")}
                </button>

                <button
                  onClick={() => setExpanded(true)}
                  className="px-3 py-2 rounded-lg bg-neutral-800 text-sm"
                >
                  Detail
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-neutral-400">Pilih stasiun untuk mulai memutar</div>
            )}
          </div>
        </div>
      </div>

      {/* Audio hidden supaya tetap bermain */}
      <audio ref={audioRef} className="hidden" />
    </>
  );
}
