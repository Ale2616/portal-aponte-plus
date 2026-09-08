"use client";

import { useState } from "react";
import { branding } from "@/config/branding";
import { Smartphone, QrCode, Copy, Check, ShieldCheck, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface DirectPaymentCardProps {
  onOpenReport?: () => void;
}

export function DirectPaymentCard({ onOpenReport }: DirectPaymentCardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string, name: string) => {
    const cleanNumber = text.replace(/\s+/g, "");
    navigator.clipboard.writeText(cleanNumber);
    setCopiedId(id);
    toast.success(`Número de ${name} copiado: ${cleanNumber}`);
    setTimeout(() => {
      setCopiedId(null);
    }, 2200);
  };

  return (
    <div className="w-full rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header de la tarjeta estilo Fintech */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Opciones de Transferencia
          </span>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            Canales de Pago Directo
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} />
            <span>Titular: <strong className="text-slate-800 dark:text-slate-200">{branding.companyName}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid de métodos de pago directo: Nequi, Daviplata, Bre-B */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {branding.paymentMethods.map((method) => {
          const isCopied = copiedId === method.id;

          return (
            <div
              key={method.id}
              className="rounded-2xl p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center flex-shrink-0">
                    {method.iconName === "QrCode" ? (
                      <QrCode className="w-4 h-4 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />
                    ) : (
                      <Smartphone className="w-4 h-4 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {method.name}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {method.accountType}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {method.badge}
                </span>
              </div>

              {/* Número y Botón Copiar */}
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                  {method.accountNumber}
                </span>

                <button
                  type="button"
                  onClick={() => handleCopy(method.accountNumber, method.id, method.name)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    isCopied
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80"
                  }`}
                  title="Copiar número"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-white" strokeWidth={1.75} />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400 dark:text-zinc-400" strokeWidth={1.75} />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer sutil con botón para reportar si se desea */}
      {onOpenReport && (
        <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>¿Ya transferiste tu abono o mensualidad? Adjunta tu voucher para validarlo al instante.</span>
          <button
            type="button"
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex-shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Reportar Comprobante Ahora &rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}
