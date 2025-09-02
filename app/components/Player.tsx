"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type Station = any;

export default function Player({ station }: { station: Station|null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [err, setErr] = useState<string>("");
      const [now, setNow] = useState<string>("");
  const [sleepMin, setSleepMin] = useState<number>(0);
  const sleepTimer = useRef<NodeJS.Timeout|null>(null);
  const retryTimer = useRef<NodeJS.Timeout|null>(null);
  const hlsRef = useRef<Hls|null>(null);

  // handle play
  useEffect(() => {
    setErr("");
    const audio = ref.current;
    if (!audio || !station) return;

    // cleanup old
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
        retryTimer.current = setTimeout(() => {
          audio.load(); play();
        }, 3000);
      };
      audio.addEventListener("error", onError);
      return () => audio.removeEventListener("error", onError);
    }
  }, [station]);

  // sleep timer
  useEffect(() => {
    if (sleepTimer.current) { clearTimeout(sleepTimer.current); sleepTimer.current = null; }
    if (sleepMin > 0 && ref.current) {
      sleepTimer.current = setTimeout(() => {
        ref.current?.pause();
      }, sleepMin * 60 * 1000);
    }
    return () => { if (sleepTimer.current) clearTimeout(sleepTimer.current); };
  }, [sleepMin]);

  if (!station) return (
    <div className="bg-neutral-900 rounded p-3">Pilih stasiun untuk diputar</div>
  );

  return (
        <div className="bg-neutral-900 rounded p-3 space-y-2">
      <div className="font-semibold">Sedang diputar: {station.name}</div>
      <audio ref={ref} controls className="w-full" />
      {now && <div className="text-sm text-green-300">Now Playing: {now}</div>}
          {err && <div className="text-red-400 text-sm">{err}</div>}
      <div className="text-xs text-neutral-500">
        {station.country} • {station.tags}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label className="text-neutral-400">Sleep timer (menit)</label>
        <input type="number" min={0} max={180} value={sleepMin}
          onChange={(e)=>setSleepMin(parseInt(e.target.value||"0"))}
          className="w-20 bg-neutral-800 rounded px-2 py-1 outline-none"/>
        <button onClick={()=>setSleepMin(0)} className="px-2 py-1 bg-white text-black rounded">Reset</button>
      </div>
    </div>
  );
}
