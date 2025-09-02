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
    <div className="grid md:grid-cols-2 gap-3">
      {stations.map(s => (
        <div key={s.stationuuid} className="text-left bg-neutral-900 rounded p-3">
          <div className="flex items-center gap-3">
            <img src={s.favicon || "/icon-192.png"} alt="" className="w-10 h-10 rounded" onError={(e:any)=>{e.currentTarget.src="/icon-192.png"}} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{s.name}</div>
              <div className="text-sm text-neutral-400 truncate">
                {s.country} • {s.codec?.toUpperCase()} • {s.bitrate}kbps
              </div>
              <div className="text-xs text-neutral-500 truncate">{s.tags}</div>
            </div>
            <button onClick={()=>toggleFav(s)} title="Favorit" className={"px-2 py-1 rounded " + (favorites[s.stationuuid] ? "bg-yellow-300 text-black" : "bg-neutral-800")}>
              ★
            </button>
            <button onClick={()=>onPlay(s)} className="px-3 py-1 bg-white text-black rounded">Putar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
