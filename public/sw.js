// Versi SW untuk paksa update di klien
const SW_VERSION = "2025-09-03-3";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Bersihkan cache lama (jaga-jaga)
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    await self.clients.claim();

    // Beri tahu semua tab supaya reload
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({ type: "SW_UPDATED", version: SW_VERSION });
    }
  })());
});

// Tidak caching apa pun—semua langsung ke network
self.addEventListener("fetch", () => {});

// Terima perintah skip waiting dari halaman
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});
