"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Station = any;

export default function Player({ station }: { station: Station|null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [err, setErr] = useState<string>("");
  const [now, setNow] = useState<string>("");
  const [sleepMin, setSleepMin] = useState<number>(0);
  const [expanded, setExpanded] = useState<boolean>(false);

  const sleepTimer = useRef<NodeJS.Timeout|null>(null);
  const retryTimer = useRef<NodeJS.Timeout|null>(null);
  const hlsRef = useRef<Hls|null>(null);

  // Init/Play
  useEffect(() => {
    setErr(""); setNow("");
    const audio = audioRef.current;
    if (!audio || !station) return;

    fetch("/api/analytics", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({evt:"play", name: station.name, url: station.url_resolved || station.url})
    }).catch(()=>{});

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const src = station.url_resolved || station.url || "";
    const play = () => audio.play().catch(()=>{});

    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.on(Hls.Events.ERROR, () => {
        setErr("Gangguan stream, mencoba ulang…");
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          try { hls.stopLoad(); hls.startLoad(); play(); } catch {}
        }, 3000);
      });
      return () => { hls.destroy(); };
    } else {
      audio.src = src;
      play();
      const onError = () => {
        setErr("Gagal memutar (CORS/geo-block/URL rusak).");
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => { audio.load(); play(); }, 3000);
      };
      audio.addEventListener("error", onError);
      return () => audio.removeEventListener("error", onError);
    }
  }, [station]);

  // Now Playing polling
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const pull = async () => {
      if (!station) return;
      try {
        const url = station.url_resolved || station.url;
        const res = await fetch(`/api/nowplaying?url=${encodeURIComponent(url)}`, { cache: "no-store" });
        const j = await res.json();
        if (j && j.title) setNow(j.title);
      } catch {}
    };
    pull();
    timer = setInterval(pull, 15000);
    return () => { if (timer) clearInterval(timer); };
  }, [station]);

  // Sleep timer
  useEffect(() => {
    if (sleepTimer.current) { clearTimeout(sleepTimer.current); sleepTimer.current = null; }
    if (sleepMin > 0 && audioRef.current) {
      sleepTimer.current = setTimeout(() => { audioRef.current?.pause(); }, sleepMin * 60 * 1000);
    }
    return () => { if (sleepTimer.current) clearTimeout(sleepTimer.current); };
  }, [sleepMin]);

  // Mini player UI (fixed bottom)
  return (
    <>
      {/* Expanded sheet */}
      {expanded && station && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={()=>setExpanded(false)}>
          <div className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-neutral-900 p-4 space-y-3" style={{paddingBottom: `calc(1rem + var(--safe-bottom))`}} onClick={(e)=>e.stopPropagation()}>
            <div className="h-1 w-12 bg-neutral-700 rounded-full mx-auto" />
            <div className="font-semibold">{station.name}</div>
            <div className="text-xs text-neutral-400">{station.country} • {station.tags}</div>
            {now && <div className="text-sm text-green-300">Now Playing: {now}</div>}
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <audio ref={audioRef} controls className="w-full" />
            <div className="flex items-center gap-2 text-sm">
              <label className="text-neutral-400">Sleep (menit)</label>
              <input type="number" min={0} max={180} value={sleepMin}
                onChange={(e)=>setSleepMin(parseInt(e.target.value||"0"))}
                className="w-24 bg-neutral-800 rounded px-2 py-2 outline-none"/>
              <button onClick={()=>setSleepMin(0)} className="px-3 py-2 rounded bg-white text-black">Reset</button>
              <button onClick={()=>setExpanded(false)} className="ml-auto px-3 py-2 rounded bg-neutral-800">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Mini bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="m-3 rounded-2xl bg-neutral-900/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/75 border border-neutral-800 px-3 py-2">
            {station ? (
              <div className="flex items-center gap-3">
                <img src={station.favicon || "/icon-192.png"} alt="" className="w-8 h-8 rounded" onError={(e:any)=>{e.currentTarget.src="/icon-192.png"}} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{station.name}</div>
                  <div className="text-xs text-neutral-400 truncate">{now || station.country}</div>
                </div>
                <button onClick={()=>setExpanded(true)} className="ml-auto px-3 py-2 rounded-lg bg-white text-black text-sm">
                  Buka Player
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-neutral-400">Pilih stasiun untuk mulai memutar</div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden audio element keeps playing even if sheet closed */}
      <audio ref={audioRef} className="hidden" />
    </>
  );
}
