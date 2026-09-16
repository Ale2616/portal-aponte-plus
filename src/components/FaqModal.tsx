"use client";

import { branding } from "@/config/branding";
import { useConfig } from "@/context/ConfigContext";
import { X, HelpCircle, MessageSquare, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { buildWhatsAppUrl } from "@/lib/utils";

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  cedula?: string;
}

export function FaqModal({ isOpen, onClose, clientName, cedula }: FaqModalProps) {
  const { config } = useConfig();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // Bloqueo estricto del scroll del fondo (body scroll-lock)
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow || "unset";
        document.documentElement.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const supportPhone = config.companyInfo.supportPhone || branding.supportPhone;
  const whatsappUrl = buildWhatsAppUrl(
    supportPhone,
    clientName,
    cedula,
    "Consulta desde el Centro de Ayuda"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Preguntas Frecuentes y Soporte
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Horario de atención: <strong>{branding.supportHours}</strong>
          </p>

          <div className="space-y-2">
            {branding.faq.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleAccordion(index)}
                    className="w-full text-left p-3.5 flex items-center justify-between gap-3 font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      strokeWidth={1.75}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200/40 dark:border-slate-700/40">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contact Direct Box */}
          <div className="pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
              <span>Chatear con Soporte por WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
