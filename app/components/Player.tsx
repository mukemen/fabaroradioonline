"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Station = any;

export default function Player({ station }: { station: Station | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [now, setNow] = useState("");
  const [err, setErr] = useState("");
  const [needTap, setNeedTap] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // reconnect/backoff
  const usedProxyRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // watchdog
  const lastTimeRef = useRef(0);
  const lastTickRef = useRef(0);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);

  // wake lock
  const wakeRef = useRef<any>(null);

  const needsProxy = (u: string) =>
    typeof window !== "undefined" && window.location.protocol === "https:" && u?.startsWith("http://");
  const buildSrc = (u: string, forceProxy = false) =>
    forceProxy || needsProxy(u) ? `/api/proxy?url=${encodeURIComponent(u)}` : u;

  const clearRetry = () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); retryTimerRef.current = null; };
  const destroyHls = () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };

  const requestWake = async () => {
    try {
      // @ts-ignore
      if (navigator.wakeLock) wakeRef.current = await (navigator as any).wakeLock.request("screen");
    } catch {}
  };
  const releaseWake = async () => {
    try { await wakeRef.current?.release?.(); } catch {} finally { wakeRef.current = null; }
  };

  const setMediaSession = (title: string) => {
    try {
      if ("mediaSession" in navigator) {
        (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({
          title: title || (station?.name || "FABARO Radio"),
          artist: station?.country || "",
          album: station?.tags || "",
          artwork: [{ src: station?.favicon || "/icon-192.png", sizes: "192x192", type: "image/png" }]
        });
        (navigator as any).mediaSession.setActionHandler("play", () => attemptPlay());
        (navigator as any).mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
      }
    } catch {}
  };

  const attemptPlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
      setNeedTap(false);
      await requestWake();
    } catch {
      setNeedTap(true);
    }
  };

  const loadAndPlay = (src: string) => {
    const a = audioRef.current!;
    destroyHls();
    clearRetry();
    setErr("");

    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(a);
      hls.on(Hls.Events.MANIFEST_PARSED, () => attemptPlay());
      hls.on(Hls.Events.ERROR, () => scheduleRetry());
    } else {
      a.src = src;
      a.load();
      attemptPlay();
      a.onerror = () => scheduleRetry();
    }
  };

  const scheduleRetry = () => {
    const a = audioRef.current;
    if (!a || !station) return;
    // kalau sudah coba proxy dan tetap gagal, tampilkan error
    if (usedProxyRef.current && retryCountRef.current >= 3) {
      setErr("Sinyal terputus. Mencoba lagi nanti…");
    }
    const backoffMs = Math.min(15000, 1000 * Math.pow(2, retryCountRef.current)); // 1s,2s,4s,8s,15s
    retryCountRef.current++;
    clearRetry();
    retryTimerRef.current = setTimeout(() => {
      const raw = station.url_resolved || station.url || "";
      // pakai proxy setelah 1x gagal
      if (retryCountRef.current >= 1) usedProxyRef.current = true;
      loadAndPlay(buildSrc(raw, usedProxyRef.current));
    }, backoffMs);
  };

  // Watchdog: kalau waktu tidak bergerak >20s saat playing → reload
  const startWatchdog = () => {
    clearWatchdog();
    lastTimeRef.current = audioRef.current?.currentTime || 0;
    lastTickRef.current = Date.now();
    watchdogRef.current = setInterval(() => {
      const a = audioRef.current;
      if (!a || a.paused) return;
      const t = a.currentTime;
      const now = Date.now();
      if (Math.abs(t - lastTimeRef.current) < 0.2 && now - lastTickRef.current > 20000) {
        scheduleRetry(); // macet, coba reload
        lastTickRef.current = now;
      } else if (Math.abs(t - lastTimeRef.current) >= 0.2) {
        lastTimeRef.current = t;
        lastTickRef.current = now;
      }
    }, 10000);
  };
  const clearWatchdog = () => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = null;
  };

  // Init setiap ganti station
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !station) return;

    // reset flags
    usedProxyRef.current = false;
    retryCountRef.current = 0;
    setErr(""); setNow(""); setNeedTap(false);

    const raw = station.url_resolved || station.url || "";

    const onPlay = () => { setIsPlaying(true); setMediaSession(now || station.name || "Radio"); startWatchdog(); };
    const onPause = () => { setIsPlaying(false); clearWatchdog(); releaseWake(); };
    const onStalled = () => scheduleRetry();
    const onWaiting = () => scheduleRetry();
    const onSuspend = () => scheduleRetry();

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("stalled", onStalled);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("suspend", onSuspend);

    loadAndPlay(buildSrc(raw));

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("stalled", onStalled);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("suspend", onSuspend);
      destroyHls();
      clearRetry();
      clearWatchdog();
      releaseWake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station?.stationuuid]);

  // Now Playing polling (tetap ringan)
  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    const pull = async () => {
      if (!station) return;
      try {
        const raw = station.url_resolved || station.url;
        const src = usedProxyRef.current ? `/api/proxy?url=${encodeURIComponent(raw)}` : raw;
        const res = await fetch(`/api/nowplaying?url=${encodeURIComponent(src)}`, { cache: "no-store" });
        const j = await res.json();
        if (j?.title) { setNow(j.title); setMediaSession(j.title); }
      } catch {}
    };
    pull();
    t = setInterval(pull, 15000);
    return () => t && clearInterval(t);
  }, [station?.stationuuid]);

  // Resume saat online / tab aktif lagi
  useEffect(() => {
    const online = () => { if (audioRef.current && !audioRef.current.paused && !needTap) scheduleRetry(); };
    const visible = () => { if (!document.hidden && audioRef.current && !audioRef.current.paused && !needTap) attemptPlay(); };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visible); };
  }, [needTap]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) await attemptPlay();
    else a.pause();
  };

  return (
    <>
      {/* Sheet detail */}
      {expanded && station && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={()=>setExpanded(false)}>
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-neutral-900 p-4 space-y-3"
            style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="h-1 w-12 bg-neutral-700 rounded-full mx-auto" />
            <div className="font-semibold">{station.name}</div>
            <div className="text-xs text-neutral-400">{station.country} • {station.tags}</div>
            {now && <div className="text-sm text-green-300">Now Playing: {now}</div>}
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <audio
              ref={audioRef}
              controls
              className="w-full"
              playsInline
              preload="none"
              controlsList="nodownload noplaybackrate noremoteplayback"
            />
            <div className="flex items-center gap-2">
              <button onClick={()=>setExpanded(false)} className="ml-auto px-3 py-2 rounded bg-neutral-800">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Mini player */}
      <div className="fixed left-0 right-0 z-[60] bottom-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0px)" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-3 rounded-2xl bg-neutral-900/95 backdrop-blur border border-neutral-800 px-3 py-2">
            {station ? (
              <div className="flex items-center gap-3">
                <img
                  src={station.favicon || "/icon-192.png"}
                  alt=""
                  className="w-8 h-8 rounded"
                  onError={(e:any)=>{e.currentTarget.src="/icon-192.png"}}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{station.name}</div>
                  <div className="text-xs text-neutral-400 truncate">{now || station.country}</div>
                </div>
                <button onClick={togglePlay} className="ml-auto px-3 py-2 rounded-lg bg-white text-black text-sm">
                  {needTap ? "Putar" : (isPlaying ? "Pause" : "Play")}
                </button>
                <button onClick={()=>setExpanded(true)} className="px-3 py-2 rounded-lg bg-neutral-800 text-sm">
                  Detail
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-neutral-400">Pilih stasiun untuk mulai memutar</div>
            )}
          </div>
        </div>
      </div>

      {/* audio hidden supaya tetap playing saat mini-player dipakai */}
      <audio ref={audioRef} className="hidden" playsInline preload="none" />
    </>
  );
}
