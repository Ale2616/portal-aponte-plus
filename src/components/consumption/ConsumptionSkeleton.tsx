"use client";

export function ConsumptionSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando datos de consumo">
      {/* Skeleton de métricas resumidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-3.5 sm:p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 space-y-2"
          >
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="h-7 w-24 bg-slate-300 dark:bg-slate-600 rounded-md" />
            <div className="h-2.5 w-28 bg-slate-200 dark:bg-slate-700/80 rounded-md" />
          </div>
        ))}
      </div>

      {/* Skeleton del área de gráfico */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-100/70 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-44 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
          </div>
        </div>

        {/* Simulación de barras de gráfico */}
        <div className="h-56 sm:h-64 flex items-end justify-around gap-2 pt-8 pb-3 px-2 border-b border-slate-200/60 dark:border-slate-700/50">
          {[45, 75, 30, 90, 60, 80, 50].map((h, idx) => (
            <div key={idx} className="flex-1 flex items-end justify-center gap-1.5 h-full max-w-[48px]">
              <div
                style={{ height: `${h}%` }}
                className="w-1/2 bg-sky-300/40 dark:bg-sky-700/30 rounded-t-md"
              />
              <div
                style={{ height: `${Math.round(h * 0.4)}%` }}
                className="w-1/2 bg-amber-300/40 dark:bg-amber-700/30 rounded-t-md"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-1">
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
        </div>
      </div>
    </div>
  );
}
