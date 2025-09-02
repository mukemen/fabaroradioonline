import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "missing url" }, { status: 400 });

  try {
    const resp = await fetch(target, { headers: { "Icy-MetaData": "1", "User-Agent": "Mozilla/5.0" } });
    const headers: Record<string, string|null> = {
      "icy-name": resp.headers.get("icy-name"),
      "icy-genre": resp.headers.get("icy-genre"),
      "content-type": resp.headers.get("content-type"),
      "icy-metaint": resp.headers.get("icy-metaint")
    };
    const metaint = headers["icy-metaint"] ? parseInt(headers["icy-metaint"]!) : 0;
    if (!resp.body || !metaint) return NextResponse.json({ title: null, ...headers });

    const reader = resp.body.getReader();
    let total = 0, audioToSkip = metaint, metadataLength = -1;
    let metaBuf: Uint8Array | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      let offset = 0;
      while (offset < value.length) {
        if (audioToSkip > 0) {
          const chunk = Math.min(audioToSkip, value.length - offset);
          offset += chunk; audioToSkip -= chunk;
        } else if (metadataLength === -1) {
          metadataLength = value[offset] * 16;
          offset += 1;
          if (metadataLength === 0) { audioToSkip = metaint; metadataLength = -1; }
        } else {
          const remaining = value.length - offset;
          const take = Math.min(remaining, metadataLength);
          const slice = value.slice(offset, offset + take);
          metaBuf = metaBuf ? new Uint8Array([...metaBuf, ...slice]) : slice;
          offset += take; metadataLength -= take;
          if (metadataLength === 0) {
            const text = Buffer.from(metaBuf!).toString("latin1");
            const m = /StreamTitle='([^']*)'/.exec(text);
            const title = m ? m[1] : null;
            return NextResponse.json({ title, ...headers });
          }
        }
      }
      total += value.length;
      if (total > metaint + 4096) break;
    }
    return NextResponse.json({ title: null, ...headers });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || "fetch error" }, { status: 500 });
  }
}
