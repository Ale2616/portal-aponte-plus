"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Invoice, ClientProfile, PaymentReportResult } from "@/lib/types";
import { branding } from "@/config/branding";
import { useConfig } from "@/context/ConfigContext";
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
    .max(50, "La referencia no puede superar los 50 caracteres")
    .optional(),
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

async function compressImage(file: File, maxWidth = 1600, quality = 0.75): Promise<File> {
  // Si el archivo no es imagen (ej. PDF) o si ya pesa menos de 800KB, no es necesario comprimir agresivamente
  if (!file.type.startsWith("image/") || file.size <= 800 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Redimensionar proporcionalmente si supera maxWidth
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, ".jpg"),
                {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                }
              );
              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        } catch {
          resolve(file);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function formatThousands(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  const clean = String(value).replace(/\D/g, "");
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseCleanInteger(formatted: string | number | undefined | null): number {
  if (formatted === undefined || formatted === null || formatted === "") return 0;
  const clean = String(formatted).replace(/\D/g, "");
  return clean ? parseInt(clean, 10) : 0;
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

  const [montoDisplay, setMontoDisplay] = useState<string>(() =>
    formatThousands(activeInvoice?.saldoPendiente || 0)
  );

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

  const { config } = useConfig();

  const isCurrentNequi =
    currentMethod?.id.includes("nequi") || currentMethod?.id.includes("bre-b");
  const currentAccountNumber =
    isCurrentNequi && config.companyInfo.nequiNumber
      ? config.companyInfo.nequiNumber
      : currentMethod?.accountNumber || "";
  const currentAccountHolder =
    isCurrentNequi && config.companyInfo.accountHolder
      ? config.companyInfo.accountHolder
      : currentMethod?.accountHolder || "";

  useEffect(() => {
    register("monto");
  }, [register]);

  useEffect(() => {
    if (isOpen && activeInvoice) {
      setValue("id_factura", activeInvoice.id);
      setValue("monto", activeInvoice.saldoPendiente);
      setMontoDisplay(formatThousands(activeInvoice.saldoPendiente));
    }
  }, [isOpen, activeInvoice, setValue]);

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    const digitsOnly = rawInput.replace(/\D/g, "");

    if (!digitsOnly) {
      setMontoDisplay("");
      setValue("monto", 0, { shouldValidate: true });
      return;
    }

    const numericVal = parseInt(digitsOnly, 10);
    const formatted = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setMontoDisplay(formatted);
    setValue("monto", numericVal, { shouldValidate: true });
  };

  if (!isOpen) return null;

  const handleCopyAccount = () => {
    if (!currentAccountNumber) return;
    const cleanNumber = currentAccountNumber.replace(/\s+/g, "");
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
      // 1. Compresión automática de imágenes en el cliente antes de armar el FormData
      const fileAEnviar = await compressImage(selectedFile);

      const formData = new FormData();
      formData.append("archivo", fileAEnviar);
      formData.append("comprobante", fileAEnviar);
      formData.append("nombre", client.nombreCompleto);
      formData.append("nombre_cliente", client.nombreCompleto);
      formData.append("cedula", client.cedula);
      formData.append("cedula_cliente", client.cedula);
      formData.append("plan", client.plan.nombre);
      formData.append("plan_cliente", client.plan.nombre);
      const cleanMonto = parseCleanInteger(montoDisplay) || Math.round(data.monto);
      formData.append("monto", cleanMonto.toString());
      formData.append("metodo_pago", currentMethod?.name || data.metodo_pago);
      formData.append("referencia", (data.referencia || "").trim());
      formData.append("fecha_pago", data.fecha_pago);
      formData.append("id_factura", data.id_factura);
      formData.append("id_cliente", client.id);
      formData.append(
        "nodo_cliente",
        typeof client.servicio.nodo === "object"
          ? (client.servicio.nodo as any)?.nombre || "Nodo Principal"
          : String(client.servicio.nodo || "Nodo Principal")
      );
      if (data.observaciones) {
        formData.append("observaciones", data.observaciones);
      }

      // 2. Manejo seguro de la llamada HTTP y prevención de error de parseo JSON
      const response = await fetch("/api/facturas/reportar-pago", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error(
            "El comprobante es demasiado pesado. Por favor intenta con una captura de pantalla más liviana."
          );
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || `Error del servidor (${response.status})`
        );
      }

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error || "No se pudo procesar el reporte");
      }

      triggerConfetti();
      toast.success("¡Comprobante enviado con éxito!", {
        description: "Su pago será verificado en el sistema en un transcurso de 30 a 60 minutos.",
        duration: 8000,
      });
      onSuccessReport(json);
      handleModalClose();
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
    setMontoDisplay(formatThousands(activeInvoice?.saldoPendiente || 0));
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
              <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-left space-y-2.5 font-sans font-medium text-xs tracking-tight tabular-nums">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-slate-400">Radicado:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-sans tracking-tight tabular-nums">
                    {successData.radicado}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Abonado:</span>
                  <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {client.nombreCompleto}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Monto:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-sans tracking-tight tabular-nums">
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
                        setValue("monto", selected.saldoPendiente, { shouldValidate: true });
                        setMontoDisplay(formatThousands(selected.saldoPendiente));
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
                    const isNequi = m.id.includes("nequi") || m.id.includes("bre-b");
                    const numDisplay =
                      isNequi && config.companyInfo.nequiNumber
                        ? config.companyInfo.nequiNumber
                        : m.accountNumber;

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
                          {m.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.iconUrl}
                              alt={m.name}
                              className="w-4 h-4 object-contain flex-shrink-0"
                            />
                          ) : m.iconName === "QrCode" ? (
                            <QrCode className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                          ) : (
                            <Smartphone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                          )}
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {m.shortName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-semibold tracking-tight tabular-nums mt-1 truncate">
                          {numDisplay}
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
                      Transferir a {currentMethod.name} ({currentAccountHolder}):
                    </span>
                    <span className="font-sans font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100 text-sm">
                      {currentAccountNumber}
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
                    NÚMERO DE COMPROBANTE / REFERENCIA (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. M18492048 (Opcional)"
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
                    type="text"
                    inputMode="numeric"
                    placeholder="50.000"
                    value={montoDisplay}
                    onChange={handleMontoChange}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold font-sans tracking-tight tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
