"use client";

import { ClientProfile } from "@/lib/types";
import { MessageSquare } from "lucide-react";

interface WhatsAppFloatProps {
  client: ClientProfile | null;
}

export function WhatsAppFloat({ client }: WhatsAppFloatProps) {
  // Enlace oficial exacto solicitado
  const baseTargetUrl = "https://wa.me/573185577157?text=Hola%20Internet%20Aponte%20Plus,%20necesito%20soporte%20con%20mi%20servicio.";

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center group">
      {/* Tooltip limpio on hover */}
      <span className="hidden sm:inline-block mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none translate-x-2 group-hover:translate-x-0 border border-slate-800">
        {client ? `Soporte en línea: ${client.nombreCompleto.split(" ")[0]}` : "Atención y Soporte WhatsApp"}
      </span>

      <a
        href={baseTargetUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar soporte por WhatsApp"
        className="relative flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-105 active:scale-95 border border-emerald-400/30"
      >
        <MessageSquare className="w-5 h-5 text-white" strokeWidth={1.75} />
      </a>
    </div>
  );
}
