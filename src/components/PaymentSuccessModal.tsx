"use client";

import { useEffect } from "react";
import { CheckCircle2, Sparkles, X, ShieldCheck, Wifi } from "lucide-react";
import confetti from "canvas-confetti";
import { playPaymentSuccessChime } from "@/lib/sound";

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  cedula?: string;
  monto?: number | string;
}

export function PaymentSuccessModal({
  isOpen,
  onClose,
  clientName,
  cedula,
  monto,
}: PaymentSuccessModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    // 1. Reproducir sonido sutil de confirmación
    playPaymentSuccessChime();

    // 2. Disparar confeti festivo
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#10b981", "#0284c7", "#f59e0b", "#38bdf8", "#34d399"],
      });
    } catch {
      // Manejo silencioso en caso de no soporte
    }

    // 3. Listener para cerrar con tecla Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/20 shadow-2xl shadow-emerald-500/10 p-6 sm:p-8 space-y-6 text-center transform animate-in zoom-in-95 duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Destello decorativo superior */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Botón de cierre */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icono central de confirmación con animación de pulso */}
        <div className="mx-auto relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/30">
          <div className="w-full h-full rounded-3xl bg-white dark:bg-slate-900 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-in zoom-in-75 duration-500" strokeWidth={2.4} />
          </div>
          <div className="absolute -top-1 -right-1 p-1.5 rounded-full bg-amber-400 text-slate-950 shadow-md animate-bounce">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </div>
        </div>

        {/* Textos destacados obligatorios */}
        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            ¡Pago Registrado con Éxito! 🎉
          </h3>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Gracias por tu pago, tu servicio se encuentra al día.
          </p>
        </div>

        {/* Tarjeta de estado de cuenta actualizado */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Estado del servicio:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full text-[11px]">
              <Wifi className="w-3 h-3" />
              Activo / Al Día
            </span>
          </div>

          {clientName && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Titular:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {clientName}
              </span>
            </div>
          )}

          {cedula && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Documento:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {cedula}
              </span>
            </div>
          )}

          {monto && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-500/20">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Saldo pendiente:</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                $0 COP
              </span>
            </div>
          )}
        </div>

        {/* Garantía de verificación */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Confirmación procesada y sincronizada en tiempo real</span>
        </div>

        {/* Botón principal */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25 transition-all duration-200 cursor-pointer active:scale-[0.98]"
        >
          Entendido, continuar
        </button>
      </div>
    </div>
  );
}
