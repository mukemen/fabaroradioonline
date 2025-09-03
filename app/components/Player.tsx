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
  const [loadingStream, setLoadingStream] = useState(false);

  // kontrol & status
  const usedProxyRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // watchdog progress
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeRef = useRef(0);
  const lastTickRef = useRef(0);

  // token untuk mencegah race ketika ganti stasiun cepat
  const loadTokenRef = useRef(0);

  // abort untuk polling now playing
  const nowAbortRef = useRef<AbortController | null>(null);

  // wake lock (opsional)
  const wakeRef = useRef<any>(null);

  const needsProxy = (u: string) =>
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    u?.startsWith("http://");

  const buildSrc = (u: string, forceProxy = false) =>
    forceProxy || needsProxy(u) ? `/api/proxy?url=${encodeURIComponent(u)}` : u;

  const clearRetry = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  };

  const clearWatchdog = () => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = null;
  };

  const destroyHls = () => {
    try { hlsRef.current?.detachMedia(); } catch {}
    try { hlsRef.current?.destroy(); } catch {}
    hlsRef.current = null;
  };

  const hardStopAudio = () => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); } catch {}
    try { a.src = ""; } catch {}
    try { a.removeAttribute("src"); } catch {}
    try { a.load(); } catch {}
  };

  const requestWake = async () => {
    try {
      // @ts-ignore
      if (navigator.wakeLock) {
        wakeRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch {}
  };
  const releaseWake = async () => {
    try { await wakeRef.current?.release?.(); } catch {} finally { wakeRef.current = null; }
  };

  const setMediaSession = (title?: string) => {
    try {
      if ("mediaSession" in navigator) {
        (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({
          title: title || station?.name || "FABARO Radio",
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

  const scheduleRetry = (token: number) => {
    // jangan retry kalau sudah pemuatan baru
    if (token !== loadTokenRef.current) return;

    const a = audioRef.current;
    if (!a || !station) return;

    const backoffMs = Math.min(15000, 1000 * Math.pow(2, retryCountRef.current)); // 1,2,4,8,15s
    retryCountRef.current++;
    clearRetry();

    retryTimerRef.current = setTimeout(() => {
      if (token !== loadTokenRef.current) return;
      const raw = station.url_resolved || station.url || "";
      if (retryCountRef.current >= 1) usedProxyRef.current = true; // coba proxy setelah 1x gagal
      loadAndPlay(buildSrc(raw, usedProxyRef.current), token);
    }, backoffMs);
  };

  const startWatchdog = (token: number) => {
    clearWatchdog();
    const a = audioRef.current;
    if (!a) return;
    lastTimeRef.current = a.currentTime || 0;
    lastTickRef.current = Date.now();

    watchdogRef.current = setInterval(() => {
      if (token !== loadTokenRef.current) return;
      const aud = audioRef.current;
      if (!aud || aud.paused) return;
      const t = aud.currentTime;
      const nowT = Date.now();
      // kalau waktu tidak bergerak > 20s → reload stream
      if (Math.abs(t - lastTimeRef.current) < 0.2 && nowT - lastTickRef.current > 20000) {
        scheduleRetry(token);
        lastTickRef.current = nowT;
      } else if (Math.abs(t - lastTimeRef.current) >= 0.2) {
        lastTimeRef.current = t;
        lastTickRef.current = nowT;
      }
    }, 10000);
  };

  const stopNowPolling = () => {
    try { nowAbortRef.current?.abort(); } catch {}
    nowAbortRef.current = null;
  };

  const startNowPolling = (token: number) => {
    stopNowPolling();
    nowAbortRef.current = new AbortController();

    const pull = async () => {
      if (token !== loadTokenRef.current || !station) return;
      try {
        const raw = station.url_resolved || station.url;
        const src = usedProxyRef.current ? `/api/proxy?url=${encodeURIComponent(raw)}` : raw;
        const res = await fetch(`/api/nowplaying?url=${encodeURIComponent(src)}`, {
          cache: "no-store",
          signal: nowAbortRef.current?.signal,
        });
        if (!res.ok) return;
        const j = await res.json();
        if (token !== loadTokenRef.current) return;
        if (j?.title) { setNow(j.title); setMediaSession(j.title); }
      } catch {}
    };

    // jalan awal + interval
    pull();
    const id = setInterval(pull, 15000);
    // simpan di AbortController untuk dibersihkan
    const abort = nowAbortRef.current;
    abort.signal.addEventListener("abort", () => clearInterval(id));
  };

  const loadAndPlay = (src: string, token: number) => {
    const a = audioRef.current!;
    if (token !== loadTokenRef.current) return;

    setLoadingStream(true);
    setErr("");
    clearRetry();
    destroyHls();

    // event untuk menandai konek
    const onCanPlay = () => {
      if (token !== loadTokenRef.current) return;
      setLoadingStream(false);
      setNeedTap(false);
    };
    const onPlaying = () => {
      if (token !== loadTokenRef.current) return;
      setLoadingStream(false);
      setNeedTap(false);
      setIsPlaying(true);
      setMediaSession(now || station?.name);
      startWatchdog(token);
    };
    const onPause = () => {
      if (token !== loadTokenRef.current) return;
      setIsPlaying(false);
    };
    const onStalled = () => scheduleRetry(token);
    const onWaiting = () => scheduleRetry(token);
    const onError = () => scheduleRetry(token);

    // buang semua listener lama dulu
    a.oncanplay = null;
    a.onplaying = null;
    a.onpause = null;
    a.onstalled = null;
    a.onwaiting = null;
    a.onerror = null;

    // assign listener baru
    a.oncanplay = onCanPlay;
    a.onplaying = onPlaying;
    a.onpause = onPause;
    a.onstalled = onStalled;
    a.onwaiting = onWaiting;
    a.onerror = onError;

    // pilih mode HLS atau direct
    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // buffer pendek biar cepat pindah & kecil risiko lag
        maxBufferLength: 6,
        maxMaxBufferLength: 30,
        backBufferLength: 30,
        // retry ringan (sisanya kita handle di scheduleRetry)
        fragLoadingRetryDelay: 800,
        manifestLoadingRetryDelay: 800,
        levelLoadingRetryDelay: 800,
        // jangan auto start sebelum attach (kita kontrol sendiri)
        autoStartLoad: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(a);
      hls.on(Hls.Events.ERROR, () => scheduleRetry(token));
    } else {
      hardStopAudio(); // pastikan koneksi lama putus total
      a.src = src;
      a.preload = "none";
      a.load();
      void attemptPlay();
    }
  };

  // ganti stasiun → reset total & mulai koneksi baru
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !station) return;

    // token baru untuk mencegah race
    const token = ++loadTokenRef.current;

    // reset state & koneksi lama
    setNow("");
    setErr("");
    setNeedTap(false);
    setIsPlaying(false);
    setLoadingStream(true);
    usedProxyRef.current = false;
    retryCountRef.current = 0;

    clearRetry();
    clearWatchdog();
    stopNowPolling();
    destroyHls();
    hardStopAudio();

    const raw = station.url_resolved || station.url || "";
    const src = buildSrc(raw);

    // mulai koneksi baru
    loadAndPlay(src, token);
    startNowPolling(token);

    // cleanup jika station berubah lagi
    return () => {
      if (token !== loadTokenRef.current) return;
      clearRetry();
      clearWatchdog();
      stopNowPolling();
      destroyHls();
      // jangan hardStop di sini: biarkan pemuatan baru yang urus
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station?.stationuuid]);

  // resume saat online / tab aktif lagi
  useEffect(() => {
    const online = () => {
      if (!station) return;
      scheduleRetry(loadTokenRef.current);
    };
    const visible = () => {
      if (!document.hidden && audioRef.current && !audioRef.current.paused && !needTap) {
        attemptPlay();
      }
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [needTap, station?.stationuuid]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      await attemptPlay();
    } else {
      a.pause();
    }
  };

  return (
    <>
      {/* Sheet detail (tanpa audio controls kedua) */}
      {expanded && station && (
        <div className="fixed inset-0 z-[70] bg-black/70 sm:backdrop-blur" onClick={()=>setExpanded(false)}>
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
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="px-3 py-2 rounded bg-white text-black text-sm"
                disabled={loadingStream && !needTap}
              >
                {needTap ? "Putar" : (loadingStream ? "Menghubungkan…" : (isPlaying ? "Pause" : "Play"))}
              </button>
              <button onClick={()=>setExpanded(false)} className="ml-auto px-3 py-2 rounded bg-neutral-800">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Mini player */}
      <div className="fixed left-0 right-0 z-[60] bottom-3">
        <div className="mx-auto max-w-5xl">
          <div className="mx-3 rounded-2xl bg-neutral-900/95 sm:backdrop-blur border border-neutral-800 px-3 py-2">
            {station ? (
              <div className="flex items-center gap-3">
                <img
                  src={station.favicon || "/icon-192.png"}
                  alt=""
                  className="w-8 h-8 rounded"
                  loading="lazy"
                  decoding="async"
                  onError={(e:any)=>{e.currentTarget.src="/icon-192.png"}}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{station.name}</div>
                  <div className="text-xs text-neutral-400 truncate">
                    {loadingStream ? "Menghubungkan…" : (now || station.country)}
                  </div>
                </div>
                <button
                  onClick={togglePlay}
                  className="ml-auto px-3 py-2 rounded-lg bg-white text-black text-sm"
                  disabled={loadingStream && !needTap}
                >
                  {needTap ? "Putar" : (loadingStream ? "Memuat…" : (isPlaying ? "Pause" : "Play"))}
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

      {/* Audio tunggal (hidden) */}
      <audio ref={audioRef} className="hidden" playsInline preload="none" />
    </>
  );
}
