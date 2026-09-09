"use client";

import { Invoice, ClientProfile } from "@/lib/types";
import { branding } from "@/config/branding";
import { formatCurrency, formatDate } from "@/lib/utils";
import { X, Printer, Download, CheckCircle2, ShieldCheck } from "lucide-react";

interface InvoicePdfModalProps {
  invoice: Invoice | null;
  client: ClientProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onPayClick?: (invoice: Invoice) => void;
}

export function InvoicePdfModal({
  invoice,
  client,
  isOpen,
  onClose,
  onPayClick,
}: InvoicePdfModalProps) {
  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    const printWindow = window.open(`/api/facturas/${invoice.id}/pdf`, "_blank");
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Detalle de Factura
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm"
              title="Abrir vista de impresión oficial"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Invoice Body Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <div className="h-24 sm:h-28 w-auto mb-3 flex items-center justify-center bg-white p-2 rounded-2xl border border-slate-200/80 shadow-md max-w-[240px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.logoUrl}
                  alt={branding.companyName}
                  className="h-full w-auto object-contain"
                />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {branding.companyName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {branding.legalName}<br />
                NIT: {branding.nit}<br />
                {branding.address}, {branding.city}<br />
                WhatsApp: {branding.supportPhoneFormatted}
              </p>
            </div>

            <div className="sm:text-right">
              <span className="text-xs font-sans font-bold tracking-tight text-slate-700 dark:text-slate-300 block">
                {invoice.folio}
              </span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    invoice.estado === "pagada"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                      : invoice.estado === "vencida"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                  }`}
                >
                  {invoice.estado === "pagada" ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" strokeWidth={1.75} />
                      FACTURA PAGADA
                    </>
                  ) : invoice.estado === "vencida" ? (
                    "FACTURA VENCIDA"
                  ) : (
                    "PENDIENTE DE PAGO"
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Periodo: {invoice.periodo}</p>
            </div>
          </div>

          {/* Client & Billing Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Datos del Abonado
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {client?.nombreCompleto || "Abonado Registrado"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cédula / NIT: <span className="font-sans font-semibold tracking-tight tabular-nums">{client?.cedula || "N/A"}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dirección: {client?.direccion || "N/A"}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Fechas y Servicio
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <strong>Fecha de Emisión:</strong> <span className="font-sans font-semibold tracking-tight tabular-nums">{formatDate(invoice.fechaEmision)}</span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                <strong>Fecha de Vencimiento:</strong> <span className="font-sans font-semibold tracking-tight tabular-nums">{formatDate(invoice.fechaVencimiento)}</span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                <strong>Plan:</strong> {client?.plan?.nombre || "Fibra Óptica Residencial"}
              </p>
            </div>
          </div>

          {/* Itemized Table (Tarifa Plana sin IVA) */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Concepto / Servicio</th>
                  <th className="py-3 px-4 text-center">Tarifa Plana</th>
                  <th className="py-3 px-4 text-right">Total a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-3.5 px-4 font-medium">
                    <div>{invoice.concepto}</div>
                    <span className="text-xs text-slate-400">Servicio de telecomunicaciones periodo {invoice.periodo} (Exento de IVA)</span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans font-bold tracking-tight tabular-nums">{formatCurrency(invoice.total)}</td>
                  <td className="py-3.5 px-4 text-right font-sans font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                    {formatCurrency(invoice.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total Breakdown Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-100/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
              <span>Facturación digital WispHub • Tarifa Fija Mensual</span>
            </div>
            <div className="text-right w-full sm:w-auto">
              <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Total a Pagar</span>
              <span className="text-2xl font-sans font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
              Descargar PDF
            </button>

            {invoice.estado !== "pagada" && onPayClick && (
              <button
                onClick={() => {
                  onClose();
                  onPayClick(invoice);
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white transition-all"
              >
                Reportar Pago
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
