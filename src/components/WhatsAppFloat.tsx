"use client";

import { ClientProfile } from "@/lib/types";
import { useConfig } from "@/context/ConfigContext";
import { branding } from "@/config/branding";
import Image from "next/image";

interface WhatsAppFloatProps {
  client: ClientProfile | null;
}

export function WhatsAppFloat({ client }: WhatsAppFloatProps) {
  const { config } = useConfig();
  const rawPhone = config.companyInfo.supportPhone || branding.supportPhone;
  const cleanPhone = rawPhone.replace(/\D/g, "");
  const fullPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;
  const companyName = config.companyInfo.companyName || branding.companyName;

  const targetUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(`Hola ${companyName}, necesito soporte con mi servicio.`)}`;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center group pointer-events-none">
      {/* Tooltip limpio on hover */}
      <span className="hidden sm:inline-block mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none translate-x-2 group-hover:translate-x-0 border border-slate-800">
        {client ? `Soporte en línea: ${client.nombreCompleto.split(" ")[0]}` : "Atención y Soporte WhatsApp"}
      </span>

      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar soporte por WhatsApp"
        className="pointer-events-auto relative flex items-center justify-center w-13 h-13 sm:w-16 sm:h-16 transition-all duration-300 hover:scale-110 active:scale-95 drop-shadow-[0_8px_20px_rgba(34,197,94,0.35)] hover:drop-shadow-[0_12px_28px_rgba(34,197,94,0.55)] cursor-pointer"
      >
        <Image
          src="/whatsapp-official.png"
          alt="WhatsApp Soporte"
          width={64}
          height={64}
          className="w-full h-full object-contain pointer-events-none select-none"
          priority
        />
      </a>
    </div>
  );
}
