"use client";
import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [evt, setEvt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onBefore = (e: any) => {
      e.preventDefault();
      setEvt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBefore);

    // jika sudah terpasang, jangan tampilkan
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) setShow(false);

    return () => window.removeEventListener("beforeinstallprompt", onBefore);
  }, []);

  if (!show || !evt) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[60] px-4">
      <div className="mx-auto max-w-md rounded-2xl bg-neutral-900/95 border border-neutral-800 p-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" className="w-8 h-8 rounded" />
          <div className="text-sm">
            <div className="font-semibold">Install FABARO</div>
            <div className="text-neutral-400">Akses cepat seperti aplikasi</div>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setShow(false)} className="px-3 py-2 rounded-lg bg-neutral-800 text-sm">
              Nanti
            </button>
            <button
              onClick={async () => { await evt.prompt(); setShow(false); }}
              className="px-3 py-2 rounded-lg bg-white text-black text-sm"
            >
              Install
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
