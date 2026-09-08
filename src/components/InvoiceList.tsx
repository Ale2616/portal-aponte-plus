"use client";

import { useState } from "react";
import { Invoice } from "@/lib/types";
import { formatCurrency, formatDate, getInvoiceStatusInfo } from "@/lib/utils";
import {
  ReceiptText,
  Download,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

interface InvoiceListProps {
  invoices: Invoice[];
  onViewPdf: (invoice: Invoice) => void;
  onPayInvoice: (invoice: Invoice) => void;
}

export function InvoiceList({ invoices, onViewPdf, onPayInvoice }: InvoiceListProps) {
  const [filter, setFilter] = useState<"todas" | "pendientes" | "pagadas">("todas");

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "pendientes") return inv.estado === "pendiente" || inv.estado === "vencida";
    if (filter === "pagadas") return inv.estado === "pagada";
    return true;
  });

  return (
    <div className="w-full space-y-4">
      {/* Header y Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
            Historial de Facturación
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Facturas electrónicas y comprobantes de tu suscripción
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto">
          <button
            onClick={() => setFilter("todas")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === "todas"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Todas ({invoices.length})
          </button>
          <button
            onClick={() => setFilter("pendientes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === "pendientes"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Pendientes ({invoices.filter((i) => i.estado !== "pagada").length})
          </button>
          <button
            onClick={() => setFilter("pagadas")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === "pagadas"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Pagadas ({invoices.filter((i) => i.estado === "pagada").length})
          </button>
        </div>
      </div>

      {/* List of Invoices */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-2">
          <ReceiptText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No hay facturas en esta categoría
          </p>
          <p className="text-xs text-slate-400">
            No se registran cobros pendientes de pago.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => {
            const statusStyle = getInvoiceStatusInfo(invoice.estado);
            const isPending = invoice.estado !== "pagada";

            return (
              <div
                key={invoice.id}
                className={`relative rounded-2xl p-4 sm:p-5 transition-all duration-200 border bg-white dark:bg-slate-900 ${
                  isPending
                    ? "border-slate-300 dark:border-slate-700 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 opacity-95 hover:opacity-100"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Info Factura */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        invoice.estado === "pagada"
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                          : invoice.estado === "vencida"
                          ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                          : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {invoice.estado === "pagada" ? (
                        <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                      ) : invoice.estado === "vencida" ? (
                        <AlertCircle className="w-4 h-4" strokeWidth={1.75} />
                      ) : (
                        <Clock className="w-4 h-4" strokeWidth={1.75} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                          {invoice.folio}
                        </span>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle.bgColor}`}
                        >
                          {statusStyle.label}
                        </span>

                        {invoice.tieneReportePendiente && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Pago en Revisión
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {invoice.concepto}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>Periodo: <strong className="text-slate-700 dark:text-slate-300">{invoice.periodo}</strong></span>
                        <span>•</span>
                        <span>
                          Vence:{" "}
                          <strong
                            className={
                              invoice.estado === "vencida"
                                ? "text-rose-600 dark:text-rose-400 font-semibold"
                                : "text-slate-700 dark:text-slate-300"
                            }
                          >
                            {formatDate(invoice.fechaVencimiento)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Precios y Botones */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total</span>
                      <span className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(invoice.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onViewPdf(invoice)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Ver detalle de factura"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>PDF</span>
                      </button>

                      {isPending && (
                        <button
                          onClick={() => onPayInvoice(invoice)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white transition-all cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" strokeWidth={1.75} />
                          Reportar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
