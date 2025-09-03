// Versi SW untuk memaksa update di klien
const SW_VERSION = "2025-09-03-2";

// Update paksa saat ada SW baru
self.addEventListener("install", () => self.skipWaiting());

// Klaim semua tab + kabari klien agar reload
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k))); // hapus cache lama (jaga-jaga)
    } catch (e) {}
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({ type: "SW_UPDATED", version: SW_VERSION });
    }
  })());
});

// Biarkan request langsung ke network (tidak caching di SW)
self.addEventListener("fetch", () => {});

// Terima perintah skip waiting dari halaman
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});
