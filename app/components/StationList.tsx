"use client";
type Station = any;

export default function StationList({
  stations,
  onPlay,
  toggleFav,
  favorites,
}: {
  stations: Station[];
  onPlay: (s: Station) => void;
  toggleFav: (s: Station) => void;
  favorites: Record<string, boolean>;
}) {
  return (
    <div className="grid gap-3">
      {stations.map((s: any) => (
        <div key={s.stationuuid} className="bg-neutral-900 rounded-2xl p-3">
          {/* GRID: thumb | info | actions (actions turun ke baris 2 saat mobile) */}
          <div className="grid grid-cols-[56px_1fr] md:grid-cols-[64px_1fr_auto] gap-3 items-center">
            {/* thumbnail */}
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden bg-neutral-800">
              <img
                src={s.favicon || "/icon-192.png"}
                alt=""
                className="w-full h-full object-contain"
                onError={(e: any) => {
                  e.currentTarget.src = "/icon-192.png";
                }}
              />
            </div>

            {/* info */}
            <div className="min-w-0">
              <div className="font-semibold truncate">{s.name}</div>
              <div className="text-xs text-neutral-400 truncate">
                {s.country} • {s.codec?.toUpperCase()} • {s.bitrate}kbps
              </div>
              <div className="text-xs text-neutral-500 truncate">{s.tags}</div>
            </div>

            {/* actions (desktop/tablet) */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleFav(s)}
                title="Favorit"
                aria-label="Favorit"
                className={
                  "px-3 py-2 rounded-lg text-sm " +
                  (favorites[s.stationuuid]
                    ? "bg-yellow-300 text-black"
                    : "bg-neutral-800")
                }
              >
                ★
              </button>
              <button
                onClick={() => onPlay(s)}
                aria-label="Putar"
                className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium"
              >
                Putar
              </button>
            </div>

            {/* actions (mobile) – selalu terlihat, di baris kedua */}
            <div className="mt-2 col-span-2 flex md:hidden items-center justify-end gap-2">
              <button
                onClick={() => toggleFav(s)}
                title="Favorit"
                aria-label="Favorit"
                className={
                  "px-3 py-2 rounded-lg text-sm " +
                  (favorites[s.stationuuid]
                    ? "bg-yellow-300 text-black"
                    : "bg-neutral-800")
                }
              >
                ★
              </button>
              <button
                onClick={() => onPlay(s)}
                aria-label="Putar"
                className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium"
              >
                Putar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
