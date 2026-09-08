"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPWAButton({ variant = "header" }: { variant?: "header" | "banner" }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Detectar si ya está instalada / modo standalone
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      return isDisplayStandalone || isIosStandalone;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // 2. Registrar el Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registrado:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Error registrando Service Worker:", err);
        });
    }

    // 3. Escuchar evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // 4. Escuchar evento appinstalled
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log("[PWA] Aplicación instalada exitosamente.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert(
        "Para instalar en tu dispositivo:\n1. Pulsa el botón de opciones o menú de tu navegador.\n2. Selecciona 'Agregar a la pantalla principal' o 'Instalar'."
      );
      return;
    }

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      setIsInstallable(false);
    }

    setDeferredPrompt(null);
  };

  // Si ya está corriendo como app instalada (standalone), no mostrar el botón
  if (isStandalone) {
    return null;
  }

  // Si estamos en el Header
  if (variant === "header") {
    return (
      <button
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
        title="Instalar aplicación en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />
        <span className="hidden xs:inline">Instalar App</span>
        <span className="xs:hidden">Instalar</span>
      </button>
    );
  }

  // Variante Banner (para pantallas principales)
  return (
    <div className="w-full rounded-2xl p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
            Instalar Aplicación en Pantalla Principal
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Acceso rápido y seguro a tus facturas y comprobantes sin escribir la URL
          </p>
        </div>
      </div>

      <button
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white transition-all flex-shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
        Instalar
      </button>
    </div>
  );
}
