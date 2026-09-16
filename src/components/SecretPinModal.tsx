"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Lock, ShieldAlert, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

interface SecretPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SecretPinModal({ isOpen, onClose, onSuccess }: SecretPinModalProps) {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShake, setIsShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setErrorMsg(null);
      setIsShake(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();

    if (cleanPin === "1130") {
      toast.success("Acceso Administrativo Desbloqueado", {
        description: "Bienvenido al Panel de Control Interno de Aponte Plus.",
      });
      onSuccess();
    } else {
      setErrorMsg("PIN incorrecto. Inténtalo de nuevo.");
      setIsShake(true);
      toast.error("Acceso denegado: PIN no válido");
      setTimeout(() => {
        setIsShake(false);
        setPin("");
        inputRef.current?.focus();
      }, 700);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-sm max-h-[90vh] overflow-y-auto overscroll-contain rounded-3xl p-6 bg-slate-900 border border-slate-700 shadow-2xl text-white space-y-5 transition-transform animate-in zoom-in-95 duration-200 ${
          isShake ? "animate-bounce" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Botón de Cerrar (X) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Encabezado del Modal */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Lock className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Acceso Administrativo / Panel Interno
            </h3>
            <p className="text-xs text-slate-400">
              Ingresa el PIN de seguridad de 4 dígitos para habilitar el panel administrativo.
            </p>
          </div>

          {/* Formulario de Validación de PIN */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setPin(e.target.value.replace(/\D/g, ""));
                  }}
                  className="w-full py-3 px-4 text-center text-2xl font-sans font-bold tracking-[0.5em] tabular-nums rounded-2xl bg-slate-800 border-2 border-slate-700 focus:border-amber-400 text-white placeholder-slate-600 focus:outline-none transition-all shadow-inner"
                />
                <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              {errorMsg && (
                <p className="text-center text-xs font-bold text-rose-400 mt-2 flex items-center justify-center gap-1 animate-in fade-in duration-200">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pin.length < 4}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );
  }
