import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const country = searchParams.get("country") || "";
  const tag = searchParams.get("tag") || "";
  const base = "https://de1.api.radio-browser.info/json/stations/search";
  const url = new URL(base);
  if (q) url.searchParams.set("name", q);
  if (country) url.searchParams.set("country", country);
  if (tag) url.searchParams.set("tag", tag);
  url.searchParams.set("hidebroken", "true");
  url.searchParams.set("order", "clickcount");
  url.searchParams.set("reverse", "true");
  url.searchParams.set("limit", "120");

  const res = await fetch(url.toString(), { next: { revalidate: 0 }});
  const data = await res.json();
  return NextResponse.json(data);
}
