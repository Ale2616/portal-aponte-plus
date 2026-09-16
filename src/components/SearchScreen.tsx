"use client";

import { useState, useRef } from "react";
import { branding } from "@/config/branding";
import { useConfig } from "@/context/ConfigContext";
import { InstallPWAButton } from "./InstallPWAButton";
import { HomeAdCarousel } from "./HomeAdCarousel";
import {
  Search,
  Loader2,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Lock,
  Headphones,
  Receipt,
  Radio,
  Gauge,
} from "lucide-react";

interface SearchScreenProps {
  onSearch: (documento: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onOpenAdminPin?: () => void;
  onOpenSpeedTest?: () => void;
}

export function SearchScreen({
  onSearch,
  isLoading,
  error,
  onOpenAdminPin,
  onOpenSpeedTest,
}: SearchScreenProps) {
  const [documento, setDocumento] = useState("");
  const { config, globalSettings } = useConfig();

  // Puerta Secreta alternativa en el título (5 clics continuos)
  const [secretClicks, setSecretClicks] = useState(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretTrigger = () => {
    const nextClicks = secretClicks + 1;
    if (nextClicks >= 5) {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      setSecretClicks(0);
      if (onOpenAdminPin) {
        onOpenAdminPin();
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("open-admin-secret-pin"));
      }
      return;
    }

    setSecretClicks(nextClicks);
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      setSecretClicks(0);
    }, 2500);
  };
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
    ? banner.botonTexto.replace(/📲/g, "").replace(/💬/g, "").trim() || "Preguntar por WhatsApp"
    : "Preguntar por WhatsApp";

  const targetWhatsappUrl = banner?.linkWhatsapp && banner.linkWhatsapp.startsWith("http")
    ? banner.linkWhatsapp
    : `https://wa.me/${phoneWithCountry || "573185577157"}?text=${encodeURIComponent(promoWhatsappMsg)}`;

  const activeBannersFromGlobal = Array.isArray(globalSettings?.banners)
    ? globalSettings.banners
        .filter((b: any) => (b.activo !== undefined ? b.activo === true : b.active === true) && b.url && b.url.trim() !== "")
        .map((b) => b.url)
    : [];

  const bannerImages =
    activeBannersFromGlobal.length > 0
      ? activeBannersFromGlobal
      : Array.isArray(banner?.imageUrls)
      ? banner.imageUrls.filter(Boolean)
      : banner?.imageUrl
      ? [banner.imageUrl]
      : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = documento.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* ─── TARJETA PRINCIPAL GLASSMORPHISM FLOTANTE ───────────────────────────── */}
      <div className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 bg-white/85 dark:bg-[#0c1322]/85 backdrop-blur-2xl border border-white/70 dark:border-cyan-500/20 shadow-[0_20px_60px_-15px_rgba(2,132,199,0.12),0_0_0_1px_rgba(255,255,255,0.7)_inset] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(6,182,212,0.15)_inset] transition-all duration-300 space-y-5 sm:space-y-7">
        
        {/* Cabecera: Píldora de Estado y Título de Alto Nivel */}
        <div className="text-center space-y-3.5">
          {/* Badge Píldora: Portal Oficial */}
          <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-cyan-500/[0.08] dark:bg-cyan-950/60 border border-cyan-500/25 text-cyan-800 dark:text-cyan-300 shadow-xs backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 shadow-xs shadow-cyan-400"></span>
            </span>
            <span className="font-semibold tracking-tight">Portal Oficial</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-[-0.03em] leading-tight">
              Portal de Autogestión
            </h1>
            <p
              onClick={handleSecretTrigger}
              className="text-xs sm:text-sm font-semibold text-cyan-700 dark:text-cyan-400/90 cursor-pointer select-none active:scale-[0.98] transition-transform"
              title="Internet Aponte Plus"
            >
              {config.companyInfo.companyName || branding.companyName}
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Consulta tu estado de cuenta, verifica tus facturas y gestiona los pagos de tu conexión de internet.
          </p>
        </div>

        {/* Mensaje de error con transición suave */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in zoom-in-95 duration-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" strokeWidth={2} />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Formulario de Consulta / Acceso */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label
                htmlFor="cedula-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Cédula / Documento de Identidad
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Solo números</span>
            </div>

            {/* Input ergonómico min-h-[48px] sm:min-h-[52px] con text-base obligatorio para iOS */}
            <div className="relative group">
              <input
                id="cedula-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={documento}
                onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ""))}
                placeholder="Ingresa tu documento..."
                autoFocus
                disabled={isLoading}
                className="w-full min-h-[48px] sm:min-h-[52px] h-12 sm:h-14 pl-12 pr-4 rounded-2xl text-base font-sans font-bold tracking-tight tabular-nums bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-normal placeholder:text-sm sm:placeholder:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-900 shadow-inner transition-all duration-250 ease-[cubic-bezier(0.165,0.84,0.44,1)] disabled:opacity-50"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors duration-250 ease-[cubic-bezier(0.165,0.84,0.44,1)] pointer-events-none">
                <Search className="w-5 h-5" strokeWidth={2} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
              Sin puntos, espacios ni guiones. Registrado en tu servicio de internet.
            </p>
          </div>

          {/* Botón Principal de Alto Impacto Ergonómico (Ancho Completo) */}
          <button
            type="submit"
            disabled={isLoading || !documento.trim()}
            className="w-full py-3.5 px-6 rounded-2xl font-semibold shadow-md bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} />
                <span>Consultando información...</span>
              </>
            ) : (
              <>
                <span>Consultar mi Servicio</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.2} />
              </>
            )}
          </button>
        </form>

        {/* ─── BOTÓN SECUNDARIO: TEST DE VELOCIDAD (ANCHO COMPLETO / CASCADA) ─── */}
        {onOpenSpeedTest && (
          <button
            type="button"
            onClick={onOpenSpeedTest}
            className="w-full py-3.5 px-6 rounded-2xl font-semibold border transition-all mt-3 bg-[#3b4b68] hover:bg-[#2f3d54] text-white border-slate-600 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-800/80 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] shadow-sm"
            title="Medir velocidad de conexión de tu fibra óptica"
          >
            <Gauge className="w-4 h-4 text-cyan-400 animate-pulse" strokeWidth={2} />
            <span>Test de Velocidad • Medir Conexión</span>
          </button>
        )}

        {/* ─── FILA DE BENEFICIOS / CARACTERÍSTICAS (TEXTO SUTIL) ─────────── */}
        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mt-4 mb-6 text-xs text-slate-500 dark:text-slate-400">
          <div className="inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-cyan-500 shrink-0" strokeWidth={2} />
            <span>Conexión Cifrada</span>
          </div>

          <a
            href={`https://wa.me/${phoneWithCountry || "573185577157"}?text=${encodeURIComponent("Hola Internet Aponte Plus, deseo atención y soporte técnico.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
            title="Contactar soporte por WhatsApp"
          >
            <Headphones className="w-3.5 h-3.5 text-amber-500 shrink-0" strokeWidth={2} />
            <span>Soporte Rápido</span>
          </a>

          <button
            type="button"
            onClick={() => {
              const input = document.getElementById("cedula-input");
              if (input) {
                input.focus();
                input.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
            className="inline-flex items-center gap-1.5 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
            title="Consultar factura con cédula"
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={2} />
            <span>Facturación en Línea</span>
          </button>
        </div>

        {/* ─── MÓDULO DEL CARRUSEL DE PUBLICIDAD COMPLEMENTARIO ─────────────── */}
        {Boolean(banner?.enabled && bannerImages.length > 0) && (
          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/70 space-y-2">
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
      </div>

      {/* Botón Instalación PWA */}
      <InstallPWAButton variant="banner" />

      {/* Acceso Directo por Cédula */}
      <div className="rounded-2xl p-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-cyan-500" strokeWidth={2} />
          Acceso Directo por Cédula (Sin Contraseñas ni Registros)
        </p>
        <p className="leading-relaxed">
          Consulta instantánea conectada a la red de fibra óptica. Si accedes desde el portal cautivo o un enlace con tu documento (<code className="font-sans font-bold tracking-tight tabular-nums text-slate-700 dark:text-slate-300">?cedula=1020304050</code>), se cargará tu estado automáticamente.
        </p>
      </div>
    </div>
  );
}
