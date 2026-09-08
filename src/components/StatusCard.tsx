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

      {/* Tarjeta Principal Fintech */}
      <div className="relative rounded-3xl p-6 sm:p-8 fintech-card-bg text-white shadow-2xl shadow-slate-950/20 border border-slate-800/80 overflow-hidden">
        {/* Glow sutil */}
        <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-60 h-60 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between min-h-[210px] sm:min-h-[230px]">
          {/* Fila Superior: Chip, Red y Badge de Estado */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Chip EMV y Contactless */}
              <div className="relative h-8 sm:h-9 w-auto flex items-center flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/emv-chip.png"
                  alt="Chip EMV Contactless"
                  className="h-7 sm:h-8 w-auto object-contain drop-shadow"
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
                    Abonado Fibra Óptica
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  ID de Cuenta: {client.id}
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
            <span className="text-[11px] uppercase tracking-widest text-slate-400 font-medium block">
              {hasDebt ? "Saldo Total a Pagar" : "Estado de Cuenta"}
            </span>
            <div className="flex flex-wrap items-baseline gap-3 mt-1">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono tracking-tight text-white">
                {hasDebt ? formatCurrency(client.saldoTotalPendiente) : "$ 0 COP"}
              </span>

              {!hasDebt && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Al día
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                <span>
                  Fecha límite:{" "}
                  <strong className="text-white font-medium">
                    {formatDate(client.servicio.fechaLimitePago)}
                  </strong>
                </span>
              </div>
              <div className="hidden sm:block text-slate-600">•</div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                <span>
                  Corte:{" "}
                  <strong className="text-white font-medium">
                    Día {client.servicio.diaPago} de cada mes
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Fila Inferior: Titular y Botones */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                Titular del Servicio
              </span>
              <p className="text-sm font-bold text-slate-100 truncate">
                {client.nombreCompleto}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-slate-400">
                  C.C. {client.cedula}
                </span>
                <button
                  type="button"
                  onClick={onChangeUser}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title="Consultar otro documento"
                >
                  <RefreshCw className="w-2.5 h-2.5 text-slate-400" strokeWidth={1.75} />
                  Cambiar
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenBankAccounts}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
              >
                Canales de Pago
              </button>

              <button
                onClick={onOpenPayment}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-slate-700" strokeWidth={1.75} />
                Reportar Pago
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Especificaciones del Servicio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Plan contratado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Wifi className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Plan Contratado
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
              {client.plan.nombre}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span className="flex items-center gap-0.5 text-slate-600 dark:text-slate-300">
                <ArrowDownCircle className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                {client.plan.velocidadBajada}
              </span>
              <span className="flex items-center gap-0.5 text-slate-600 dark:text-slate-300">
                <ArrowUpCircle className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                {client.plan.velocidadSubida}
              </span>
            </div>
          </div>
        </div>

        {/* IP y Router */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Server className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              IP / Equipo ONT
            </span>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 truncate mt-0.5">
              {client.servicio.ip}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {client.servicio.routerOnt}
            </p>
          </div>
        </div>

        {/* Nodo y Ubicación */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Building className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Ubicación / Nodo
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
              {client.servicio.nodo}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {client.direccion}, {client.ciudad}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
