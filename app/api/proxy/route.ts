import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });
  const upstream = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
      "Transfer-Encoding": upstream.headers.get("Transfer-Encoding") || ""
    }
  });
  return res;
}
