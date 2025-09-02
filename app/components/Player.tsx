"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Station = any;

export default function Player({ station }: { station: Station|null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [err, setErr] = useState<string>("");
  const [now, setNow] = useState<string>("");
  const [expanded, setExpanded] = useState<boolean>(false);
  const [needTap, setNeedTap] = useState<boolean>(false); // autoplay blocker
  const retryTimer = useRef<NodeJS.Timeout|null>(null);
  const hlsRef = useRef<Hls|null>(null);
  const usedProxyRef = useRef<boolean>(false);

  const needsProxy = (u: string) =>
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    u?.startsWith("http://");
  const buildSrc = (u: string, forceProxy = false) =>
    (forceProxy || needsProxy(u)) ? `/api/proxy?url=${encodeURIComponent(u)}` : u;

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

  useEffect(() => {
    setErr(""); setNow(""); setNeedTap(false); usedProxyRef.current = false;
    const audio = audioRef.current;
    if (!audio || !station) return;

    const raw = station.url_resolved || station.url || "";
    const cleanup = () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };

    const tryPlay = (src: string) => {
      cleanup();
      if (src.includes(".m3u8") && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(audio);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { attemptPlay(); });
        hls.on(Hls.Events.ERROR, () => fallbackToProxy());
      } else {
        audio.src = src;
        audio.load();
        attemptPlay().catch(()=>{});
        audio.onerror = () => fallbackToProxy();
      }
    };

    const fallbackToProxy = () => {
      if (usedProxyRef.current) { setErr("Gagal memutar (CORS/geo-block/URL rusak)."); return; }
      usedProxyRef.current = true;
      setErr("Mencoba mode proxy…");
      const proxied = buildSrc(raw, true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => tryPlay(proxied), 300);
    };

    tryPlay(buildSrc(raw));
    return cleanup;
  }, [station]);

  // Now Playing polling (ICY)
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
    pull(); t = setInterval(pull, 15000);
    return () => { if (t) clearInterval(t); };
  }, [station]);

  return (
    <>
      {expanded && station && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={()=>setExpanded(false)}>
          <div className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-neutral-900 p-4 space-y-3"
               style={{paddingBottom: `calc(1rem + env(safe-area-inset-bottom))`}}
               onClick={(e)=>e.stopPropagation()}>
            <div className="h-1 w-12 bg-neutral-700 rounded-full mx-auto" />
            <div className="font-semibold">{station.name}</div>
            <div className="text-xs text-neutral-400">{station.country} • {station.tags}</div>
            {now && <div className="text-sm text-green-300">Now Playing: {now}</div>}
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <audio ref={audioRef} controls className="w-full" />
            <div className="flex justify-end gap-2">
              {needTap && <button onClick={attemptPlay} className="px-3 py-2 rounded bg-white text-black">Putar</button>}
              <button onClick={()=>setExpanded(false)} className="px-3 py-2 rounded bg-neutral-800">Tutup</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-3 my-1 rounded-2xl bg-neutral-900/95 backdrop-blur border border-neutral-800 px-3 py-2">
            {station ? (
              <div className="flex items-center gap-3">
                <img src={station.favicon || "/icon-192.png"} alt="" className="w-8 h-8 rounded"
                     onError={(e:any)=>{e.currentTarget.src="/icon-192.png"}} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{station.name}</div>
                  <div className="text-xs text-neutral-400 truncate">{now || station.country}</div>
                </div>
                {needTap ? (
                  <button onClick={attemptPlay} className="ml-auto px-3 py-2 rounded-lg bg-white text-black text-sm">
                    Putar
                  </button>
                ) : (
                  <button onClick={()=>setExpanded(true)} className="ml-auto px-3 py-2 rounded-lg bg-white text-black text-sm">
                    Buka Player
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center text-sm text-neutral-400">Pilih stasiun untuk mulai memutar</div>
            )}
          </div>
        </div>
      </div>

      {/* Keep audio alive */}
      <audio ref={audioRef} className="hidden" />
    </>
  );
}
