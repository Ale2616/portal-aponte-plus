"use client";

import { useState, useEffect, useMemo } from "react";
import { ClientProfile, Invoice } from "@/lib/types";
import { toast } from "sonner";
import {
  BarChart3,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Wifi,
  Sparkles,
} from "lucide-react";
import { ConsumptionChart, ChartDataPoint } from "@/components/consumption/ConsumptionChart";
import { ConsumptionSkeleton } from "@/components/consumption/ConsumptionSkeleton";

export interface WisphubMonthTraffic {
  mes: string;
  mes_nombre: string;
  mes_numero: number;
  anio: number;
  descarga_gb: number;
  subida_gb: number;
  total_gb: number;
  hasData: boolean;
}

export interface SincronizarHistorialResponse {
  success: boolean;
  id_servicio: string;
  cedula: string;
  anio: number;
  meses: WisphubMonthTraffic[];
  hasData: boolean;
  origen: string;
}

interface NetworkUsageCardProps {
  client: ClientProfile;
  invoices?: Invoice[];
}

export function NetworkUsageCard({ client }: NetworkUsageCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [historialData, setHistorialData] = useState<SincronizarHistorialResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extraer dinámicamente el id_servicio y cédula del cliente consultado
  const clientId = String(
    client.id_servicio ||
    (client as any)?.servicio?.idServicio ||
    client.id ||
    ""
  ).trim();
  const clientCedula = String(
    client.cedula || (client as any)?.documento || ""
  ).trim();

  // Carga del historial de consumo mensual desde la API dinámica
  useEffect(() => {
    if (!clientId && !clientCedula) return;

    const fetchHistorial = async () => {
      setIsLoading(true);
      setSyncError(null);

      try {
        const params = new URLSearchParams();
        if (clientId) params.set("id_servicio", clientId);
        if (clientCedula) params.set("cedula", clientCedula);

        const res = await fetch(`/api/trafico/historial?${params.toString()}`);

        if (!res.ok) {
          throw new Error(`Error del servidor (${res.status})`);
        }

        const data: SincronizarHistorialResponse = await res.json();
        if (data.success) {
          setHistorialData(data);
          setSyncError(null);
        } else {
          setSyncError("No se pudo obtener el historial de consumo");
        }
      } catch {
        setSyncError("No se pudo conectar con el servidor de tráfico");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistorial();
  }, [clientId, clientCedula]);

  // Actualización manual con cooldown
  const handleRefresh = async () => {
    if (isRefreshing || !clientId) return;

    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set("id_servicio", clientId);
      if (clientCedula) params.set("cedula", clientCedula);

      const res = await fetch(`/api/trafico/historial?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setHistorialData(data);
          setSyncError(null);
          toast.success("Historial de consumo actualizado");
        }
      }
    } catch {
      toast.error("No se pudo actualizar el historial");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Construir los datos del gráfico anual a partir de la respuesta de la API
  const currentYear = new Date().getFullYear();

  const chartDataAno: ChartDataPoint[] = useMemo(() => {
    const mesesCompletos = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    const mesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    if (historialData?.meses && historialData.meses.length > 0) {
      return historialData.meses.map((m) => {
        const dl = Number(m.descarga_gb || 0);
        const ul = Number(m.subida_gb || 0);
        return {
          label: m.mes,
          fullLabel: `${m.mes_nombre} ${m.anio || currentYear}`,
          downloadGb: dl,
          uploadGb: ul,
          totalGb: Number((dl + ul).toFixed(2)),
        };
      });
    }

    // Sin datos: 12 meses vacíos
    return mesesCortos.map((mes, idx) => ({
      label: mes,
      fullLabel: `${mesesCompletos[idx]} ${currentYear}`,
      downloadGb: 0,
      uploadGb: 0,
      totalGb: 0,
    }));
  }, [historialData, currentYear]);

  const hasData = chartDataAno.some((d) => (d.downloadGb + d.uploadGb) > 0);

  // Estadísticas de resumen
  const stats = useMemo(() => {
    const totalDl = chartDataAno.reduce((acc, d) => acc + d.downloadGb, 0);
    const totalUl = chartDataAno.reduce((acc, d) => acc + d.uploadGb, 0);
    const totalAnual = totalDl + totalUl;

    // Mes con mayor consumo
    let mesPico = { label: "—", total: 0, fullLabel: "" };
    chartDataAno.forEach((d) => {
      const total = d.downloadGb + d.uploadGb;
      if (total > mesPico.total) {
        mesPico = { label: d.label, total, fullLabel: d.fullLabel || d.label };
      }
    });

    // Formato inteligente: si > 1024 GiB, mostrar en TiB
    const formatTotal = (gb: number): string => {
      if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TiB`;
      return `${gb.toFixed(1)} GiB`;
    };

    return {
      totalAnual: Number(totalAnual.toFixed(2)),
      totalAnualLabel: formatTotal(totalAnual),
      totalDl: Number(totalDl.toFixed(2)),
      totalUl: Number(totalUl.toFixed(2)),
      mesPico,
      mesPicoLabel: formatTotal(mesPico.total),
    };
  }, [chartDataAno]);

  return (
    <div className="w-full rounded-3xl p-4 sm:p-6 md:p-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-5 sm:space-y-6 overflow-hidden">
      {/* ─── Encabezado ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Sparkles className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Historial de Consumo Mensual
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Registro consolidado de navegación — Año {currentYear}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:border-sky-500/50 active:scale-95 disabled:opacity-50 shadow-xs self-start sm:self-auto"
          title="Actualizar historial de consumo"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-sky-500" : ""}`}
          />
          <span>{isRefreshing ? "Actualizando..." : "Actualizar"}</span>
        </button>
      </div>

      {/* ─── Estado de carga ─────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 animate-pulse">
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                Consultando historial de consumo...
              </p>
              <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-0.5">
                Sincronizando registros de tráfico del servicio
              </p>
            </div>
          </div>
          <ConsumptionSkeleton />
        </div>
      )}

      {/* ─── Error ───────────────────────────────────────────────────── */}
      {syncError && !isLoading && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              No se pudo cargar el historial
            </p>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              Los datos se consolidarán automáticamente en el próximo ciclo
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
            title="Reintentar"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </button>
        </div>
      )}

      {/* ─── Contenido principal (solo cuando no está cargando) ─────── */}
      {!isLoading && (
        <div className="space-y-4">
          {/* Tarjetas de Resumen: Consumo Total + Mes Pico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Consumo Total del Año */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20 border border-sky-200/60 dark:border-sky-800/40 space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <ArrowDownCircle className="w-4 h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Consumo Total del Año
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold font-sans tabular-nums text-slate-900 dark:text-slate-100">
                {hasData ? stats.totalAnualLabel : "0 GiB"}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  ↓ {stats.totalDl.toFixed(1)} GiB
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  ↑ {stats.totalUl.toFixed(1)} GiB
                </span>
              </div>
            </div>

            {/* Mes con Mayor Consumo */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Mes con Mayor Consumo
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold font-sans tabular-nums text-slate-900 dark:text-slate-100">
                {hasData ? stats.mesPicoLabel : "—"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {hasData
                  ? `${stats.mesPico.fullLabel} — Pico de consumo del año`
                  : "Sin registros aún"}
              </p>
            </div>
          </div>

          {/* Gráfico de Barras Anual o Estado Vacío */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800/80 space-y-4">
            {/* Cabecera del gráfico */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  Consumo Mensual ({currentYear})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Barras diferenciadas de descarga y subida sincronizadas con WispHub
                </p>
              </div>

              <div className="flex items-center gap-3.5 text-xs font-medium self-start sm:self-auto">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-3 h-3 rounded-sm bg-sky-500" />
                  <span className="text-[11px]">Descarga (Rx)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-3 h-3 rounded-sm bg-amber-500" />
                  <span className="text-[11px]">Subida (Tx)</span>
                </div>
              </div>
            </div>

            {/* Gráfico o Estado Vacío */}
            {hasData ? (
              <ConsumptionChart
                data={chartDataAno}
                periodLabel="Historial mensual de consumo anual"
                isYearly={true}
              />
            ) : (
              <div className="w-full py-12 px-4 sm:px-6 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <Wifi className="w-7 h-7" strokeWidth={1.5} />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
                    Tu historial de consumo está en camino
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tu historial de consumo se empezará a registrar a partir de tu primer ciclo de facturación.
                    Una vez que WispHub consolide tus datos de tráfico, los verás aquí de forma automática.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-sans font-medium text-slate-600 dark:text-slate-300 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Línea activa — A la espera de registros</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
