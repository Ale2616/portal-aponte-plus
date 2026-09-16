"use client";

import { useState } from "react";
import { Invoice } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ReceiptText,
  Download,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
} from "lucide-react";

interface InvoiceListProps {
  invoices: Invoice[];
  onViewPdf: (invoice: Invoice) => void;
  onPayInvoice: (invoice: Invoice) => void;
}

export function formatPeriodoLabel(periodo?: string, fallbackDate?: string): string {
  if (periodo) {
    const monthNames: Record<string, string> = {
      ene: "Enero", feb: "Febrero", mar: "Marzo", abr: "Abril",
      may: "Mayo", jun: "Junio", jul: "Julio", ago: "Agosto",
      sep: "Septiembre", sept: "Septiembre", oct: "Octubre",
      nov: "Noviembre", dic: "Diciembre",
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
    };

    const match = periodo.match(/([a-zA-Z]{3,4})\.?\/?(\d{4})/i);
    if (match) {
      const mesKey = match[1].toLowerCase().replace(".", "");
      const year = match[2];
      const mesName = monthNames[mesKey] || match[1];
      return `${mesName} ${year}`;
    }

    const words = periodo.trim().split(" ");
    if (words.length === 2 && !isNaN(Number(words[1]))) {
      return periodo;
    }
  }

  if (fallbackDate) {
    try {
      const d = new Date(fallbackDate);
      if (!isNaN(d.getTime())) {
        const meses = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        return `${meses[d.getMonth()]} ${d.getFullYear()}`;
      }
    } catch {}
  }

  return periodo || "Mes Facturado";
}

export function InvoiceList({ invoices, onViewPdf, onPayInvoice }: InvoiceListProps) {
  const [activeTab, setActiveTab] = useState<"pendientes" | "historial">("pendientes");

  const isPaidInvoice = (i: Invoice) => {
    const est = String(i.estado || "").toLowerCase().trim();
    return (
      est === "pagada" ||
      est === "pago" ||
      est === "pagado" ||
      est === "cancelada" ||
      est === "cobrada" ||
      (i.saldoPendiente === 0 && i.total > 0)
    );
  };

  // 1. Filtra y mapea TODAS las facturas que tengan saldo pendiente (soporte multi-factura)
  const pendingInvoices = invoices.filter(
    (i) => !isPaidInvoice(i) && (i.saldoPendiente > 0 || i.estado === "pendiente" || i.estado === "vencida")
  );

  const totalPendingAmount = pendingInvoices.reduce(
    (acc, inv) => acc + (inv.saldoPendiente || inv.total || 0),
    0
  );

  // 2. Facturas para el historial (pagadas o saldo 0), ordenadas de la más reciente a la más antigua
  const paidInvoices = invoices
    .filter((i) => isPaidInvoice(i))
    .sort((a, b) => {
      const timeA = new Date(a.fechaPago || a.fechaEmision || a.fechaVencimiento || 0).getTime();
      const timeB = new Date(b.fechaPago || b.fechaEmision || b.fechaVencimiento || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.id || 0) - Number(a.id || 0);
    });

  return (
    <div className="w-full space-y-5">
      {/* Header con Pestañas Principales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-sky-500" strokeWidth={2} />
            Facturación y Recibos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Consulta tus facturas pendientes de pago y descarga tus comprobantes anteriores
          </p>
        </div>

        {/* Pestañas de Navegación Fluidas e Instantáneas */}
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("pendientes")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "pendientes"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Facturas Pendientes</span>
            {pendingInvoices.length > 0 ? (
              <span className="px-2 py-0.2 rounded-full text-[10.5px] font-black bg-rose-600 text-white animate-pulse font-sans">
                {pendingInvoices.length}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("historial")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "historial"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Pagos ({paidInvoices.length})</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PESTAÑA 1: FACTURAS PENDIENTES (LISTADO MULTI-FACTURA)   */}
      {/* ======================================================== */}
      {activeTab === "pendientes" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {pendingInvoices.length === 0 ? (
            /* Estado Al Día: No hay facturas pendientes */
            <div className="text-center py-10 px-6 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-500/25 shadow-sm space-y-3.5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" strokeWidth={2} />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Cuenta al Día
                </span>
                <h4 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
                  ✓ No tienes facturas pendientes. Tu cuenta está al día.
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Tu conexión a internet se encuentra 100% activa sin valores pendientes por pagar.
                </p>
              </div>

              {paidInvoices.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("historial")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    Consultar Historial de Pagos ({paidInvoices.length})
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Listado Dinámico de Facturas Pendientes */
            <div className="space-y-4">
              {pendingInvoices.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200">
                  <span>
                    Tienes <strong>{pendingInvoices.length} facturas pendientes</strong> por liquidar:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Total acumulado:</span>
                    <strong className="text-sm font-black font-sans tabular-nums text-rose-600 dark:text-rose-400">
                      {formatCurrency(totalPendingAmount)} COP
                    </strong>
                  </div>
                </div>
              )}

              {pendingInvoices.map((inv) => {
                const periodoFormatted = formatPeriodoLabel(inv.periodo, inv.fechaEmision);
                const montoAPagar = inv.saldoPendiente || inv.total;

                return (
                  <div
                    key={inv.id}
                    className="rounded-3xl p-5 sm:p-7 bg-white dark:bg-slate-900 border-2 border-rose-500/30 dark:border-rose-500/25 shadow-lg hover:shadow-xl transition-all space-y-4"
                  >
                    {/* Fila Superior: Badges, Folio y Monto Destacado */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Badge de Estado: Siempre Factura Pendiente */}
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Factura Pendiente
                          </span>

                          {inv.tieneReportePendiente && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                              Comprobante en Revisión
                            </span>
                          )}
                        </div>

                        <h4 className="text-xl sm:text-2xl font-black font-sans tracking-tight text-slate-900 dark:text-slate-100 mt-2">
                          {inv.folio}
                        </h4>

                        <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                          {inv.concepto || "Servicio de Internet Fibra Óptica"}
                        </p>
                      </div>

                      <div className="sm:text-right flex-shrink-0">
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
                          Monto Pendiente
                        </span>
                        <span className="text-2xl sm:text-3xl font-sans font-black tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
                          {formatCurrency(montoAPagar)}
                        </span>
                      </div>
                    </div>

                    {/* Metadatos: Vencimiento y Periodo */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Periodo</span>
                        <span className="font-sans font-semibold tracking-tight text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {periodoFormatted}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Fecha Emisión</span>
                        <span className="font-sans font-semibold tracking-tight tabular-nums text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {formatDate(inv.fechaEmision)}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-slate-400 block font-medium">Fecha Vencimiento</span>
                        <span className="font-sans font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400 mt-0.5 block">
                          {formatDate(inv.fechaVencimiento)}
                        </span>
                      </div>
                    </div>

                    {/* Acciones individuales por factura */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onViewPdf(inv)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
                        title={`Ver comprobante de ${inv.folio}`}
                      >
                        <Download className="w-4 h-4 text-slate-400" />
                        <span>Ver Detalle / Imprimir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPayInvoice(inv)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        Reportar Pago
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 2: HISTORIAL DE PAGOS (WISPHUB)                  */}
      {/* ======================================================== */}
      {activeTab === "historial" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Recibos Pagados Registrados ({paidInvoices.length})
            </span>
          </div>

          {/* Si no hay facturas pagadas registradas en meses anteriores */}
          {paidInvoices.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <ReceiptText className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 font-sans">
                No se registran facturas anteriores para este servicio.
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-sans">
                Este servicio es nuevo o no registra pagos completados previamente. Tus comprobantes oficiales aparecerán aquí automáticamente tras confirmarse cada pago.
              </p>
            </div>
          ) : (
            /* Lista de facturas pagadas ordenadas cronológicamente */
            <div className="space-y-3">
              {paidInvoices.map((inv) => {
                const periodoLabel = formatPeriodoLabel(inv.periodo, inv.fechaPago || inv.fechaEmision);
                const pdfTargetUrl = inv.pdfFactura || inv.pdfUrl;

                return (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all gap-4 shadow-sm"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
                            {periodoLabel}
                          </h4>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-sans">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                            Pagada{inv.fechaPago ? ` • ${formatDate(inv.fechaPago)}` : ""}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 font-sans">
                          <span>Factura Oficial: <strong className="text-slate-700 dark:text-slate-300 font-sans font-semibold tracking-tight tabular-nums">{inv.folio}</strong></span>
                          <span>•</span>
                          <span>Emisión: <span className="font-sans font-semibold tracking-tight tabular-nums">{formatDate(inv.fechaEmision)}</span></span>
                          {inv.fechaPago && (
                            <>
                              <span>•</span>
                              <span>Fecha de Pago: <strong className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold tracking-tight tabular-nums">{formatDate(inv.fechaPago)}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="sm:text-right">
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                          Monto Pagado
                        </span>
                        <span className="font-sans font-bold tracking-tight tabular-nums text-base sm:text-lg text-slate-900 dark:text-slate-100">
                          {formatCurrency(inv.total)} COP
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {pdfTargetUrl && pdfTargetUrl.startsWith("http") ? (
                          <a
                            href={pdfTargetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
                            title="Descargar comprobante en PDF oficial"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>📄 Descargar PDF</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onViewPdf(inv)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
                            title="Descargar comprobante en PDF oficial"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>📄 Descargar PDF</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
