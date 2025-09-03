"use client";
import { useEffect, useState } from "react";

function isStandaloneNow() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true // iOS
  );
}

export default function InstallButton() {
  const [evt, setEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1) cek status awal
    const fromStorage = localStorage.getItem("fabaro_installed") === "1";
    setInstalled(fromStorage || isStandaloneNow());

    // 2) simpan event install jika tersedia (Android/Chrome)
    const onBefore = (e: any) => {
      e.preventDefault();
      setEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onBefore);

    // 3) saat benar-benar terpasang → sembunyikan tombol + tandai di storage
    const onInstalled = () => {
      setInstalled(true);
      localStorage.setItem("fabaro_installed", "1");
    };
    window.addEventListener("appinstalled", onInstalled);

    // 4) jika user membuka sebagai PWA (standalone) → sembunyikan
    const mm = window.matchMedia("(display-mode: standalone)");
    const onModeChange = () => setInstalled(isStandaloneNow());
    if (mm.addEventListener) mm.addEventListener("change", onModeChange);
    else (mm as any).addListener?.(onModeChange);

    // 5) Android only: cek app terkait
    (async () => {
      try {
        const anyNav: any = navigator;
        if (anyNav.getInstalledRelatedApps) {
          const rel = await anyNav.getInstalledRelatedApps();
          if (rel && rel.length > 0) {
            setInstalled(true);
            localStorage.setItem("fabaro_installed", "1");
          }
        }
      } catch {}
    })();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
      if (mm.removeEventListener) mm.removeEventListener("change", onModeChange);
      else (mm as any).removeListener?.(onModeChange);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (evt) {
      await evt.prompt();
      // beberapa browser set event jadi null setelah prompt
      setEvt(null);
      return;
    }
    // Fallback instruksi jika event belum tersedia (mis. iOS Safari)
    alert(
      "Cara install:\n\n• Android (Chrome): Menu ⋮ → 'Add to Home screen'.\n• iPhone (Safari): Tombol Share → 'Add to Home Screen'."
    );
  };

  return (
    <button
      onClick={handleClick}
      className="px-3 py-2 rounded-lg bg-white text-black text-sm font-semibold"
      aria-label="Install FABARO"
      title="Install FABARO"
    >
      Install
    </button>
  );
}
