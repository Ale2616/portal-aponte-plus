"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useConfig, PromotionItem } from "@/context/ConfigContext";
import { HomeAdCarousel } from "./HomeAdCarousel";
import { compressImageToDataUrl, isDefaultImageList } from "@/lib/image-compression";
import {
  Sliders,
  Sparkles,
  Phone,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  X,
  Megaphone,
  CreditCard,
  Building2,
  MessageCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  Eye,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface AdminControlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminControlModal({ isOpen, onClose }: AdminControlModalProps) {
  const {
    config,
    updateCompanyInfo,
    addPromotion,
    deletePromotion,
    togglePromotion,
    updateGlobalAlert,
    updateHomeAdBanner,
    resetToDefaults,
    setLocalConfig,
  } = useConfig();

  const [activeTab, setActiveTab] = useState<"banner" | "promos" | "comercial" | "alerta">("banner");

  // Estados locales para edición de Info Comercial
  const [companyName, setCompanyName] = useState(config.companyInfo.companyName);
  const [supportPhone, setSupportPhone] = useState(config.companyInfo.supportPhone);
  const [nequiNumber, setNequiNumber] = useState(config.companyInfo.nequiNumber);
  const [accountHolder, setAccountHolder] = useState(config.companyInfo.accountHolder);

  // Estados locales para Aviso Global
  const [alertEnabled, setAlertEnabled] = useState(config.globalAlert.enabled);
  const [alertMessage, setAlertMessage] = useState(config.globalAlert.message);
  const [alertType, setAlertType] = useState<"warning" | "info">(config.globalAlert.type);

  // Estados locales para Banner Publicitario de Inicio (Hasta 5 imágenes)
  const [bannerEnabled, setBannerEnabled] = useState(config.homeAdBanner?.enabled ?? true);
  const [bannerImageUrls, setBannerImageUrls] = useState<string[]>(() => {
    const configImgs = config.homeAdBanner?.imageUrls;
    if (Array.isArray(configImgs)) {
      return configImgs.slice(0, 5);
    }
    if (config.homeAdBanner?.imageUrl) {
      return [config.homeAdBanner.imageUrl];
    }
    return [];
  });
  const [newImageUrlInput, setNewImageUrlInput] = useState("");
  const [bannerTitulo, setBannerTitulo] = useState(
    config.homeAdBanner?.titulo ?? "¡Pásate a Fibra Óptica con Alta Velocidad!"
  );
  const [bannerDescripcion, setBannerDescripcion] = useState(
    config.homeAdBanner?.descripcion ??
      "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada."
  );
  const [bannerBotonTexto, setBannerBotonTexto] = useState(
    config.homeAdBanner?.botonTexto ?? "📲 Preguntar por WhatsApp"
  );
  const [bannerWhatsappMensaje, setBannerWhatsappMensaje] = useState(
    config.homeAdBanner?.whatsappMensaje ??
      "Hola, vi la promoción en el portal y deseo más información sobre el servicio de internet"
  );

  const wasOpenRef = useRef(false);
  const hasUserModifiedBannerRef = useRef(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sincronizar estados locales ÚNICAMENTE cuando el modal se abre (transición de cerrado a abierto)
  // Se ignora config en la dependencia para evitar sobreescrituras por sondeos o refetch en segundo plano
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setCompanyName(config.companyInfo.companyName);
      setSupportPhone(config.companyInfo.supportPhone);
      setNequiNumber(config.companyInfo.nequiNumber);
      setAccountHolder(config.companyInfo.accountHolder);
      setAlertEnabled(config.globalAlert.enabled);
      setAlertMessage(config.globalAlert.message);
      setAlertType(config.globalAlert.type);

      if (config.homeAdBanner) {
        setBannerEnabled(config.homeAdBanner.enabled);
        setBannerTitulo(config.homeAdBanner.titulo);
        setBannerDescripcion(config.homeAdBanner.descripcion);
        setBannerBotonTexto(config.homeAdBanner.botonTexto);
        setBannerWhatsappMensaje(config.homeAdBanner.whatsappMensaje);

        if (Array.isArray(config.homeAdBanner.imageUrls)) {
          setBannerImageUrls(config.homeAdBanner.imageUrls.slice(0, 5));
        } else if (config.homeAdBanner.imageUrl) {
          setBannerImageUrls([config.homeAdBanner.imageUrl]);
        } else {
          setBannerImageUrls([]);
        }
      }
    }

    wasOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Manejo de carga de archivos locales con compresión previa en Canvas (máx 1080px, calidad 0.75 WebP/JPEG)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const availableSlots = 5 - bannerImageUrls.length;
    if (availableSlots <= 0) {
      toast.warning("Límite alcanzado: máximo 5 imágenes para el carrusel publicitario.");
      e.target.value = "";
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    setIsCompressingImage(true);
    const toastId = toast.loading(
      filesToProcess.length === 1
        ? "Optimizando y comprimiendo imagen con Canvas..."
        : `Optimizando y comprimiendo ${filesToProcess.length} imágenes...`
    );

    try {
      const compressedList: string[] = [];
      for (const file of filesToProcess) {
        const compressedBase64 = await compressImageToDataUrl(file, {
          maxWidth: 1080,
          quality: 0.75,
        });
        compressedList.push(compressedBase64);
      }

      setBannerImageUrls((prev) => {
        const next = [...prev, ...compressedList].slice(0, 5);
        hasUserModifiedBannerRef.current = true;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("portal_admin_banner_images_cache", JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      toast.success(
        filesToProcess.length === 1
          ? `Imagen optimizada y añadida (${Math.min(bannerImageUrls.length + 1, 5)}/5).`
          : `¡${filesToProcess.length} imágenes optimizadas y añadidas! (${Math.min(
              bannerImageUrls.length + filesToProcess.length,
              5
            )}/5)`,
        {
          id: toastId,
          description: "Redimensionada a máx 1080px (calidad 0.75) para evitar error 413 de Vercel.",
        }
      );
    } catch (err: any) {
      console.error("[Image Compression Error]:", err);
      toast.error("Error al procesar la imagen", {
        id: toastId,
        description: err.message || "Verifica que el archivo sea una imagen válida.",
      });
    } finally {
      setIsCompressingImage(false);
      e.target.value = ""; // Limpiar input file
    }
  };

  const handleAddImageUrl = async () => {
    const trimmed = newImageUrlInput.trim();
    if (!trimmed) return;
    if (bannerImageUrls.length >= 5) {
      toast.warning("Máximo 5 imágenes permitidas en el carrusel.");
      return;
    }

    try {
      // Si el usuario ingresó un Base64 largo directamente, comprimirlo con Canvas
      const finalUrl = trimmed.startsWith("data:image/")
        ? await compressImageToDataUrl(trimmed, { maxWidth: 1080, quality: 0.75 })
        : trimmed;

      setBannerImageUrls((prev) => {
        const next = [...prev, finalUrl].slice(0, 5);
        hasUserModifiedBannerRef.current = true;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("portal_admin_banner_images_cache", JSON.stringify(next));
          } catch {}
        }
        return next;
      });
      setNewImageUrlInput("");
      toast.success(`Imagen añadida al carrusel (${bannerImageUrls.length + 1}/5).`);
    } catch (err: any) {
      toast.error("No se pudo añadir la imagen", { description: err.message });
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setBannerImageUrls((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      hasUserModifiedBannerRef.current = true;
      if (next.length === 0) {
        setBannerEnabled(false);
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("portal_admin_banner_images_cache", JSON.stringify(next));
        } catch {}
      }
      return next;
    });
    toast.info("Imagen retirada del carrusel.");
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    setBannerImageUrls((prev) => {
      const copy = [...prev];
      const selected = copy.splice(index, 1)[0];
      copy.unshift(selected);
      hasUserModifiedBannerRef.current = true;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("portal_admin_banner_images_cache", JSON.stringify(copy));
        } catch {}
      }
      return copy;
    });
    toast.success("Imagen establecida como principal (primera diapositiva).");
  };

  const [isSavingBanner, setIsSavingBanner] = useState(false);

  const handleSaveBanner = async () => {
    setIsSavingBanner(true);
    const cleanPhone = (supportPhone || "3185577157").replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("57") ? cleanPhone : `57${cleanPhone}`;
    const defaultMsg =
      "Hola, vi la promoción en el portal y deseo más información sobre el servicio de internet";
    const waMsg = bannerWhatsappMensaje.trim() || defaultMsg;
    const linkWhatsapp = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(waMsg)}`;
    
    // Validar y asegurar compresión Canvas previa (máx 1080px, calidad 0.75) para todas las imágenes Base64
    const validImgs = bannerImageUrls.filter(Boolean);
    const finalImgs: string[] = [];

    for (const img of validImgs) {
      if (img.startsWith("data:image/") && img.length > 120000) {
        try {
          const comp = await compressImageToDataUrl(img, { maxWidth: 1080, quality: 0.75 });
          finalImgs.push(comp);
        } catch {
          finalImgs.push(img);
        }
      } else {
        finalImgs.push(img);
      }
    }

    // Auto-desactivar banner si el arreglo queda vacío
    const isAutoDisabled = finalImgs.length === 0;
    const effectiveEnabled = isAutoDisabled ? false : bannerEnabled;
    if (isAutoDisabled) {
      setBannerEnabled(false);
    }

    try {
      // Guardar directamente en el endpoint unificado del servidor
      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin: "1130",
          config: {
            homeAdBanner: {
              enabled: effectiveEnabled,
              imageUrl: finalImgs[0] || "",
              imageUrls: finalImgs,
              titulo: bannerTitulo.trim() || "¡Pásate a Fibra Óptica con Alta Velocidad!",
              descripcion:
                bannerDescripcion.trim() ||
                "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada.",
              botonTexto: bannerBotonTexto.trim() || "📲 Preguntar por WhatsApp",
              whatsappMensaje: waMsg,
              linkWhatsapp,
            },
          },
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        if (res.status === 413) {
          throw new Error("El tamaño total de las imágenes supera el límite de Vercel (Error 413).");
        }
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error (${res.status}): No se pudo guardar la configuración.`);
      }

      // Sincronizar contexto localmente con la configuración guardada por el servidor
      if (data.config) {
        setLocalConfig(data.config);
      }

      hasUserModifiedBannerRef.current = false;
      setBannerImageUrls(finalImgs);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("portal_admin_banner_images_cache", JSON.stringify(finalImgs));
        } catch {}
      }

      toast.success(
        isAutoDisabled
          ? "Banner guardado sin imágenes y auto-desactivado del portal."
          : `¡Carrusel publicitario guardado! (${finalImgs.length}/5 imágenes activas).`,
        {
          description: isAutoDisabled
            ? "El banner no ocupará espacio ni se mostrará en el portal."
            : "Sincronizado globalmente en el servidor para todos los abonados.",
        }
      );
    } catch (err: any) {
      console.error("[handleSaveBanner Error]:", err);
      toast.error("Error al guardar en el servidor", {
        description: err.message || "No se pudo sincronizar la promoción.",
      });
    } finally {
      setIsSavingBanner(false);
    }
  };

  // Guardar Datos Comerciales en el Servidor
  const handleSaveCompany = async () => {
    try {
      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: "1130",
          config: {
            companyInfo: {
              companyName: companyName.trim() || "Internet Aponte Plus",
              supportPhone: supportPhone.trim() || "3185577157",
              nequiNumber: nequiNumber.trim() || "311 276 0959",
              accountHolder: accountHolder.trim() || "Orlando Aponte",
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      if (data.config) {
        setLocalConfig(data.config);
      }
      toast.success("Datos comerciales guardados globalmente en el servidor.");
    } catch (err: any) {
      toast.error("Error al guardar datos comerciales", { description: err.message });
    }
  };

  // Guardar Aviso Global en el Servidor
  const handleSaveAlert = async () => {
    try {
      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: "1130",
          config: {
            globalAlert: {
              enabled: alertEnabled,
              message: alertMessage.trim() || "Aviso de mantenimiento programado.",
              type: alertType,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      if (data.config) {
        setLocalConfig(data.config);
      }
      toast.success(
        alertEnabled
          ? "Aviso publicado globalmente en el servidor para todos los clientes."
          : "Aviso desactivado en el servidor."
      );
    } catch (err: any) {
      toast.error("Error al guardar aviso", { description: err.message });
    }
  };

  // Estado para formulario de nueva promoción
  const [isAddingPromo, setIsAddingPromo] = useState(false);
  const [newPromo, setNewPromo] = useState<Omit<PromotionItem, "id">>({
    tag: "⚡ Nueva Oferta",
    titulo: "",
    descripcion: "",
    botonTexto: "Consultar Oferta",
    whatsappMensaje: "Hola, me interesa la nueva promoción que vi en el portal.",
    gradiente: "from-blue-600 via-indigo-600 to-violet-700",
    icono: "Zap",
    imagenUrl: "",
    activo: true,
  });

  const handleAddPromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.titulo.trim() || !newPromo.descripcion.trim()) {
      toast.error("El título y la descripción son obligatorios.");
      return;
    }
    await addPromotion(newPromo);
    setIsAddingPromo(false);
    setNewPromo({
      tag: "⚡ Nueva Oferta",
      titulo: "",
      descripcion: "",
      botonTexto: "Consultar Oferta",
      whatsappMensaje: "Hola, me interesa la nueva promoción que vi en el portal.",
      gradiente: "from-blue-600 via-indigo-600 to-violet-700",
      icono: "Zap",
      imagenUrl: "",
      activo: true,
    });
    toast.success("Nueva promoción guardada en el servidor.");
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl h-[92vh] max-h-[860px] flex flex-col rounded-[2rem] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 shadow-[0_25px_70px_rgba(0,0,0,0.7)] text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow sutil superior */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent pointer-events-none" />

        {/* ─── HEADER ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-slate-800/90 bg-slate-950/70">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
              <Sliders className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Panel de Control Interno
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-tight tabular-nums bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  PIN 1130
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Base de Datos Servidor
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sincronización global en tiempo real • Cero almacenamiento local
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── TABS DE NAVEGACIÓN ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-6 sm:px-8 py-2.5 border-b border-slate-800/80 bg-slate-950/40 text-xs font-semibold overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveTab("banner")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "banner"
                ? "bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/40 text-amber-300 font-bold shadow-sm shadow-amber-950/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Banner de Inicio ({bannerImageUrls.length} imgs)</span>
            {config.homeAdBanner?.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("promos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "promos"
                ? "bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/40 text-amber-300 font-bold shadow-sm shadow-amber-950/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Promociones Carrusel ({config.promotions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("comercial")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "comercial"
                ? "bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/40 text-amber-300 font-bold shadow-sm shadow-amber-950/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Información Comercial</span>
          </button>

          <button
            onClick={() => setActiveTab("alerta")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "alerta"
                ? "bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/40 text-amber-300 font-bold shadow-sm shadow-amber-950/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Aviso Global</span>
            {config.globalAlert.enabled && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* ─── CUERPO DEL CONTENIDO ──────────────────────────────────────────── */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-sm [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
          
          {/* ======================================================== */}
          {/* TAB 1: BANNER DE INICIO CON CARRUSEL DE HASTA 5 IMÁGENES */}
          {/* ======================================================== */}
          {activeTab === "banner" && (
            <div className="space-y-6">
              {/* Barra superior de visibilidad */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 shadow-sm">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-amber-400" />
                    Carrusel Publicitario de Inicio (Hasta 5 Imágenes)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Carrusel dinámico con AutoPlay (cada 4.5s), soporte táctil Swipe e indicadores de puntos
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-700/80 self-start sm:self-auto">
                  <span className={`text-xs font-bold ${bannerEnabled ? "text-emerald-400" : "text-slate-400"}`}>
                    {bannerEnabled ? "Visible en Inicio" : "Banner Oculto"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBannerEnabled(!bannerEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      bannerEnabled ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        bannerEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* GRID PRINCIPAL: Vista previa en carrusel a la izquierda, formulario a la derecha */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
                
                {/* ── COLUMNA IZQUIERDA: CARRUSEL EN VIVO ── */}
                <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-0">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      Vista Previa Interactiva del Carrusel
                    </label>
                    <span className="text-[10px] text-cyan-400/80 bg-cyan-950/60 border border-cyan-500/20 px-2 py-0.5 rounded-full font-medium">
                      AutoPlay • Swipe
                    </span>
                  </div>

                  {/* Render del Carrusel Real */}
                  {/* Render del Carrusel Real o Estado Vacío */}
                  {bannerImageUrls.length > 0 ? (
                    <HomeAdCarousel
                      images={bannerImageUrls}
                      titulo={bannerTitulo}
                      descripcion={bannerDescripcion}
                      botonTexto={bannerBotonTexto}
                      whatsappUrl="#"
                      autoPlayInterval={4500}
                    />
                  ) : (
                    <div className="w-full aspect-[16/9] max-h-[360px] bg-slate-950/90 border-2 border-dashed border-slate-700/80 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                      <p className="text-xs font-bold text-slate-300">0/5 Imágenes en el Banner</p>
                      <p className="text-[11px] text-slate-500 max-w-xs">
                        El banner está auto-desactivado y no ocupará espacio en el portal público. Sube una imagen para activarlo.
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 text-center px-2">
                    💡 Puedes arrastrar con el mouse o deslizar con el dedo en móviles para probar el Swipe.
                  </p>
                </div>

                {/* ── COLUMNA DERECHA: GESTIÓN DE IMÁGENES Y TEXTOS ── */}
                <div className="lg:col-span-7 space-y-4">
                  
                  {/* Bloque 1: Galería de Imágenes del Carrusel (Hasta 5) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          1. Imágenes del Carrusel ({bannerImageUrls.length}/5)
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {5 - bannerImageUrls.length} disponibles
                      </span>
                    </div>

                    {/* Strip de Miniaturas Cargadas */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {bannerImageUrls.map((imgSrc, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-[16/9] flex items-center justify-center"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgSrc}
                            alt={`Miniatura ${idx + 1}`}
                            className="w-full h-full object-contain p-1"
                          />

                          {/* Badge de Posición / Principal */}
                          <div className="absolute top-1.5 left-1.5">
                            {idx === 0 ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Principal
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-950/80 text-slate-300 backdrop-blur-xs">
                                #{idx + 1}
                              </span>
                            )}
                          </div>

                          {/* Acciones en Hover */}
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                            {idx !== 0 && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryImage(idx)}
                                className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold cursor-pointer"
                                title="Hacer principal"
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] cursor-pointer"
                              title="Eliminar imagen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Botón de Carga / Añadir si hay < 5 */}
                      {bannerImageUrls.length < 5 && (
                        <label
                          className={`border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors bg-slate-900/40 hover:bg-slate-900/80 aspect-[16/9] ${
                            isCompressingImage ? "opacity-60 pointer-events-none" : ""
                          }`}
                        >
                          {isCompressingImage ? (
                            <Loader2 className="w-5 h-5 text-amber-400 mb-1 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5 text-amber-400 mb-1" />
                          )}
                          <span className="text-[11px] font-bold text-slate-200">
                            {isCompressingImage ? "Comprimiendo..." : "Añadir Foto(s)"}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            Canvas 1080px (WebP)
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isCompressingImage}
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* O ingresar URL directa */}
                    {bannerImageUrls.length < 5 && (
                      <div className="pt-2 border-t border-slate-700/60 flex gap-2">
                        <input
                          type="text"
                          value={newImageUrlInput}
                          onChange={(e) => setNewImageUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddImageUrl();
                            }
                          }}
                          placeholder="O pega una URL directa de imagen (https://...)"
                          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          disabled={!newImageUrlInput.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 disabled:opacity-40 cursor-pointer border border-slate-700"
                        >
                          Añadir
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bloque 2: Textos de la Oferta */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        2. Textos de la Oferta
                      </h4>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Título Principal
                      </label>
                      <input
                        type="text"
                        value={bannerTitulo}
                        onChange={(e) => setBannerTitulo(e.target.value)}
                        placeholder="Ej. ¡Pásate a Fibra Óptica con Instalación Gratis!"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Descripción o Condiciones
                      </label>
                      <textarea
                        rows={2}
                        value={bannerDescripcion}
                        onChange={(e) => setBannerDescripcion(e.target.value)}
                        placeholder="Describe los beneficios del plan o promoción..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                      />
                    </div>
                  </div>

                  {/* Bloque 3: Acción de WhatsApp */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        3. Acción de WhatsApp
                      </h4>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Texto del Botón
                      </label>
                      <input
                        type="text"
                        value={bannerBotonTexto}
                        onChange={(e) => setBannerBotonTexto(e.target.value)}
                        placeholder="📲 Preguntar por WhatsApp"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Mensaje Predeterminado que Enviará el Cliente
                      </label>
                      <textarea
                        rows={2}
                        value={bannerWhatsappMensaje}
                        onChange={(e) => setBannerWhatsappMensaje(e.target.value)}
                        placeholder="Mensaje prellenado para WhatsApp..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                      />
                    </div>
                  </div>

                  {/* Botón Guardar Cambios Destacado */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={isSavingBanner}
                      onClick={handleSaveBanner}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3 rounded-2xl text-xs font-bold bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-slate-950 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                    >
                      {isSavingBanner ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando en el Servidor...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                          <span>Guardar y Publicar Carrusel</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: PROMOCIONES EN CARRUSEL                          */}
          {/* ======================================================== */}
          {activeTab === "promos" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-base">Promociones en Carrusel</h3>
                  <p className="text-xs text-slate-400">
                    Se muestran dinámicamente sobre la tarjeta de balance de los usuarios autenticados
                  </p>
                </div>
                {!isAddingPromo && (
                  <button
                    type="button"
                    onClick={() => setIsAddingPromo(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-500/20 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Promoción
                  </button>
                )}
              </div>

              {/* Formulario de Nueva Promo */}
              {isAddingPromo && (
                <form
                  onSubmit={handleAddPromoSubmit}
                  className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                    <span className="font-bold text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Crear Nueva Promoción
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingPromo(false)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Etiqueta (Badge)
                      </label>
                      <input
                        type="text"
                        value={newPromo.tag}
                        onChange={(e) => setNewPromo({ ...newPromo, tag: e.target.value })}
                        placeholder="Ej: 🔥 Oferta Especial"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Texto del Botón
                      </label>
                      <input
                        type="text"
                        value={newPromo.botonTexto}
                        onChange={(e) => setNewPromo({ ...newPromo, botonTexto: e.target.value })}
                        placeholder="Ej: Pedir Upgrade"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Título Llamativo
                    </label>
                    <input
                      type="text"
                      required
                      value={newPromo.titulo}
                      onChange={(e) => setNewPromo({ ...newPromo, titulo: e.target.value })}
                      placeholder="Ej: Pásate a 100 Megas simétricas por solo $10.000 más"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Descripción
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={newPromo.descripcion}
                      onChange={(e) => setNewPromo({ ...newPromo, descripcion: e.target.value })}
                      placeholder="Detalles y condiciones de la oferta..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Mensaje para WhatsApp
                      </label>
                      <input
                        type="text"
                        value={newPromo.whatsappMensaje}
                        onChange={(e) => setNewPromo({ ...newPromo, whatsappMensaje: e.target.value })}
                        placeholder="Mensaje al tocar el botón..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        URL de Imagen (Opcional)
                      </label>
                      <input
                        type="url"
                        value={newPromo.imagenUrl || ""}
                        onChange={(e) => setNewPromo({ ...newPromo, imagenUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingPromo(false)}
                      className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      Añadir al Carrusel
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de Promociones en Grid de 2 Columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      promo.activo
                        ? "bg-slate-800/60 border-slate-700 shadow-md"
                        : "bg-slate-900/40 border-slate-800 opacity-60"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700/80 text-amber-300">
                          {promo.tag}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            promo.activo
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {promo.activo ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      <h4 className="font-bold text-white text-sm line-clamp-1">{promo.titulo}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2">{promo.descripcion}</p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => togglePromotion(promo.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          promo.activo
                            ? "bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/40"
                            : "bg-slate-700 text-slate-400 hover:text-white"
                        }`}
                      >
                        {promo.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deletePromotion(promo.id);
                          toast.info("Promoción eliminada.");
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Eliminar promoción"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: INFORMACIÓN COMERCIAL                            */}
          {/* ======================================================== */}
          {activeTab === "comercial" && (
            <div className="space-y-6">
              <div className="pb-3 border-b border-slate-800">
                <h3 className="font-bold text-white text-base">Datos Comerciales y Canales de Pago</h3>
                <p className="text-xs text-slate-400">
                  Modifica los números y nombres que se muestran a los abonados en todo el portal
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Nombre Visible de la Empresa
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      WhatsApp de Soporte y Cobranzas
                    </label>
                    <input
                      type="text"
                      value={supportPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      placeholder="3185577157"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-pink-400" />
                      Número Nequi / Llave Bre-B
                    </label>
                    <input
                      type="text"
                      value={nequiNumber}
                      onChange={(e) => setNequiNumber(e.target.value)}
                      placeholder="311 276 0959"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Titular de la Cuenta Nequi
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Orlando Aponte"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700/60 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveCompany}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Check className="w-4 h-4" />
                    Guardar Datos Comerciales
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: AVISO GLOBAL / MANTENIMIENTO                     */}
          {/* ======================================================== */}
          {activeTab === "alerta" && (
            <div className="space-y-6">
              <div className="pb-3 border-b border-slate-800">
                <h3 className="font-bold text-white text-base">Banner de Aviso Global</h3>
                <p className="text-xs text-slate-400">
                  Publica un aviso urgente en la cabecera del portal (cortes de fibra, mantenimientos o novedades)
                </p>
              </div>

              {/* Vista Previa del Aviso */}
              {alertEnabled && (
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in ${
                    alertType === "warning"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                      : "bg-sky-500/15 border-sky-500/30 text-sky-200"
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5">
                      Vista previa del banner superior:
                    </p>
                    <p className="text-xs leading-relaxed">
                      {alertMessage || "Mensaje del aviso..."}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-5">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-700">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Estado del Banner de Alerta
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {alertEnabled ? "Visible en la parte superior del portal para todos" : "Desactivado"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlertEnabled(!alertEnabled)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      alertEnabled
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {alertEnabled ? "Activado" : "Desactivado"}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Tipo de Aviso
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAlertType("warning")}
                      className={`flex-1 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        alertType === "warning"
                          ? "bg-amber-500/20 border-amber-500 text-amber-300"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      ⚠️ Advertencia / Mantenimiento
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlertType("info")}
                      className={`flex-1 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        alertType === "info"
                          ? "bg-sky-500/20 border-sky-500 text-sky-300"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      ℹ️ Informativo / Noticia
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Mensaje del Aviso
                  </label>
                  <textarea
                    rows={3}
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="Ej: Mantenimiento preventivo en red de fibra óptica este jueves de 2:00 AM a 4:00 AM..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="pt-3 border-t border-slate-700/60 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveAlert}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Check className="w-4 h-4" />
                    Guardar Aviso
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ─── FOOTER STICKY ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-3.5 border-t border-slate-800/90 bg-slate-950/80 text-xs">
          <button
            type="button"
            onClick={async () => {
              if (confirm("¿Deseas restablecer toda la configuración en el servidor a los valores por defecto?")) {
                await resetToDefaults();
                toast.info("Configuración del servidor restablecida.");
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Valores Iniciales</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold bg-white text-slate-950 hover:bg-slate-200 transition-all cursor-pointer shadow-sm"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
