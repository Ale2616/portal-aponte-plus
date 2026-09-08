"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Invoice, ClientProfile, PaymentReportResult } from "@/lib/types";
import { branding } from "@/config/branding";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { FileUpload } from "./FileUpload";
import {
  X,
  Loader2,
  Copy,
  Check,
  CheckCircle2,
  ReceiptText,
  Smartphone,
  QrCode,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const FormSchema = z.object({
  id_factura: z.string().min(1, "Debes seleccionar una factura"),
  metodo_pago: z.string().min(1, "Debes seleccionar el canal de pago"),
  referencia: z
    .string()
    .min(3, "Ingresa el número de referencia o comprobante (mínimo 3 dígitos)")
    .max(50, "La referencia no puede superar los 50 caracteres"),
  monto: z.number().positive("El monto debe ser un valor positivo mayor a cero"),
  fecha_pago: z.string().min(1, "Ingresa la fecha y hora de la transferencia"),
  observaciones: z.string().max(300).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  pendingInvoices: Invoice[];
  initialInvoiceId?: string;
  onSuccessReport: (result: PaymentReportResult) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  client,
  pendingInvoices,
  initialInvoiceId,
  onSuccessReport,
}: PaymentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [successData, setSuccessData] = useState<PaymentReportResult | null>(null);

  const activeInvoice =
    pendingInvoices.find((i) => i.id === initialInvoiceId) || pendingInvoices[0] || null;

  const getDefaultDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      id_factura: activeInvoice?.id || "",
      metodo_pago: branding.paymentMethods[0]?.id || "nequi",
      referencia: "",
      monto: activeInvoice?.saldoPendiente || 0,
      fecha_pago: getDefaultDateTime(),
      observaciones: "",
    },
  });

  const currentInvoiceId = watch("id_factura");
  const currentMethodId = watch("metodo_pago");

  const currentInvoice =
    pendingInvoices.find((i) => i.id === currentInvoiceId) || activeInvoice;

  const currentMethod =
    branding.paymentMethods.find((m) => m.id === currentMethodId) ||
    branding.paymentMethods[0];

  useEffect(() => {
    if (activeInvoice) {
      setValue("id_factura", activeInvoice.id);
      setValue("monto", activeInvoice.saldoPendiente);
    }
  }, [activeInvoice, setValue]);

  if (!isOpen) return null;

  const handleCopyAccount = () => {
    if (!currentMethod) return;
    const cleanNumber = currentMethod.accountNumber.replace(/\s+/g, "");
    navigator.clipboard.writeText(cleanNumber);
    setCopiedAccount(true);
    toast.success(`Número copiado: ${cleanNumber}`);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#38bdf8", "#0284c7", "#10b981", "#64748b"],
      });
    } catch (e) {
      // Ignorar
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!selectedFile) {
      setFileError("Debes adjuntar la imagen o PDF del comprobante de transferencia");
      return;
    }
    setFileError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("id_factura", data.id_factura);
      formData.append("id_cliente", client.id);
      formData.append("referencia", data.referencia);
      formData.append("metodo_pago", currentMethod?.name || data.metodo_pago);
      formData.append("monto", data.monto.toString());
      formData.append("fecha_pago", data.fecha_pago);
      if (data.observaciones) {
        formData.append("observaciones", data.observaciones);
      }
      formData.append("comprobante", selectedFile);

      const res = await fetch("/api/facturas/reportar-pago", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "No se pudo procesar el reporte");
      }

      triggerConfetti();
      toast.success("Comprobante reportado exitosamente", {
        description: `Radicado: ${json.radicado}`,
      });
      setSuccessData(json);
      onSuccessReport(json);
    } catch (err: any) {
      console.error(err);
      toast.error("Error al reportar pago", {
        description: err.message || "Intenta nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    reset();
    setSelectedFile(null);
    setSuccessData(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <ReceiptText className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Reportar Comprobante de Pago
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verificación inmediata de abono para {client.nombreCompleto}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successData ? (
            /* Pantalla de Éxito */
            <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} />
                  Reporte Registrado
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Comprobante Recibido
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  El comprobante ha sido ingresado a nuestro sistema. El equipo de soporte validará la transferencia.
                </p>
              </div>

              {/* Receipt Ticket Box */}
              <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-left space-y-2.5 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-slate-400 font-sans">Radicado:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {successData.radicado}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Abonado:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-sans truncate max-w-[200px]">
                    {client.nombreCompleto}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Monto:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(successData.monto)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Canal:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-sans">
                    {successData.metodoPago}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Referencia:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {successData.referencia}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span className="text-slate-400 font-sans">Fecha y Hora:</span>
                  <span className="text-slate-600 dark:text-slate-400 font-sans">
                    {formatDateTime(successData.fechaRecepcion)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white transition-all cursor-pointer"
                >
                  Volver al Panel
                </button>
              </div>
            </div>
          ) : (
            /* Formulario de Reporte */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* 1. Selección de Factura */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Factura a Cancelar <span className="text-rose-500">*</span>
                </label>
                <select
                  {...register("id_factura", {
                    onChange: (e) => {
                      const selected = pendingInvoices.find((i) => i.id === e.target.value);
                      if (selected) {
                        setValue("monto", selected.saldoPendiente);
                      }
                    },
                  })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {pendingInvoices.length > 0 ? (
                    pendingInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.folio} — {inv.periodo} ({formatCurrency(inv.saldoPendiente)})
                      </option>
                    ))
                  ) : (
                    <option value="">No hay facturas pendientes registradas</option>
                  )}
                </select>
                {errors.id_factura && (
                  <p className="text-xs text-rose-500 mt-1">{errors.id_factura.message}</p>
                )}
              </div>

              {/* 2. Canal de Pago Directo */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Canal de Pago Utilizado <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {branding.paymentMethods.map((m) => {
                    const isSelected = currentMethodId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setValue("metodo_pago", m.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? "border-slate-900 dark:border-slate-400 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/10 dark:ring-slate-400/20"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {m.iconName === "QrCode" ? (
                            <QrCode className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                          ) : (
                            <Smartphone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                          )}
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {m.shortName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
                          {m.accountNumber}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón sutil de copiar cuenta seleccionada */}
              {currentMethod && (
                <div className="rounded-2xl p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">
                      Transferir a {currentMethod.name} ({currentMethod.accountHolder}):
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {currentMethod.accountNumber}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      copiedAccount
                        ? "bg-emerald-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {copiedAccount ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={1.75} />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />
                        <span>Copiar número</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 3. Grid: Referencia & Monto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Número de Comprobante / Referencia <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. M18492048"
                    {...register("referencia")}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  {errors.referencia && (
                    <p className="text-xs text-rose-500 mt-1">{errors.referencia.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Valor Transferido ($ COP) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="100"
                    placeholder="85000"
                    {...register("monto", { valueAsNumber: true })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  {errors.monto && (
                    <p className="text-xs text-rose-500 mt-1">{errors.monto.message}</p>
                  )}
                </div>
              </div>

              {/* 4. Fecha y Hora */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Fecha y Hora de la Transferencia <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...register("fecha_pago")}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                {errors.fecha_pago && (
                  <p className="text-xs text-rose-500 mt-1">{errors.fecha_pago.message}</p>
                )}
              </div>

              {/* 5. Subida de Archivo Comprobante */}
              <FileUpload
                onFileSelect={(file) => {
                  setSelectedFile(file);
                  if (file) setFileError(null);
                }}
                selectedFile={selectedFile}
                error={fileError || undefined}
              />

              {/* 6. Observaciones Opcionales */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Información adicional relevante..."
                  {...register("observaciones")}
                  className="w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleModalClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                      Enviando comprobante...
                    </>
                  ) : (
                    <>
                      <span>Enviar Comprobante</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
