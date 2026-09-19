"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[PWA] Service Worker registrado exitosamente. Scope:", registration.scope);
          // Forzar chequeo de actualización inmediata
          registration.update().catch(() => {});

          // Verificar si hay actualizaciones pendientes del Service Worker
          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA] Nueva versión del Service Worker activada.");
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn("[PWA] Error al registrar el Service Worker:", error);
        });
    }
  }, []);

  return null;
}
