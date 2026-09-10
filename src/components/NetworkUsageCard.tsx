"use client";

import { useState, useEffect } from "react";
import { ClientProfile, DayUsage, NetworkUsageData } from "@/lib/types";
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  HardDrive,
  Calendar,
  Sparkles,
  Info,
  Clock,
  Wifi,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface NetworkUsageCardProps {
  client: ClientProfile;
}

export function NetworkUsageCard({ client }: NetworkUsageCardProps) {
  const [hoveredDay, setHoveredDay] = useState<DayUsage | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [liveConsumo, setLiveConsumo] = useState<NetworkUsageData | null>(null);

  // Consumo real calculado desde WispHub sin ningún dato simulado ni aleatorio
  const consumo: NetworkUsageData = liveConsumo || client.consumoRed || {
    totalGb: 0,
    totalDownloadGb: 0,
    totalUploadGb: 0,
    fechaInstalacion: client.fechaInstalacion || null,
    fechaInstalacionLabel: client.fechaInstalacion || "Fecha no registrada",
    diasActivo: 1,
    esServicioNuevo: true,
    mensajeEstado: "Servicio nuevo: recopilando historial de navegación",
    sesionEnVivo: {
      descarga: "0.0 GB",
      subida: "0.0 GB",
    },
    dias: [],
  };

  // Cargar datos reales de tráfico vía scraping al montar el componente
  useEffect(() => {
    const fetchTraffic = async () => {
      if (!client.id) return;
      setIsSyncing(true);
      setSyncError(null);

      try {
        const res = await fetch(`/api/cliente/consumo?id_servicio=${encodeURIComponent(client.id)}`);
        const data = await res.json();

        if (data.success && data.consumo) {
          setLiveConsumo(data.consumo);
          setSyncError(null);
        } else if (data.syncStatus === "sync_failed" || !data.success) {
          setSyncError(data.error || "Error al sincronizar tráfico");
        }
      } catch {
        setSyncError("No se pudo conectar con el servidor de tráfico");
      } finally {
        setIsSyncing(false);
      }
    };

    fetchTraffic();
  }, [client.id]);

  const dias = consumo.dias || [];
  const maxDayGb = Math.max(1, ...dias.map((d) => d.totalGb));

  return (
    <div className="w-full rounded-3xl p-4 sm:p-6 md:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5 sm:space-y-6 overflow-hidden">
      {/* Header de la tarjeta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Activity className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Mi Consumo de Internet
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Fibra Activa
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Monitoreo de tráfico real sincronizado con MikroTik WispHub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-sans font-semibold tracking-tight tabular-nums text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Activación: {consumo.fechaInstalacionLabel}</span>
        </div>
      </div>

      {/* Banner de sincronización / error */}
      {isSyncing && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 animate-pulse">
          <Loader2 className="w-4 h-4 text-sky-500 animate-spin flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
              Sincronizando consumo con el servidor...
            </p>
            <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-0.5">
              Obteniendo datos reales de Traffic Flow desde WispHub
            </p>
          </div>
        </div>
      )}

      {syncError && !isSyncing && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Sincronización de tráfico en proceso
            </p>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              Recarga la página en unos minutos para ver los datos actualizados
            </p>
          </div>
          <button
            onClick={() => {
              setIsSyncing(true);
              setSyncError(null);
              fetch(`/api/cliente/consumo?id_servicio=${encodeURIComponent(client.id)}`)
                .then((r) => r.json())
                .then((data) => {
                  if (data.success && data.consumo) {
                    setLiveConsumo(data.consumo);
                    setSyncError(null);
                  } else {
                    setSyncError(data.error || "Reintento fallido");
                  }
                })
                .catch(() => setSyncError("Error de conexión"))
                .finally(() => setIsSyncing(false));
            }}
            className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            title="Reintentar sincronización"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </button>
        </div>
      )}

      {/* Grid de Métricas Principales Reales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* 1. Consumo Total Acumulado */}
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate block">
              Consumo Total
            </span>
            <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0" strokeWidth={1.75} />
          </div>
          <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-100 truncate">
            {consumo.totalGb}{" "}
            <span className="text-xs font-sans font-semibold text-slate-400">GB</span>
          </p>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate" title={`Consumo total acumulado: ${consumo.totalGb} GB`}>
            Total ciclo: <strong className="text-slate-700 dark:text-slate-300 font-sans font-bold tracking-tight tabular-nums">{consumo.totalGb} GB</strong>
          </span>
        </div>

        {/* 2. Consumo Hoy */}
        <div className="p-3 sm:p-4 rounded-2xl bg-sky-500/10 dark:bg-sky-950/30 border border-sky-500/20 dark:border-sky-800/40 space-y-1 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold truncate block">
              Consumo Hoy {consumo.consumoHoy?.diaLabel ? `(${consumo.consumoHoy.diaLabel})` : ""}
            </span>
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0" strokeWidth={1.75} />
          </div>
          <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-sans tracking-tight tabular-nums text-sky-600 dark:text-sky-400 truncate">
            {(consumo.consumoHoy?.totalGb ?? (dias[dias.length - 1]?.totalGb || 0)).toFixed(2)}{" "}
            <span className="text-xs font-sans font-semibold text-sky-500/80">GB</span>
          </p>
          <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 font-medium block truncate font-sans tracking-tight tabular-nums">
            ↓ {(consumo.consumoHoy?.downloadGb ?? (dias[dias.length - 1]?.downloadGb || 0)).toFixed(1)} / ↑ {(consumo.consumoHoy?.uploadGb ?? (dias[dias.length - 1]?.uploadGb || 0)).toFixed(1)} GB
          </span>
        </div>

        {/* 3. Velocidad Plan */}
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate block">
              Vel. Contratada
            </span>
            <ArrowDownCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0" strokeWidth={1.75} />
          </div>
          <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-100 truncate">
            {client.plan.velocidadBajada}
          </p>
          <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block truncate">
            100% Simétrica Dedicada
          </span>
        </div>

        {/* 4. Sesión en Vivo MikroTik */}
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate block">
              Sesión en Vivo
            </span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.75} />
          </div>
          <p className="text-base sm:text-lg lg:text-xl font-bold font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-100 truncate">
            <span className="text-sky-600 dark:text-sky-400">
              ↓ {consumo.sesionEnVivo?.descarga || `${(consumo.consumoHoy?.downloadGb ?? 0).toFixed(1)} GB`}
            </span>
          </p>
          <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block truncate font-sans tracking-tight tabular-nums">
            ↑ {consumo.sesionEnVivo?.subida || `${(consumo.consumoHoy?.uploadGb ?? 0).toFixed(1)} GB`} • MikroTik Sync
          </span>
        </div>
      </div>

      {/* Barra de Telemetría Activa Sincronizada con MikroTik y WispHub */}
      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="text-slate-700 dark:text-slate-200">
            <strong>Tráfico MikroTik Sincronizado:</strong> Registros de navegación consolidados directamente en WispHub para el servicio #{client.id}.
          </span>
        </div>
        <div className="flex items-center gap-2 font-sans font-semibold tracking-tight tabular-nums text-[11px] text-slate-500 dark:text-slate-400 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>IP: {client.servicio.ip}</span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Datos en Tiempo Real</span>
        </div>
      </div>

      {/* Gráfica de Barras por Fecha de Activación */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Tráfico Diario de Navegación (GB)
            </span>
            <span className="text-[11px] text-slate-400">
              • Datos reales normalizados (MiB / 1024)
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
              <span>Descarga / Bajada (Azul)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span>Subida (Verde)</span>
            </div>
          </div>
        </div>

        {/* Contenedor del Gráfico con escala proporcional */}
        <div className="relative p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800/80">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 h-52 sm:h-60 items-end pt-6">
            {dias.map((day) => {
              // Escala proporcional exacta a partir de los datos reales de WispHub
              const downloadHeight = day.activo && day.downloadGb > 0
                ? Math.min(96, Math.max(4, Math.round((day.downloadGb / maxDayGb) * 92)))
                : 0;
              const uploadHeight = day.activo && day.uploadGb > 0
                ? Math.min(96, Math.max(4, Math.round((day.uploadGb / maxDayGb) * 92)))
                : 0;
              const isHovered = hoveredDay?.fecha === day.fecha;

              return (
                <div
                  key={day.fecha}
                  className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Etiqueta con el consumo diario exacto */}
                  {day.activo && (
                    <span className={`mb-1.5 text-[10px] sm:text-xs font-bold font-sans tracking-tight tabular-nums px-1.5 py-0.5 rounded-md border shadow-sm transition-transform group-hover:scale-105 ${
                      day.totalGb > 0
                        ? "text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700"
                        : "text-slate-400 dark:text-slate-500 bg-slate-100/60 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800"
                    }`}>
                      {day.totalGb > 0 ? (day.totalGb >= 1 ? `${day.totalGb.toFixed(1)} GB` : `${(day.totalGb * 1024).toFixed(0)} MB`) : "0 GB"}
                    </span>
                  )}

                  {/* Tooltip Flotante */}
                  {isHovered && (
                    <div className="absolute -top-16 z-20 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-sans tracking-tight tabular-nums shadow-xl border border-slate-700 whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                      <p className="font-bold text-sky-400">
                        {day.dayName} ({day.fecha})
                      </p>
                      <p className="text-slate-200 font-semibold">{day.label}</p>
                      {day.activo ? (
                        <p className="text-xs mt-0.5 font-bold text-emerald-400 font-sans tracking-tight tabular-nums">
                          Total: {day.totalGb} GB (↓ {day.downloadGb} GB / ↑ {day.uploadGb} GB)
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">Sin servicio instalado</p>
                      )}
                    </div>
                  )}

                  {/* Barras o Marcador Inactivo */}
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full max-w-[52px]">
                    {day.activo ? (
                      <>
                        {/* Barra Bajada (Azul) */}
                        <div
                          style={{ height: `${downloadHeight}%` }}
                          className={`w-1/2 rounded-t-lg bg-sky-500 transition-all duration-300 ${
                            downloadHeight === 0
                              ? "min-h-[2px] bg-slate-200 dark:bg-slate-700/60"
                              : isHovered
                              ? "bg-sky-400 brightness-110 shadow-lg shadow-sky-500/40"
                              : "opacity-95"
                          }`}
                        />
                        {/* Barra Subida (Verde) */}
                        <div
                          style={{ height: `${uploadHeight}%` }}
                          className={`w-1/2 rounded-t-lg bg-emerald-500 transition-all duration-300 ${
                            uploadHeight === 0
                              ? "min-h-[2px] bg-slate-200 dark:bg-slate-700/60"
                              : isHovered
                              ? "bg-emerald-400 brightness-110 shadow-lg shadow-emerald-500/40"
                              : "opacity-95"
                          }`}
                        />
                      </>
                    ) : (
                      /* Días Previos a Instalación (Sin Servicio Previo) */
                      <div className="w-full h-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/30 flex items-center justify-center">
                        <span className="text-[9px] text-slate-400 font-sans text-center leading-none px-1">
                          N/A
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Etiqueta del Día */}
                  <span
                    className={`mt-2.5 text-xs font-semibold font-sans tracking-tight transition-colors ${
                      !day.activo
                        ? "text-slate-300 dark:text-slate-600 line-through"
                        : isHovered
                        ? "text-sky-600 dark:text-sky-400 font-bold"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {day.dayShort}
                  </span>
                  <span className="text-[9px] text-slate-400 truncate max-w-full font-sans tracking-tight">
                    {day.activo ? day.label?.replace(" (Instalación)", "")?.replace(" (Hoy)", "") : "Previo"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Panel Informativo Inferior */}
          {hoveredDay ? (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-300 animate-in fade-in">
              <span className="font-bold text-slate-900 dark:text-slate-100 font-sans">
                {hoveredDay.dayName}: {hoveredDay.label}
              </span>
              <div className="flex items-center gap-4 text-[11px] font-sans font-semibold tracking-tight tabular-nums">
                {hoveredDay.activo ? (
                  <>
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">
                      ↓ {hoveredDay.downloadGb} GB Bajada
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      ↑ {hoveredDay.uploadGb} GB Subida
                    </span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold">
                      Total: {hoveredDay.totalGb} GB
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 italic">
                    El servicio aún no había sido instalado en esta fecha
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span>
                Datos medidos y sincronizados directamente con WispHub y la cola simple de MikroTik.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
