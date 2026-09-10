"use client";

import { useState } from "react";
import { branding } from "@/config/branding";
import { useConfig } from "@/context/ConfigContext";
import { InstallPWAButton } from "./InstallPWAButton";
import { HomeAdCarousel } from "./HomeAdCarousel";
import {
  Search,
  Loader2,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

interface SearchScreenProps {
  onSearch: (documento: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function SearchScreen({ onSearch, isLoading, error }: SearchScreenProps) {
  const [documento, setDocumento] = useState("");
  const { config } = useConfig();
  const banner = config.homeAdBanner;
  const supportPhoneClean = (config.companyInfo?.supportPhone || "3185577157").replace(/\D/g, "");
  const phoneWithCountry = supportPhoneClean.startsWith("57") ? supportPhoneClean : `57${supportPhoneClean}`;
  const defaultPromoMsg = "Hola, vi la promoción en el portal y deseo más información sobre el servicio de internet";
  const promoWhatsappMsg =
    banner?.whatsappMensaje &&
    banner.whatsappMensaje !== "Hola Internet Aponte Plus, vi la promoción en la pantalla de inicio y quiero más información."
      ? banner.whatsappMensaje
      : defaultPromoMsg;
  const promoButtonText = banner?.botonTexto
    ? banner.botonTexto.includes("📲")
      ? banner.botonTexto
      : `📲 ${banner.botonTexto}`
    : "📲 Preguntar por WhatsApp";

  const targetWhatsappUrl = banner?.linkWhatsapp && banner.linkWhatsapp.startsWith("http")
    ? banner.linkWhatsapp
    : `https://wa.me/${phoneWithCountry || "573185577157"}?text=${encodeURIComponent(promoWhatsappMsg)}`;

  const bannerImages = Array.isArray(banner?.imageUrls) && banner.imageUrls.length > 0
    ? banner.imageUrls
    : [banner?.imageUrl || "/banner-promo-fibra.jpg"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento.trim()) return;
    onSearch(documento);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Card Principal de Búsqueda */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-auto h-24 sm:h-28 mx-auto flex items-center justify-center p-2.5 bg-white rounded-2xl border border-slate-200/80 shadow-md max-w-[260px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-full w-auto object-contain"
            />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Portal de Autogestión
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {config.companyInfo.companyName || branding.companyName}
            </p>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Ingresa tu cédula o número de documento para consultar tu estado de cuenta y reportar pagos.
          </p>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="cedula-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Cédula / Documento de Identidad
            </label>
            <div className="relative">
              <input
                id="cedula-input"
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ej. 1020304050"
                autoFocus
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-2xl text-base font-sans font-semibold tracking-tight tabular-nums bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all disabled:opacity-50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !documento.trim()}
            className="w-full py-3 px-6 rounded-2xl font-semibold text-sm bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 active:bg-slate-950 text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                <span>Consultando abonado...</span>
              </>
            ) : (
              <>
                <span>Ingresar al Portal</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </>
            )}
          </button>
        </form>

        {/* ======================================================== */}
        {/* TARJETA DE PUBLICIDAD / PROMOCIÓN EN EL INICIO           */}
        {/* ======================================================== */}
        {banner.enabled && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <HomeAdCarousel
              images={bannerImages}
              titulo={banner.titulo}
              descripcion={banner.descripcion}
              botonTexto={promoButtonText}
              whatsappUrl={targetWhatsappUrl}
              autoPlayInterval={4500}
            />
          </div>
        )}

        {/* Seguridad */}
        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-400 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
          <span>Consulta segura por documento • Conexión cifrada</span>
        </div>
      </div>

      {/* Banner PWA */}
      <InstallPWAButton variant="banner" />

      {/* Enlace Directo / Ayuda */}
      <div className="rounded-2xl p-4 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
          ¿Accedes desde un mensaje de texto o WhatsApp?
        </p>
        <p>
          Si cuentas con un enlace directo con tu cédula (<code className="font-sans font-semibold tracking-tight tabular-nums text-slate-700 dark:text-slate-300">?cedula=1020304050</code>), ingresarás automáticamente.
        </p>
      </div>
    </div>
  );
}
