"use client";

import { BarChart3, Wifi, Sparkles } from "lucide-react";

interface ConsumptionEmptyStateProps {
  periodoNombre?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function ConsumptionEmptyState({
  periodoNombre = "este periodo",
  onRefresh,
  isRefreshing = false,
}: ConsumptionEmptyStateProps) {
  return (
    <div className="w-full py-10 px-4 sm:px-6 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20">
        <BarChart3 className="w-6 h-6" strokeWidth={1.8} />
      </div>

      <div className="max-w-md space-y-1">
        <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
          Sin registros de consumo en este periodo
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Los datos de navegación para <span className="font-semibold text-slate-700 dark:text-slate-300">{periodoNombre}</span> se sincronizan y consolidan de forma continua a través de la red de fibra óptica.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-sans font-medium text-slate-600 dark:text-slate-300 shadow-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Línea lista para registrar tráfico</span>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 cursor-pointer disabled:opacity-50"
        >
          <span>{isRefreshing ? "Comprobando..." : "Actualizar registros"}</span>
        </button>
      )}
    </div>
  );
}
