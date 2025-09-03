"use client";
import { useEffect } from "react";

// Ganti angka ini untuk memaksa klien ambil SW baru
const SW_VERSION = "2025-09-03-3";

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const swUrl = `/sw.js?v=${SW_VERSION}`;
    let refreshed = false;

    const onMessage = (e: MessageEvent) => {
      if (e?.data?.type === "SW_UPDATED" && !refreshed) {
        refreshed = true;
        // beri jeda kecil agar SW benar2 aktif, lalu reload halaman
        setTimeout(() => window.location.reload(), 150);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Daftarkan SW (pakai query versi agar URL beda → trigger update)
    navigator.serviceWorker.register(swUrl).then((reg) => {
      // Jika SW baru sudah waiting, minta langsung aktif
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          // SW akan kirim pesan "SW_UPDATED" saat activate
        });
      });
    }).catch(() => {});

    // Pastikan registrasi lama tergantikan oleh yang ber-versi baru
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

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
