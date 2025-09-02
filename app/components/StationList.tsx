"use client";
type Station = any;

export default function StationList({
  stations, onPlay, toggleFav, favorites
}: {
  stations: Station[];
  onPlay: (s: Station)=>void;
  toggleFav: (s: Station)=>void;
  favorites: Record<string, boolean>;
}) {
  return (
    <div className="grid gap-3">
      {stations.map((s: any) => (
        <div key={s.stationuuid} className="bg-neutral-900 rounded-2xl p-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-neutral-800">
              <img src={s.favicon || "/icon-192.png"} alt="" className="w-full h-full object-contain"
                   onError={(e:any)=>{e.currentTarget.src="/icon-192.png"}} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{s.name}</div>
              <div className="text-xs text-neutral-400 truncate">
                {s.country} • {s.codec?.toUpperCase()} • {s.bitrate}kbps
              </div>
              <div className="text-xs text-neutral-500 line-clamp-1">{s.tags}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={()=>toggleFav(s)} className={"px-3 py-2 rounded-lg text-sm " + (favorites[s.stationuuid] ? "bg-yellow-300 text-black" : "bg-neutral-800")}>★</button>
              <button onClick={()=>onPlay(s)} className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium">Putar</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
