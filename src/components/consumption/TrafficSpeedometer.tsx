"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  HardDrive,
  Zap,
} from "lucide-react";
import { ClientProfile } from "@/lib/types";

interface TrafficSpeedometerProps {
  client: ClientProfile;
  mikrotikLive: any;
  isPolling: boolean;
  isManualRefreshing: boolean;
  onManualRefresh: () => void;
  etiquetaActivacion?: string;
  totalGbCiclo?: number;
}

export function TrafficSpeedometer({
  client,
  mikrotikLive,
  isPolling,
  isManualRefreshing,
  onManualRefresh,
  totalGbCiclo = 0,
}: TrafficSpeedometerProps) {
  // Extracción y cálculo de métricas de velocidad
  const planSpeedMatch = String(client.plan?.velocidadBajada || "").match(/\d+/);
  const planMaxMbps = planSpeedMatch ? parseInt(planSpeedMatch[0], 10) : 50;

  const rxMbps = mikrotikLive?.velocidad?.descargaMbps || 0;
  const txMbps = mikrotikLive?.velocidad?.subidaMbps || 0;

  const rxPercent = Math.min(100, Math.max(0, Math.round((rxMbps / planMaxMbps) * 100)));
  const txPercent = Math.min(100, Math.max(0, Math.round((txMbps / planMaxMbps) * 100)));

  // Estado de línea: activa si hay tráfico o el router reporta en línea
  const isLineActive = rxMbps > 0 || txMbps > 0 || Boolean(mikrotikLive?.enLinea);

  const sesionDescarga =
    mikrotikLive?.sesionEnVivo?.descarga ||
    mikrotikLive?.consumo?.descargaFormateada ||
    "0.0 GB";

  const sesionSubida =
    mikrotikLive?.sesionEnVivo?.subida ||
    mikrotikLive?.consumo?.subidaFormateada ||
    "0.0 GB";

  const hasSessionTraffic =
    (mikrotikLive?.consumo?.totalBytes && mikrotikLive.consumo.totalBytes > 0) ||
    (sesionDescarga !== "0.0 GB" && sesionDescarga !== "0 GB");

  const hasAccumulatedData = totalGbCiclo > 0 || hasSessionTraffic;

  return (
    <div className="space-y-4">
      {/* 1. Barra de Estado de la Línea y Botón de Medición */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          {/* Badge de estado de la línea */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans tracking-tight transition-all ${
              isLineActive
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLineActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"
              }`}
            />
            <span>{isLineActive ? "Línea activa" : "En reposo"}</span>
          </div>

          <span className="text-slate-600 dark:text-slate-300 hidden sm:inline">
            {isLineActive
              ? "Conexión activa con respuesta instantánea del router"
              : "Línea conectada en espera de tráfico"}
          </span>
        </div>

        <button
          type="button"
          onClick={onManualRefresh}
          disabled={isManualRefreshing || isPolling}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-xs"
          title="Actualizar velocidad instantánea"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isManualRefreshing || isPolling ? "animate-spin text-sky-500" : ""}`}
          />
          <span>{isManualRefreshing ? "Midiendo..." : "Medir ahora"}</span>
        </button>
      </div>

      {/* 2. Medidores de Velocidad en Tiempo Real: Descarga (RX) y Subida (TX) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Velocímetro de Descarga Actual (RX) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white via-sky-50/20 to-white dark:from-slate-900 dark:via-sky-950/20 dark:to-slate-900 border border-sky-500/20 dark:border-sky-500/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <ArrowDownCircle className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Descarga Actual (RX)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Velocidad entrante a tus dispositivos
                </p>
              </div>
            </div>

            <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
              Plan: {client.plan.velocidadBajada}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
                {mikrotikLive?.velocidad?.descargaMbps !== undefined
                  ? mikrotikLive.velocidad.descargaMbps.toFixed(1)
                  : "0.0"}
              </span>
              <span className="text-sm sm:text-base font-bold text-sky-600 dark:text-sky-400">
                Mbps
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold font-sans tracking-tight tabular-nums text-sky-600 dark:text-sky-400">
                {rxPercent}%
              </span>
              <span className="text-[10px] text-slate-400 block">del plan contratado</span>
            </div>
          </div>

          {/* Barra de progreso de tacómetro */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(2, rxPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-sans tabular-nums">
              <span>0 Mbps</span>
              <span>{Math.round(planMaxMbps / 2)} Mbps</span>
              <span>{planMaxMbps} Mbps</span>
            </div>
          </div>
        </div>

        {/* Velocímetro de Subida Actual (TX) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white via-amber-50/20 to-white dark:from-slate-900 dark:via-amber-950/20 dark:to-slate-900 border border-amber-500/20 dark:border-amber-500/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <ArrowUpCircle className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Subida Actual (TX)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Velocidad de envío y transmisiones
                </p>
              </div>
            </div>

            <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
              Plan: {client.plan.velocidadSubida || client.plan.velocidadBajada}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
                {mikrotikLive?.velocidad?.subidaMbps !== undefined
                  ? mikrotikLive.velocidad.subidaMbps.toFixed(1)
                  : "0.0"}
              </span>
              <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                Mbps
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold font-sans tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                {txPercent}%
              </span>
              <span className="text-[10px] text-slate-400 block">del plan contratado</span>
            </div>
          </div>

          {/* Barra de progreso de tacómetro */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(2, txPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-sans tabular-nums">
              <span>0 Mbps</span>
              <span>{Math.round(planMaxMbps / 2)} Mbps</span>
              <span>{planMaxMbps} Mbps</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Consumo Acumulado (Únicamente si hay datos disponibles) */}
      {hasAccumulatedData && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                Consumo Acumulado del Ciclo
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total registrado de navegación en el período
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto font-sans">
            <span className="text-base sm:text-lg font-bold font-sans tabular-nums text-sky-600 dark:text-sky-400">
              {totalGbCiclo > 0 ? `${totalGbCiclo.toFixed(2)} GB` : `${sesionDescarga}`}
            </span>
            {hasSessionTraffic && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                (Sesión: ↓ {sesionDescarga} / ↑ {sesionSubida})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
