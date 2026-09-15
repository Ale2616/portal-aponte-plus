"use client";

import { ClientProfile } from "@/lib/types";
import { formatCurrency, formatDate, getServiceStatusInfo } from "@/lib/utils";
import {
  Wifi,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  CreditCard,
  Building,
  Server,
  Zap,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ReceiptText,
} from "lucide-react";

interface StatusCardProps {
  client: ClientProfile;
  onOpenPayment: () => void;
  onOpenBankAccounts: () => void;
  onChangeUser: () => void;
}

const safeText = (val: any, fallback = ""): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    return val.nombre || val.name || val.descripcion || val.id || fallback;
  }
  return fallback;
};

export function StatusCard({ client, onOpenPayment, onOpenBankAccounts, onChangeUser }: StatusCardProps) {
  const statusInfo = getServiceStatusInfo(client.estadoServicio);
  const isCut = client.estadoServicio === "cortado";
  const hasDebt = client.saldoTotalPendiente > 0;

  return (
    <div className="w-full space-y-4">
      {/* Banner de alerta si está cortado */}
      {isCut && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
          <div className="p-2 rounded-xl bg-rose-500/20 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-500" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1 text-xs sm:text-sm">
            <p className="font-bold">Servicio suspendido temporalmente</p>
            <p className="opacity-90 mt-0.5">
              Reporta tu comprobante de pago para reestablecer tu conexión a internet sin recargos.
            </p>
          </div>
          <button
            onClick={onOpenPayment}
            className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all flex-shrink-0"
          >
            Reportar Pago
          </button>
        </div>
      )}

      {/* Tarjeta Principal Fintech en Verde Aguamarina */}
      <div className="relative rounded-3xl p-6 sm:p-8 fintech-card-bg text-white shadow-2xl shadow-teal-950/40 border border-teal-500/30 overflow-hidden">
        {/* Glow sutil Aguamarina */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-teal-400/25 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between min-h-[210px] sm:min-h-[230px]">
          {/* Fila Superior: Chip, Red y Badge de Estado */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Chip EMV y Contactless */}
              <div className="relative h-10 sm:h-11 w-auto flex items-center flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/emv-chip.png"
                  alt="Chip EMV Contactless"
                  className="h-9 sm:h-10 w-auto object-contain drop-shadow-md"
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-teal-300" strokeWidth={1.75} />
                  <span className="text-xs uppercase tracking-wider text-teal-100 font-semibold">
                    Línea Fibra Óptica
                  </span>
                </div>
                <p className="text-[11px] text-teal-200/80 mt-0.5">
                  ID de Cuenta: <span className="font-sans font-semibold tracking-tight tabular-nums text-white">{client.id}</span>
                </p>
              </div>
            </div>

            {/* Status Pill con círculo de pulso sutil */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.color}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
              <span>{statusInfo.shortLabel}</span>
            </div>
          </div>

          {/* Sección Central: Saldo Pendiente y Fecha de Corte */}
          <div className="my-5">
            <span className="text-[11px] uppercase tracking-widest text-teal-200/80 font-semibold block">
              {hasDebt ? "Saldo Total a Pagar" : "Estado de Cuenta"}
            </span>
            <div className="flex flex-wrap items-baseline gap-3 mt-1">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-sans font-bold tracking-tight tabular-nums text-white">
                {hasDebt ? formatCurrency(client.saldoTotalPendiente) : "$ 0 COP"}
              </span>

              {!hasDebt && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-400/20 border border-teal-300/40 text-teal-200 backdrop-blur-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Al día
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-teal-100/90">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-300" strokeWidth={1.75} />
                <span>
                  Fecha límite:{" "}
                  <strong className="text-white font-sans font-semibold tracking-tight tabular-nums">
                    {formatDate(client.servicio.fechaLimitePago)}
                  </strong>
                </span>
              </div>
              <div className="hidden sm:block text-teal-500/40">•</div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.75} />
                <span>
                  Corte:{" "}
                  <strong className="text-white font-sans font-semibold tracking-tight tabular-nums">
                    Día {client.servicio.diaCorte || client.servicio.diaPago} de cada mes
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Fila Inferior: Titular y Botones */}
          <div className="pt-4 border-t border-teal-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-teal-200/80 block">
                Titular del Servicio
              </span>
              <p className="text-sm font-bold text-white truncate">
                {client.nombreCompleto}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-teal-200/80">
                <span className="font-sans font-semibold tracking-tight tabular-nums text-teal-100">
                  C.C. {client.cedula}
                </span>
                {(client.celular || client.telefono) && (
                  <>
                    <span className="text-teal-500/40">•</span>
                    <span>Tel: {client.celular || client.telefono}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={onChangeUser}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-teal-100 hover:text-white border border-teal-300/20 transition-all cursor-pointer"
                  title="Consultar otro documento"
                >
                  <RefreshCw className="w-2.5 h-2.5 text-teal-300" strokeWidth={1.75} />
                  Cambiar
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenBankAccounts}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-teal-50 border border-teal-300/25 backdrop-blur-md transition-all cursor-pointer"
              >
                Canales de Pago
              </button>

              <button
                onClick={onOpenPayment}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-white text-teal-950 hover:bg-teal-50 transition-all cursor-pointer shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-teal-700" strokeWidth={1.75} />
                Reportar Pago
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Especificaciones Técnicas y de Infraestructura (Alto Contraste y Nitidez) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* 1. Plan Contratado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-sm flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-slate-700 flex-shrink-0">
            <Wifi className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider block">
              Plan Contratado
            </span>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
              {client.plan.nombre}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs font-sans font-semibold tracking-tight tabular-nums">
              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-300 font-bold">
                <ArrowDownCircle className="w-3.5 h-3.5" strokeWidth={2} />
                {client.plan.velocidadBajada}
              </span>
              <span className="text-slate-400 dark:text-slate-400">/</span>
              <span className="flex items-center gap-0.5 text-sky-600 dark:text-sky-300 font-bold">
                <ArrowUpCircle className="w-3.5 h-3.5" strokeWidth={2} />
                {client.plan.velocidadSubida}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">
              Tarifa Plana: <strong className="font-sans font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">{formatCurrency(client.plan.precioMensual)}</strong>
            </p>
          </div>
        </div>

        {/* 2. IP e Infraestructura */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-sm flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-slate-700 flex-shrink-0">
            <Server className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider block">
              Red e Infraestructura
            </span>
            <p className="text-sm font-extrabold font-sans tracking-tight tabular-nums text-slate-900 dark:text-white truncate mt-0.5">
              IP: {safeText(client.servicio.ip, "100.64.0.1")}
            </p>
            {client.servicio.mac && (
              <p className="text-xs font-sans font-semibold tracking-tight tabular-nums text-slate-700 dark:text-slate-200 truncate mt-0.5">
                MAC: {client.servicio.mac}
              </p>
            )}
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate mt-0.5">
              Equipo: {safeText(client.servicio.routerOnt, "Router ONT")}
            </p>
            {client.servicio.mikrotik && (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Router: {client.servicio.mikrotik}
              </p>
            )}
          </div>
        </div>

        {/* 3. Nodo y Ubicación */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-sm flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-slate-700 flex-shrink-0">
            <Building className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider block">
              Nodo y Ubicación
            </span>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
              {safeText(client.servicio.nodo, "Nodo Principal Fibra")}
            </p>
            {(client.servicio.sectorial || client.servicio.cajaNap) && (
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate mt-0.5">
                {client.servicio.cajaNap ? `Caja NAP: ${client.servicio.cajaNap}` : `Sector: ${client.servicio.sectorial}`}
              </p>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
              {safeText(client.direccion)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {client.barrio ? `${client.barrio}, ` : ""}{safeText(client.ciudad)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
