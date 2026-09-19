"use client";

import { useState, useEffect, useCallback } from "react";
import { ClientProfile, DayUsage, NetworkUsageData } from "@/lib/types";
import { toast } from "sonner";
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
  Gauge,
  Zap,
} from "lucide-react";

interface NetworkUsageCardProps {
  client: ClientProfile;
}

export function NetworkUsageCard({ client }: NetworkUsageCardProps) {
  const [hoveredDay, setHoveredDay] = useState<DayUsage | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [liveConsumo, setLiveConsumo] = useState<NetworkUsageData | null>(null);
  const [mikrotikLive, setMikrotikLive] = useState<any>(null);
  const [isMikrotikPolling, setIsMikrotikPolling] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);


  // 1. Extraer la fecha real de activación en el orden solicitado:
  const servicioActivo = (client as any)?.servicioActivo || client?.servicio;
  const clienteActivo = (client as any)?.clienteActivo || client;

  // Extraer posibles facturas o facturas históricas para respaldo si no hay fecha explícita
  const facturas = (client as any)?.invoices || (client as any)?.facturas || [];
  let oldestInvoiceDate: string | null = null;
  if (Array.isArray(facturas) && facturas.length > 0) {
    const dates = facturas
      .map((i: any) => i.fechaEmision || i.fecha || i.fechaVencimiento)
      .filter(Boolean)
      .sort();
    if (dates.length > 0) {
      oldestInvoiceDate = dates[0];
    }
  }

  const fechaReal =
    servicioActivo?.fecha_instalacion ||
    servicioActivo?.fecha_alta ||
    servicioActivo?.fecha_ingreso ||
    servicioActivo?.fecha_activacion ||
    clienteActivo?.fecha_instalacion ||
    clienteActivo?.fecha_alta ||
    clienteActivo?.fecha_ingreso ||
    clienteActivo?.fecha_activacion ||
    client?.fecha_instalacion ||
    client?.fecha_alta ||
    client?.fecha_ingreso ||
    client?.fechaInstalacion ||
    client?.fechaRegistro ||
    servicioActivo?.created_at ||
    clienteActivo?.created_at ||
    client?.created_at ||
    oldestInvoiceDate;

  const formatearFecha = (f?: string | null): string | null => {
    if (!f) return null;
    const str = String(f).trim();
    if (
      !str ||
      str.toLowerCase().includes("validaci") ||
      str.toLowerCase().includes("null") ||
      str.toLowerCase().includes("undefined")
    ) {
      return null;
    }

    const meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    // 1. Formato DD/MM/YYYY o DD-MM-YYYY (con o sin hora, ej: "09/11/2021 12:03:00")
    const dmyMatch = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10);
      const y = parseInt(dmyMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${d} de ${meses[m - 1]}, ${y}`;
      }
    }

    // 2. Formato YYYY-MM-DD o YYYY/MM/DD (con o sin hora o T, ej: "2021-11-09")
    const ymdMatch = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10);
      const d = parseInt(ymdMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${d} de ${meses[m - 1]}, ${y}`;
      }
    }

    // 3. Fallback general a Date evitando desfase horario UTC
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const m = parsed.getUTCMonth();
      const d = parsed.getUTCDate();
      return `${d} de ${meses[m]}, ${y}`;
    }

    return null;
  };

  const fechaFormateada =
    formatearFecha(fechaReal) ||
    formatearFecha(liveConsumo?.fechaInstalacion) ||
    formatearFecha(client.consumoRed?.fechaInstalacion) ||
    formatearFecha(oldestInvoiceDate);

  const etiquetaActivacion = `🗓️ Activación: ${fechaFormateada || 'Fecha en validación'}`;

  // Consumo real calculado desde WispHub sin ningún dato simulado ni aleatorio
  const consumo: NetworkUsageData = liveConsumo || client.consumoRed || {
    totalGb: 0,
    totalDownloadGb: 0,
    totalUploadGb: 0,
    fechaInstalacion: fechaReal || client.fechaInstalacion || null,
    fechaInstalacionLabel: fechaFormateada ? `${fechaFormateada}` : "Fecha en validación",
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

  // Extraer IP y Cédula para consultar MikroTik RouterOS
  const rawIp = servicioActivo?.ip || (client as any)?.ip || client?.servicio?.ip || "";
  const clientIp = typeof rawIp === "string" ? rawIp.trim().replace(/^["']|["']$/g, "") : "";
  const hasValidIp = Boolean(
    clientIp &&
    clientIp !== "0.0.0.0" &&
    !clientIp.toLowerCase().includes("no asignada") &&
    !clientIp.toLowerCase().includes("null") &&
    !clientIp.toLowerCase().includes("undefined")
  );

  const rawCedula = client.cedula || (client as any)?.documento || "";
  const clientCedula = typeof rawCedula === "string" ? rawCedula.trim() : String(rawCedula || "");
  const canQueryMikrotik = Boolean(hasValidIp || clientCedula);

  // Consulta optimizada a la API /api/trafico con soporte de IP y cédula
  const fetchMikrotikLive = useCallback(
    async (isManual = false) => {
      if (!canQueryMikrotik) return;
      if (!isManual && typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      try {
        setIsMikrotikPolling(true);
        const params = new URLSearchParams();
        if (clientIp) params.set("ip", clientIp);
        if (clientCedula) params.set("cedula", clientCedula);
        if (client.id) params.set("id", String(client.id));

        const res = await fetch(`/api/trafico?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success) {
          setMikrotikLive(data);
        }
      } catch {
        // Manejo silencioso defensivo
      } finally {
        setIsMikrotikPolling(false);
      }
    },
    [canQueryMikrotik, clientIp, clientCedula, client.id]
  );

  // Sondeo ligero a MikroTik cada 8 segundos con detector de visibilidad de pestaña
  useEffect(() => {
    if (!canQueryMikrotik) return;

    fetchMikrotikLive();

    const timerId = setInterval(() => {
      fetchMikrotikLive();
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMikrotikLive();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [canQueryMikrotik, fetchMikrotikLive]);

  // Actualización manual bajo demanda con protección contra saturación (cooldown 3s)
  const handleManualRefresh = async () => {
    const now = Date.now();
    if (now - lastRefreshTime < 3000) {
      toast.info("Por favor espera un momento antes de volver a consultar el router");
      return;
    }

    setIsManualRefreshing(true);
    setLastRefreshTime(now);

    try {
      await Promise.all([
        fetchMikrotikLive(true),
        (async () => {
          if (!client.id) return;
          try {
            const res = await fetch(`/api/cliente/consumo?id_servicio=${encodeURIComponent(client.id)}`);
            const data = await res.json();
            if (data.success && data.consumo) {
              setLiveConsumo(data.consumo);
              setSyncError(null);
            }
          } catch {
            // Ignorar
          }
        })(),
      ]);
      toast.success("Consumo y velocidad actualizados");
    } catch {
      toast.error("No se pudo actualizar el tráfico");
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // Cálculo del porcentaje de velocidad contratada para tacómetro
  const planSpeedMatch = String(client.plan?.velocidadBajada || "").match(/\d+/);
  const planMaxMbps = planSpeedMatch ? parseInt(planSpeedMatch[0], 10) : 50;
  const rxMbps = mikrotikLive?.velocidad?.descargaMbps || 0;
  const txMbps = mikrotikLive?.velocidad?.subidaMbps || 0;
  const rxPercent = Math.min(100, Math.max(0, Math.round((rxMbps / planMaxMbps) * 100)));
  const txPercent = Math.min(100, Math.max(0, Math.round((txMbps / planMaxMbps) * 100)));

  const liveSesionDescarga =
    mikrotikLive?.sesionEnVivo?.descarga ||
    consumo.sesionEnVivo?.descarga ||
    `${(consumo.consumoHoy?.downloadGb ?? 0).toFixed(1)} GB`;

  const liveSesionSubida =
    mikrotikLive?.sesionEnVivo?.subida ||
    consumo.sesionEnVivo?.subida ||
    `${(consumo.consumoHoy?.uploadGb ?? 0).toFixed(1)} GB`;

  const dias = consumo.dias || [];
  const maxDayGb = Math.max(1, ...dias.map((d) => d.totalGb));

  return (
    <div className="w-full rounded-3xl p-4 sm:p-6 md:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5 sm:space-y-6 overflow-hidden">
      {/* Header de la tarjeta: Estado de Conexión y Tráfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Activity className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Estado de Conexión y Tráfico
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consumo acumulado y velocidad en tiempo real con MikroTik RouterOS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Botón interactivo para actualizar consumo y velocidad */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isManualRefreshing || isMikrotikPolling}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:border-sky-500/50 active:scale-95 disabled:opacity-50 shadow-xs"
            title="Actualizar datos de consumo y velocidad en tiempo real"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isManualRefreshing || isMikrotikPolling ? "animate-spin text-sky-500" : ""}`}
            />
            <span>{isManualRefreshing ? "Actualizando..." : "Actualizar consumo"}</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-sans font-semibold tracking-tight tabular-nums text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span>{etiquetaActivacion}</span>
          </div>
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
              Obteniendo datos reales de Traffic Flow del servicio
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
            {rxMbps > 0 ? (
              <span className="text-sky-600 dark:text-sky-400 font-semibold font-sans tabular-nums">
                En vivo: ↓ {mikrotikLive?.velocidad?.descargaFormateada}
              </span>
            ) : (
              "100% Simétrica Dedicada"
            )}
          </span>
        </div>

        {/* 4. Sesión en Vivo MikroTik */}
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate block">
              Sesión MikroTik
            </span>
            <div className="flex items-center gap-1.5">
              {isMikrotikPolling && (
                <RefreshCw className="w-3 h-3 text-sky-500 animate-spin flex-shrink-0" />
              )}
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.75} />
            </div>
          </div>
          <p className="text-base sm:text-lg lg:text-xl font-bold font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-100 truncate">
            <span className="text-sky-600 dark:text-sky-400">
              {mikrotikLive?.consumo?.totalFormateada || `↓ ${liveSesionDescarga}`}
            </span>
          </p>
          <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block truncate font-sans tracking-tight tabular-nums">
            {mikrotikLive?.consumo?.totalFormateada
              ? `↓ ${liveSesionDescarga} / ↑ ${liveSesionSubida}`
              : `↑ ${liveSesionSubida} • En Línea`}
          </span>
        </div>
      </div>

      {/* Barra de Telemetría Activa Sincronizada con MikroTik y WispHub */}
      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="text-slate-700 dark:text-slate-200">
            <strong>Tráfico de Red Sincronizado:</strong> Registros de navegación consolidados directamente en el sistema para el servicio #{client.id}.
          </span>
        </div>
        <div className="flex items-center gap-2 font-sans font-semibold tracking-tight tabular-nums text-[11px] text-slate-500 dark:text-slate-400 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-slate-700 dark:text-slate-200 font-medium">Conexión Cifrada • En Línea</span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Datos en Tiempo Real</span>
        </div>
      </div>

      {/* Tacómetro / Monitor de Tráfico y Velocidad en Vivo MikroTik */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-800/50 dark:to-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Gauge className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Velocidad en Tiempo Real
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Métricas instantáneas de navegación en vivo desde el router MikroTik
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] font-sans font-semibold tracking-tight text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <Zap className={`w-3.5 h-3.5 ${rxMbps > 0 || txMbps > 0 ? "text-amber-500 animate-bounce" : "text-slate-400"}`} />
            <span>{isMikrotikPolling ? "Midiendo..." : rxMbps > 0 || txMbps > 0 ? "Tráfico Activo" : "Línea en Reposo"}</span>
          </div>
        </div>

        {/* Tacómetro Digital Dual: Bajada (Rx) y Subida (Tx) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Bajada / Download */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Descarga Actual (Rx)
              </span>
              <span className="text-[10px] font-sans font-semibold text-slate-400">
                Plan: {client.plan.velocidadBajada}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xl sm:text-2xl font-bold font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                {mikrotikLive?.velocidad?.descargaFormateada || "0.0 Mbps"}
              </p>
              <span className="text-[10px] font-bold font-sans tabular-nums text-sky-600 dark:text-sky-400">
                {rxPercent}% uso contratado
              </span>
            </div>
            {/* Barra de progreso de tacómetro */}
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(2, rxPercent)}%` }}
              />
            </div>
          </div>

          {/* Subida / Upload */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Subida Actual (Tx)
              </span>
              <span className="text-[10px] font-sans font-semibold text-slate-400">
                Plan: {client.plan.velocidadSubida || client.plan.velocidadBajada}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xl sm:text-2xl font-bold font-sans tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                {mikrotikLive?.velocidad?.subidaFormateada || "0.0 Mbps"}
              </p>
              <span className="text-[10px] font-bold font-sans tabular-nums text-emerald-600 dark:text-emerald-400">
                {txPercent}% uso contratado
              </span>
            </div>
            {/* Barra de progreso de tacómetro */}
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(2, txPercent)}%` }}
              />
            </div>
          </div>
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
                Datos de consumo medidos y sincronizados directamente con la red de fibra óptica.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
