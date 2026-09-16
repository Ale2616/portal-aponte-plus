"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gauge, X, ExternalLink, ShieldCheck } from "lucide-react";

interface SpeedTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPEED_TEST_URL = "https://medidor.azteca-comunicaciones.com/?notitle=1";
const FULLSCREEN_TEST_URL = "https://medidor.azteca-comunicaciones.com/";

export function SpeedTestModal({ isOpen, onClose }: SpeedTestModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingIframe(true);
    }
  }, [isOpen]);

  // Bloqueo estricto del scroll del fondo (body scroll-lock)
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow || "unset";
        document.documentElement.style.overflow = "";
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg sm:max-w-xl md:max-w-[760px] max-h-[90vh] overflow-y-auto overscroll-contain flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-cyan-950/50 text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Línea reflectiva superior */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none" />

          {/* ─── CABECERA DEL MODAL ────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800/90 bg-slate-950/70">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-inner flex-shrink-0">
                <Gauge className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm md:text-base font-bold text-white tracking-tight truncate">
                  Medidor de Velocidad - Red Azteca
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  Subida, bajada y latencia en tiempo real
                </p>
              </div>
            </div>

            {/* Botón de Cerrar (X) */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ─── CUERPO DEL MODAL (IFRAME SPEEDTEST ADAPTADO A MÓVIL Y PC) ─── */}
          <div className="relative flex-1 p-2 sm:p-4 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
            {/* Contenedor visible calibrado */}
            <div className="relative w-full h-[385px] sm:h-[530px] overflow-hidden rounded-xl bg-[#074057] flex items-center justify-center">
              {isLoadingIframe && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#074057] text-slate-300 space-y-3 z-10 pointer-events-none">
                  <div className="w-9 h-9 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                  <p className="text-xs font-semibold tracking-wide text-cyan-200">
                    Cargando medidor de velocidad...
                  </p>
                </div>
              )}

              <iframe
                src={SPEED_TEST_URL}
                title="Test de Velocidad Azteca"
                scrolling="no"
                allow="geolocation; microphone; camera"
                loading="lazy"
                onLoad={() => setIsLoadingIframe(false)}
                className="
                  border-0 max-w-none absolute origin-top left-1/2 -translate-x-1/2
                  /* MÓVIL: centrado absoluto perfecto al 50%, cuadrícula 2x2 con Iniciar y los 4 tacómetros visibles */
                  w-[660px] h-[640px] top-[-12px] scale-[0.48] min-[375px]:scale-[0.51] min-[390px]:scale-[0.54] min-[430px]:scale-[0.58]
                  /* PC / TABLET: centrado completo con Iniciar y los 4 tacómetros visibles */
                  sm:w-[700px] sm:h-[620px] sm:top-[-15px] sm:scale-[0.88] md:scale-[0.92]
                "
              />
            </div>
          </div>

          {/* ─── PIE DEL MODAL (ENLACE DE RESPALDO Y CRÉDITOS) ──────────────── */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-800/80 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Servidor optimizado para fibra óptica</span>
            </div>

            <a
              href={FULLSCREEN_TEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors py-1 px-2.5 rounded-lg bg-cyan-950/50 border border-cyan-500/20 hover:border-cyan-500/40 text-xs"
            >
              <span>Pantalla completa</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>,
      document.body
    );
  }

export default SpeedTestModal;
