"use client";

import { useState } from "react";
import { branding } from "@/config/branding";
import { getDemoClientNumbers } from "@/lib/wisphub";
import { InstallPWAButton } from "./InstallPWAButton";
import {
  Search,
  Loader2,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertCircle,
  FileText,
} from "lucide-react";

interface SearchScreenProps {
  onSearch: (documento: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function SearchScreen({ onSearch, isLoading, error }: SearchScreenProps) {
  const [documento, setDocumento] = useState("");
  const demoClients = getDemoClientNumbers();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento.trim()) return;
    onSearch(documento);
  };

  const handleDemoClick = (cedula: string) => {
    setDocumento(cedula);
    onSearch(cedula);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Card Principal de Búsqueda */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-auto h-20 sm:h-22 mx-auto flex items-center justify-center p-2 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm max-w-[240px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-full w-auto object-contain"
            />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Portal de Autogestión
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {branding.companyName}
            </p>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Ingresa tu cédula o número de documento para consultar tu estado de cuenta y reportar pagos.
          </p>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="cedula-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Cédula / Documento de Identidad
            </label>
            <div className="relative">
              <input
                id="cedula-input"
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ej. 1020304050"
                autoFocus
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-2xl text-base font-mono font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all disabled:opacity-50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !documento.trim()}
            className="w-full py-3 px-6 rounded-2xl font-semibold text-sm bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 active:bg-slate-950 text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                <span>Consultando abonado...</span>
              </>
            ) : (
              <>
                <span>Ingresar al Portal</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </>
            )}
          </button>
        </form>

        {/* Cuentas de Acceso Rápido */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
              Cuentas de Consulta Rápida:
            </span>
          </div>

          <div className="space-y-1.5">
            {demoClients.map((demo) => (
              <button
                key={demo.cedula}
                type="button"
                onClick={() => handleDemoClick(demo.cedula)}
                disabled={isLoading}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-between gap-2 cursor-pointer"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {demo.label}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    C.C. {demo.cedula}
                  </p>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {demo.tag}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Seguridad */}
        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-400 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
          <span>Consulta segura por documento • Conexión cifrada</span>
        </div>
      </div>

      {/* Banner PWA */}
      <InstallPWAButton variant="banner" />

      {/* Enlace Directo / Ayuda */}
      <div className="rounded-2xl p-4 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
          ¿Accedes desde un mensaje de texto o WhatsApp?
        </p>
        <p>
          Si cuentas con un enlace directo con tu cédula (<code className="font-mono text-slate-700 dark:text-slate-300">?cedula=1020304050</code>), ingresarás automáticamente.
        </p>
      </div>
    </div>
  );
}
