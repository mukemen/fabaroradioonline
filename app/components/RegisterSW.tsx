"use client";
import { useEffect } from "react";

// Ganti angka ini kalau mau paksa semua klien update
const SW_VERSION = "2025-09-03-2";

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const swUrl = `/sw.js?v=${SW_VERSION}`;

    let refreshed = false;
    const onMessage = (e: MessageEvent) => {
      if (e?.data?.type === "SW_UPDATED" && !refreshed) {
        refreshed = true;
        // beri sedikit jeda agar SW baru sudah aktif penuh
        setTimeout(() => window.location.reload(), 150);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Daftarkan SW dengan query versi agar pasti beda URL (bikin update)
    navigator.serviceWorker.register(swUrl).then((reg) => {
      // kalau sudah ada SW baru waiting, suruh langsung aktif
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          // saat "installed" dan sudah ada controller, SW baru akan kirim pesan "SW_UPDATED" saat activate
        });
      });
    }).catch(() => {});

    // Safety: kalau ada SW lama tanpa versi, unregister lalu register ulang
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        if (!url.includes(`v=${SW_VERSION}`)) {
          r.unregister().finally(() => {
            navigator.serviceWorker.register(swUrl).catch(() => {});
          });
        }
      });
    });

    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
