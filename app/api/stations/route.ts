// app/api/stations/route.ts
import { NextResponse } from "next/server";

// Pakai Node runtime (bukan Edge) biar bebas fetch keluar
export const runtime = "nodejs";
// Selalu fresh
export const dynamic = "force-dynamic";

const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://gb1.api.radio-browser.info",
  "https://us1.api.radio-browser.info",
  "https://ca1.api.radio-browser.info",
];

function withTimeout<T>(p: Promise<T>, ms = 12000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function queryMirror(base: string, qs: string) {
  const url = `${base}/json/stations/search?${qs}`;
  const res = await withTimeout(
    fetch(url, {
      cache: "no-store",
      // sebagian mirror menolak UA kosong
      headers: { "User-Agent": "fabaro/1.0 (+https://fabaroradioonline.vercel.app)" },
    }),
    12000,
  );
  if (!("ok" in (res as any)) || !(res as any).ok) throw new Error("upstream not ok");
  return (res as Response).json();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const country = (searchParams.get("country") || "").trim();
    const tag = (searchParams.get("tag") || "").trim();

    const params = new URLSearchParams();
    if (q) params.set("name", q);
    if (country) params.set("country", country);
    if (tag) params.set("tag", tag);
    params.set("hidebroken", "true");
    params.set("order", "votes");
    params.set("reverse", "true");
    params.set("limit", "200");

    // Coba beberapa mirror sampai berhasil
    let data: any[] | null = null;
    let lastErr: unknown = null;
    for (const m of MIRRORS) {
      try {
        const json = await queryMirror(m, params.toString());
        if (Array.isArray(json)) {
          data = json;
          break;
        }
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    if (!data) {
      console.warn("RadioBrowser mirrors failed:", lastErr);
      // Balikkan array kosong supaya UI tidak menggantung
      return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }

    // Normalisasi
    const mapped = data.map((s: any) => ({
      stationuuid: s.stationuuid,
      name: s.name || s.name_translated || "Unknown",
      favicon: s.favicon || "",
      tags: s.tags || "",
      country: s.country || "",
      url: s.url || "",
      url_resolved: s.url_resolved || s.url || "",
      homepage: s.homepage || "",
      codec: s.codec || "",
      bitrate: Number(s.bitrate || 0),
    }));

    return NextResponse.json(mapped, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Jangan biarkan FE menunggu—tetap balas
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  }
}
