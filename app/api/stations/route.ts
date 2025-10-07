// app/api/stations/route.ts
import { NextResponse } from "next/server";

// Pakai Node.js runtime biar bebas fetch ke luar
export const runtime = "nodejs";

// Jangan cache (selalu fresh)
export const dynamic = "force-dynamic";

function withTimeout<T>(p: Promise<T>, ms = 12000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// Endpoint Radio Browser yang cepat (bisa diganti mirror lain kalau perlu)
const RB = "https://de1.api.radio-browser.info/json/stations/search";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const country = searchParams.get("country")?.trim() || "";
    const tag = searchParams.get("tag")?.trim() || "";

    // Radio Browser query
    // Doc: https://api.radio-browser.info/
    const params = new URLSearchParams();
    if (q) params.set("name", q);
    if (country) params.set("country", country);
    if (tag) params.set("tag", tag);
    params.set("hidebroken", "true");
    params.set("order", "votes");
    params.set("reverse", "true");
    params.set("limit", "200");

    // fetch dengan timeout
    const res = await withTimeout(fetch(`${RB}?${params.toString()}`, {
      // Supaya Vercel tidak men-cache
      cache: "no-store",
      headers: { "User-Agent": "fabaro/1.0 (https://fabaroradioonline.vercel.app)" }
    }));

    if (!("ok" in (res as any)) || !(res as any).ok) {
      return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
    }

    const data = await (res as Response).json();

    // Normalisasi minimal agar front-end aman
    const mapped = (Array.isArray(data) ? data : []).map((s: any) => ({
      stationuuid: s.stationuuid,
      name: s.name || s.name_translated || "Unknown",
      favicon: s.favicon || s.homepage || "",
      tags: s.tags || "",
      country: s.country || "",
      url: s.url || "",
      url_resolved: s.url_resolved || s.url || "",
      homepage: s.homepage || "",
      codec: s.codec || "",
      bitrate: Number(s.bitrate || 0),
    }));

    return NextResponse.json(mapped, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (e: any) {
    // Jangan bikin FE nunggu; selalu balas array kosong + status 200 agar UI lanjut
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" }
    });
  }
}
