"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Station = any;

export default function Player({ station }: { station: Station | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // UI states
  const [now, setNow] = useState("");
  const [needTap, setNeedTap] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);

  // Volume (0..1) — persist to localStorage
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = Number(localStorage.getItem("fabaro_vol"));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
  });

  // Sleep timer
  const [sleepLeft, setSleepLeft] = useState<number>(0); // detik tersisa
  const [timerOpen, setTimerOpen] = useState(false);
  const sleepTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // control & status
  const usedProxyRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTokenRef = useRef(0);
  const nowAbortRef = useRef<AbortController | null>(null);

  // ===== helpers =====
  const needsProxy = (u: string) =>
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    u?.startsWith("http://");

  const buildSrc = (u: string, forceProxy = false) =>
    forceProxy || needsProxy(u) ? `/api/proxy?url=${encodeURIComponent(u)}` : u;

  const clearRetry = () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); retryTimerRef.current = null; };

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

  const scheduleRetry = (token: number) => {
    if (token !== loadTokenRef.current) return;
    const backoffMs = Math.min(15000, 1000 * Math.pow(2, retryCountRef.current)); // 1,2,4,8,15
    retryCountRef.current++;
    clearRetry();
    retryTimerRef.current = setTimeout(() => {
      if (token !== loadTokenRef.current || !station) return;
      const raw = station.url_resolved || station.url || "";
      if (retryCountRef.current >= 1) usedProxyRef.current = true;
      loadAndPlay(buildSrc(raw, usedProxyRef.current), token);
    }, backoffMs);
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
        if (j?.title) setNow(j.title);
      } catch {}
    };

    pull();
    const id = setInterval(pull, 15000);
    const abort = nowAbortRef.current;
    abort.signal.addEventListener("abort", () => clearInterval(id));
  };

  const stopNowPolling = () => {
    try { nowAbortRef.current?.abort(); } catch {}
    nowAbortRef.current = null;
  };

  const loadAndPlay = (src: string, token: number) => {
    const a = audioRef.current!;
    if (token !== loadTokenRef.current) return;

    setLoadingStream(true);
    clearRetry();
    destroyHls();

    a.onplaying = () => { if (token === loadTokenRef.current) { setLoadingStream(false); setNeedTap(false); setIsPlaying(true); } };
    a.onpause = () => { if (token === loadTokenRef.current) setIsPlaying(false); };
    a.onstalled = () => scheduleRetry(token);
    a.onwaiting = () => scheduleRetry(token);
    a.onerror = () => scheduleRetry(token);

    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 6,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(a);
      hls.on(Hls.Events.ERROR, () => scheduleRetry(token));
    } else {
      hardStopAudio();
      a.preload = "none";
      a.src = src;
      a.load();
      void attemptPlay();
    }
  };

  // ===== effects =====
  // Sync volume to element & persist
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
    try { localStorage.setItem("fabaro_vol", String(volume)); } catch {}
  }, [volume]);

  // Change station
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !station) return;

    const token = ++loadTokenRef.current;
    setNow(""); setNeedTap(false); setIsPlaying(false); setLoadingStream(true);
    usedProxyRef.current = false; retryCountRef.current = 0;

    clearRetry(); stopNowPolling(); destroyHls(); hardStopAudio();

    const raw = station.url_resolved || station.url || "";
    const src = buildSrc(raw);

    loadAndPlay(src, token);
    startNowPolling(token);

    return () => {
      if (token !== loadTokenRef.current) return;
      clearRetry(); stopNowPolling(); destroyHls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station?.stationuuid]);

  // Resume when tab visible/online
  useEffect(() => {
    const online = () => { if (!station) return; scheduleRetry(loadTokenRef.current); };
    const visible = () => { if (!document.hidden && audioRef.current && !audioRef.current.paused && !needTap) attemptPlay(); };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visible); };
  }, [needTap, station?.stationuuid]);

  // ===== Sleep timer =====
  const stopSleepTimer = () => {
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    sleepTickRef.current = null;
    setSleepLeft(0);
  };

  const startSleepTimer = (minutes: number) => {
    const total = Math.max(1, Math.round(minutes)) * 60; // detik
    setSleepLeft(total);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    sleepTickRef.current = setInterval(() => {
      setSleepLeft((s) => {
        if (s <= 1) {
          // waktu habis → pause
          try { audioRef.current?.pause(); } catch {}
          if (sleepTickRef.current) clearInterval(sleepTickRef.current);
          sleepTickRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (sleepTickRef.current) clearInterval(sleepTickRef.current); };
  }, []);

  const fmtMMSS = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) await attemptPlay();
    else a.pause();
  };

  return (
    <>
      {/* Sheet detail sederhana */}
      {expanded && station && (
        <div className="fixed inset-0 z-[70] bg-black/70" onClick={()=>setExpanded(false)}>
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-neutral-900 p-4 space-y-3"
            style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="h-1 w-12 bg-neutral-700 rounded-full mx-auto" />
            <div className="font-semibold">{station.name}</div>
            <div className="text-xs text-neutral-400">{station.country} • {station.tags}</div>
            {now && <div className="text-sm text-green-300">Now Playing: {now}</div>}

            {/* Volume + Timer in sheet */}
            <div className="grid gap-3">
              <div>
                <div className="text-xs mb-1">Volume: {Math.round(volume * 100)}%</div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e)=>setVolume(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-neutral-400">Sleep Timer:</span>
                {sleepLeft > 0 ? (
                  <>
                    <span className="text-sm">{fmtMMSS(sleepLeft)}</span>
                    <button onClick={stopSleepTimer} className="px-3 py-1.5 rounded bg-neutral-800 text-sm">Batal</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>startSleepTimer(15)} className="px-3 py-1.5 rounded bg-neutral-800 text-sm">15m</button>
                    <button onClick={()=>startSleepTimer(30)} className="px-3 py-1.5 rounded bg-neutral-800 text-sm">30m</button>
                    <button onClick={()=>startSleepTimer(60)} className="px-3 py-1.5 rounded bg-neutral-800 text-sm">60m</button>
                    <button onClick={()=>startSleepTimer(120)} className="px-3 py-1.5 rounded bg-neutral-800 text-sm">120m</button>
                    <button
                      onClick={()=>{
                        const v = prompt("Sleep timer (menit):", "20");
                        if (!v) return;
                        const n = Number(v);
                        if (Number.isFinite(n) && n > 0) startSleepTimer(n);
                      }}
                      className="px-3 py-1.5 rounded bg-neutral-800 text-sm"
                    >
                      Custom…
                    </button>
                  </>
                )}
              </div>
            </div>

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
          <div className="mx-3 rounded-2xl bg-neutral-900/95 border border-neutral-800 px-3 py-2">
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

                {/* Volume (ikon + slider muncul saat diklik) */}
                <div className="hidden sm:flex items-center gap-2 ml-auto">
                  <span className="text-xs w-10 text-right">{Math.round(volume*100)}%</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e)=>setVolume(Number(e.target.value))}
                    className="w-28"
                    aria-label="Volume"
                  />
                </div>

                <button
                  onClick={togglePlay}
                  className="ml-auto sm:ml-0 px-3 py-2 rounded-lg bg-white text-black text-sm"
                  disabled={loadingStream && !needTap}
                >
                  {needTap ? "Putar" : (loadingStream ? "Memuat…" : (isPlaying ? "Pause" : "Play"))}
                </button>

                {/* Timer tombol ringkas */}
                <button
                  onClick={()=>setTimerOpen(v=>!v)}
                  className="px-3 py-2 rounded-lg bg-neutral-800 text-sm"
                  title="Sleep Timer"
                >
                  {sleepLeft>0 ? `⏱ ${fmtMMSS(sleepLeft)}` : "Timer"}
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

      {/* Popover timer kecil di mini-player (mobile friendly) */}
      {timerOpen && (
        <div className="fixed inset-0 z-[65]" onClick={()=>setTimerOpen(false)}>
          <div className="absolute right-4 bottom-[72px] bg-neutral-900 border border-neutral-800 rounded-xl p-2 w-56"
               onClick={(e)=>e.stopPropagation()}>
            <div className="text-xs text-neutral-400 px-2 pb-1">Sleep Timer</div>
            {sleepLeft>0 ? (
              <div className="flex items-center gap-2 px-2 pb-2">
                <span className="text-sm">{fmtMMSS(sleepLeft)}</span>
                <button onClick={()=>{stopSleepTimer(); setTimerOpen(false);}} className="ml-auto px-3 py-1.5 rounded bg-neutral-800 text-sm">Batal</button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 px-2 pb-2">
                {[15,30,60,120].map(m=>(
                  <button key={m} onClick={()=>{startSleepTimer(m); setTimerOpen(false);}}
                          className="px-2 py-1.5 rounded bg-neutral-800 text-sm">{m}m</button>
                ))}
                <button
                  onClick={()=>{
                    const v = prompt("Sleep timer (menit):", "20");
                    if (!v) return;
                    const n = Number(v);
                    if (Number.isFinite(n) && n>0) { startSleepTimer(n); setTimerOpen(false); }
                  }}
                  className="col-span-4 px-2 py-1.5 rounded bg-neutral-800 text-sm"
                >
                  Custom…
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio element tunggal (hidden) */}
      <audio ref={audioRef} className="hidden" playsInline preload="none" />
    </>
  );
}
