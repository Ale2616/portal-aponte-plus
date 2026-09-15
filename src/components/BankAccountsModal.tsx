"use client";

import { useState } from "react";
import { branding, PaymentMethod } from "@/config/branding";
import { useConfig } from "@/context/ConfigContext";
import {
  X,
  Copy,
  Check,
  Smartphone,
  QrCode,
  Building2,
  ReceiptText,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

interface BankAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BankAccountsModal({ isOpen, onClose }: BankAccountsModalProps) {
  const { config, globalSettings } = useConfig();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string, name: string) => {
    // Normalizar a sólo dígitos para portapapeles si es necesario o el formato limpio
    const cleanNumber = text.replace(/\s+/g, "");
    navigator.clipboard.writeText(cleanNumber);
    setCopiedId(id);
    toast.success(`Número de ${name} copiado: ${cleanNumber}`);
    setTimeout(() => {
      setCopiedId(null);
    }, 2200);
  };

  const getMethodIcon = (method: PaymentMethod) => {
    if (method.iconUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={method.iconUrl}
          alt={method.name}
          className="w-6 h-6 object-contain"
        />
      );
    }
    switch (method.iconName) {
      case "Smartphone":
        return <Smartphone className="w-5 h-5 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />;
      case "QrCode":
        return <QrCode className="w-5 h-5 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />;
      default:
        return <Building2 className="w-5 h-5 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-7 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Recepción Oficial de Pagos
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Canales de Pago Directo
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Titular / Destino Card Summary */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Titular / Destino
            </span>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">
              {config.companyInfo.companyName || branding.companyName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {globalSettings?.titular || config.companyInfo.accountHolder || "Andrés Aponte / Aponte Plus"} • NIT: {branding.nit}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 self-start sm:self-auto border border-slate-300/40 dark:border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} />
            Cuenta Verificada
          </div>
        </div>

        {/* Lista de Canales (Nequi, Bancolombia, Bre-B) */}
        <div className="space-y-3">
          {branding.paymentMethods.map((method: PaymentMethod) => {
            let displayNumber = method.accountNumber;
            if (method.id === "nequi" && globalSettings?.canalesPago?.nequi) {
              displayNumber = globalSettings.canalesPago.nequi;
            } else if (method.id === "bancolombia" && globalSettings?.canalesPago?.bancolombia) {
              displayNumber = globalSettings.canalesPago.bancolombia;
            } else if (method.id === "breb" && globalSettings?.canalesPago?.breB) {
              displayNumber = globalSettings.canalesPago.breB;
            } else if (config.companyInfo.nequiNumber && (method.id.includes("nequi") || method.id.includes("bre-b"))) {
              displayNumber = config.companyInfo.nequiNumber;
            }
            const isCopied = copiedId === method.id;

            return (
              <div
                key={method.id}
                className="group relative rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Icon container minimalist */}
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                      {getMethodIcon(method)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {method.name}
                        </h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {method.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {method.accountType}
                      </p>
                    </div>
                  </div>

                  {/* Número de cuenta y botón copiar sutil */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
                    <span className="font-sans text-base font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                      {displayNumber}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopy(displayNumber, method.id, method.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isCopied
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80"
                      }`}
                      title="Copiar número de cuenta al portapapeles"
                    >
                      {isCopied ? (
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
                </div>

                {/* Instrucción limpia sin emojis */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/80 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ReceiptText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>{method.instructions}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info con botón directo a WhatsApp */}
        {(() => {
          const rawPhone = config.companyInfo.supportPhone || branding.supportPhone;
          const cleanPhone = rawPhone.replace(/\D/g, "");
          const fullPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;
          const supportUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(`Hola ${config.companyInfo.companyName || branding.companyName}, necesito soporte con mi servicio o pago.`)}`;

          return (
            <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">¿Requieres asistencia con tu pago?</span>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Comunícate directamente a nuestra línea oficial de atención ({config.companyInfo.supportPhoneFormatted || config.companyInfo.supportPhone}).
                  </p>
                </div>
              </div>

              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors flex-shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>WhatsApp Soporte</span>
              </a>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
