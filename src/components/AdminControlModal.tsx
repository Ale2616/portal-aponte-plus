"use client";

import { useState, useEffect } from "react";
import { useConfig, PromotionItem } from "@/context/ConfigContext";
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
  ExternalLink,
  MessageCircle,
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
    updatePromotion,
    deletePromotion,
    togglePromotion,
    updateGlobalAlert,
    updateHomeAdBanner,
    resetToDefaults,
  } = useConfig();

  const [activeTab, setActiveTab] = useState<"promos" | "banner" | "comercial" | "alerta">("promos");

  // Estados locales para edición de Info Comercial
  const [companyName, setCompanyName] = useState(config.companyInfo.companyName);
  const [supportPhone, setSupportPhone] = useState(config.companyInfo.supportPhone);
  const [nequiNumber, setNequiNumber] = useState(config.companyInfo.nequiNumber);
  const [accountHolder, setAccountHolder] = useState(config.companyInfo.accountHolder);

  // Estados locales para Aviso Global
  const [alertEnabled, setAlertEnabled] = useState(config.globalAlert.enabled);
  const [alertMessage, setAlertMessage] = useState(config.globalAlert.message);
  const [alertType, setAlertType] = useState<"warning" | "info">(config.globalAlert.type);

  // Estados locales para Banner Publicitario de Inicio
  const [bannerEnabled, setBannerEnabled] = useState(config.homeAdBanner?.enabled ?? true);
  const [bannerImageUrl, setBannerImageUrl] = useState(config.homeAdBanner?.imageUrl ?? "/banner-promo-fibra.jpg");
  const [bannerTitulo, setBannerTitulo] = useState(config.homeAdBanner?.titulo ?? "¡Pásate a Fibra Óptica con Alta Velocidad!");
  const [bannerDescripcion, setBannerDescripcion] = useState(
    config.homeAdBanner?.descripcion ?? "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada."
  );
  const [bannerBotonTexto, setBannerBotonTexto] = useState(config.homeAdBanner?.botonTexto ?? "📲 Preguntar por WhatsApp");
  const [bannerWhatsappMensaje, setBannerWhatsappMensaje] = useState(
    config.homeAdBanner?.whatsappMensaje ??
      "Hola, vi la promoción en el portal y deseo más información sobre el servicio de internet"
  );

  // Sincronizar estados locales cuando config cambia o se abre el modal
  useEffect(() => {
    if (isOpen) {
      setCompanyName(config.companyInfo.companyName);
      setSupportPhone(config.companyInfo.supportPhone);
      setNequiNumber(config.companyInfo.nequiNumber);
      setAccountHolder(config.companyInfo.accountHolder);
      setAlertEnabled(config.globalAlert.enabled);
      setAlertMessage(config.globalAlert.message);
      setAlertType(config.globalAlert.type);

      if (config.homeAdBanner) {
        setBannerEnabled(config.homeAdBanner.enabled);
        setBannerImageUrl(config.homeAdBanner.imageUrl);
        setBannerTitulo(config.homeAdBanner.titulo);
        setBannerDescripcion(config.homeAdBanner.descripcion);
        setBannerBotonTexto(config.homeAdBanner.botonTexto);
        setBannerWhatsappMensaje(config.homeAdBanner.whatsappMensaje);
      }
    }
  }, [isOpen, config]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setBannerImageUrl(base64);
      toast.success("Imagen cargada con éxito en vista previa.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBanner = () => {
    updateHomeAdBanner({
      enabled: bannerEnabled,
      imageUrl: bannerImageUrl.trim() || "/banner-promo-fibra.jpg",
      titulo: bannerTitulo.trim() || "¡Pásate a Fibra Óptica con Alta Velocidad!",
      descripcion:
        bannerDescripcion.trim() ||
        "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada.",
      botonTexto: bannerBotonTexto.trim() || "📲 Preguntar por WhatsApp",
      whatsappMensaje:
        bannerWhatsappMensaje.trim() ||
        "Hola, vi la promoción en el portal y deseo más información sobre el servicio de internet",
    });
    toast.success("Banner publicitario de inicio actualizado.");
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

  if (!isOpen) return null;

  const handleSaveCompany = () => {
    updateCompanyInfo({
      companyName: companyName.trim() || "Internet Aponte Plus",
      supportPhone: supportPhone.trim() || "3185577157",
      nequiNumber: nequiNumber.trim() || "311 276 0959",
      accountHolder: accountHolder.trim() || "Orlando Aponte",
    });
    toast.success("Información comercial actualizada correctamente.");
  };

  const handleSaveAlert = () => {
    updateGlobalAlert({
      enabled: alertEnabled,
      message: alertMessage.trim() || "Aviso de mantenimiento programado.",
      type: alertType,
    });
    toast.success(
      alertEnabled
        ? "Aviso de mantenimiento publicado en todo el portal."
        : "Aviso de mantenimiento desactivado."
    );
  };

  const handleAddPromoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.titulo.trim() || !newPromo.descripcion.trim()) {
      toast.error("El título y la descripción son obligatorios.");
      return;
    }
    addPromotion(newPromo);
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
    toast.success("Nueva promoción añadida al carrusel.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Panel de Control Interno</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold tracking-tight tabular-nums bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  PIN 1130
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Administración en vivo sin tocar código de Aponte Plus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-900/60 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab("promos")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "promos"
                ? "border-amber-400 text-amber-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Promociones ({config.promotions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("banner")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "banner"
                ? "border-amber-400 text-amber-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Banner de Inicio</span>
            {config.homeAdBanner?.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("comercial")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "comercial"
                ? "border-amber-400 text-amber-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Información Comercial</span>
          </button>

          <button
            onClick={() => setActiveTab("alerta")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "alerta"
                ? "border-amber-400 text-amber-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Aviso Global / Mantenimiento</span>
            {config.globalAlert.enabled && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* ======================================================== */}
          {/* TAB 1: PROMOCIONES Y BANNERS                            */}
          {/* ======================================================== */}
          {activeTab === "promos" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">Promociones en Carrusel</h3>
                  <p className="text-xs text-slate-400">
                    Activa, desactiva o añade promociones visibles arriba del balance
                  </p>
                </div>
                {!isAddingPromo && (
                  <button
                    type="button"
                    onClick={() => setIsAddingPromo(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer"
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
                  className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="font-bold text-amber-400 text-xs uppercase tracking-wider">
                      Crear Nueva Promoción
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingPromo(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Etiqueta (Badge)
                      </label>
                      <input
                        type="text"
                        value={newPromo.tag}
                        onChange={(e) => setNewPromo({ ...newPromo, tag: e.target.value })}
                        placeholder="Ej: 🔥 Oferta Especial"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
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
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
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
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
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
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Mensaje Prellenado para WhatsApp
                    </label>
                    <input
                      type="text"
                      value={newPromo.whatsappMensaje}
                      onChange={(e) => setNewPromo({ ...newPromo, whatsappMensaje: e.target.value })}
                      placeholder="Mensaje que enviará el abonado al hacer clic..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      URL de Imagen / Banner (Opcional)
                    </label>
                    <input
                      type="url"
                      value={newPromo.imagenUrl || ""}
                      onChange={(e) => setNewPromo({ ...newPromo, imagenUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingPromo(false)}
                      className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
                    >
                      Guardar Promoción
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de Promociones Actuales */}
              <div className="space-y-3">
                {config.promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      promo.activo
                        ? "bg-slate-800/60 border-slate-700"
                        : "bg-slate-900/50 border-slate-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">
                            {promo.tag}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              promo.activo
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {promo.activo ? "Visible" : "Oculta"}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm">{promo.titulo}</h4>
                        <p className="text-xs text-slate-400">{promo.descripcion}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => togglePromotion(promo.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
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
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Eliminar promoción"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: BANNER PUBLICITARIO DE INICIO                    */}
          {/* ======================================================== */}
          {activeTab === "banner" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-base">Banner Publicitario de Inicio</h3>
                  <p className="text-xs text-slate-400">
                    Configura la oferta visual que verán los usuarios en la pantalla de ingreso
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {bannerEnabled ? "Visible en Inicio" : "Oculto"}
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

              {/* Vista Previa de la Imagen */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Vista Previa del Banner Adaptativo
                </label>
                <div className="w-full max-w-md mx-auto overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/60 shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bannerImageUrl || "/banner-promo-fibra.jpg"}
                    alt="Vista previa"
                    className="w-full h-auto object-contain block rounded-t-2xl transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/banner-promo-fibra.jpg";
                    }}
                  />
                  <div className="p-4 bg-slate-900/90 border-t border-cyan-500/10 space-y-2">
                    <p className="text-sm font-bold text-white leading-snug">{bannerTitulo || "¡Pásate a Fibra Óptica con Alta Velocidad!"}</p>
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{bannerDescripcion || "Descripción breve"}</p>
                    <div className="pt-1">
                      <div className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 text-white flex items-center justify-center gap-2">
                        <MessageCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{bannerBotonTexto || "📲 Preguntar por WhatsApp"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campos de Configuración */}
              <div className="space-y-4">
                {/* 1. URL Directa de Imagen */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    URL Directa de la Imagen (Imgur, Postimages, Canva o Servidor)
                  </label>
                  <input
                    type="text"
                    value={bannerImageUrl}
                    onChange={(e) => setBannerImageUrl(e.target.value)}
                    placeholder="https://i.imgur.com/ejemplo.jpg o /banner-promo-fibra.jpg"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs font-sans font-medium tracking-tight focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 2. Subir Archivo Local */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    O Cargar Imagen desde tu Equipo (Convierte a Base64)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Formatos recomendados: PNG, JPG o WebP en cualquier proporción (panorámica horizontal, volante vertical o cuadrada 1:1) sin recortes.
                  </p>
                </div>

                {/* 3. Título de la Promo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Título de la Promoción
                  </label>
                  <input
                    type="text"
                    value={bannerTitulo}
                    onChange={(e) => setBannerTitulo(e.target.value)}
                    placeholder="Ej. ¡Pásate a Fibra Óptica con 50% de Descuento!"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
                  />
                </div>

                {/* 4. Descripción Breve */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Descripción Breve de la Oferta
                  </label>
                  <textarea
                    rows={2}
                    value={bannerDescripcion}
                    onChange={(e) => setBannerDescripcion(e.target.value)}
                    placeholder="Describe los beneficios del plan o servicio..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 5. Texto del Botón */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Texto del Botón de Acción
                  </label>
                  <input
                    type="text"
                    value={bannerBotonTexto}
                    onChange={(e) => setBannerBotonTexto(e.target.value)}
                    placeholder="Ej. Me interesa esta oferta"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 6. Mensaje de WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Mensaje Predeterminado para WhatsApp (318 557 7157)
                  </label>
                  <textarea
                    rows={2}
                    value={bannerWhatsappMensaje}
                    onChange={(e) => setBannerWhatsappMensaje(e.target.value)}
                    placeholder="Mensaje que enviará el cliente al tocar el botón..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Botón Guardar Cambios */}
              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveBanner}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios del Banner</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: INFORMACIÓN COMERCIAL                            */}
          {/* ======================================================== */}
          {activeTab === "comercial" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">Datos Comerciales y Canales</h3>
                <p className="text-xs text-slate-400">
                  Modifica los números y nombres que se muestran a los abonados en todo el portal
                </p>
              </div>

              <div className="space-y-3.5 bg-slate-800/40 p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nombre Visible de la Empresa
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Número de WhatsApp para Soporte (sin espacios ni símbolos)
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="3185577157"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-sans font-semibold tracking-tight tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Número de Cuenta Nequi / Bre-B para Pagos
                  </label>
                  <input
                    type="text"
                    value={nequiNumber}
                    onChange={(e) => setNequiNumber(e.target.value)}
                    placeholder="311 276 0959"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-sans font-semibold tracking-tight tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Titular de la Cuenta
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Orlando Aponte"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveCompany}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Check className="w-4 h-4" />
                    Guardar Datos Comerciales
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: AVISO GLOBAL / MANTENIMIENTO                     */}
          {/* ======================================================== */}
          {activeTab === "alerta" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-base">Banner de Aviso Global</h3>
                <p className="text-xs text-slate-400">
                  Publica un aviso urgente en la cabecera para todos los abonados (cortes de fibra, mantenimientos)
                </p>
              </div>

              <div className="space-y-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Estado del Banner de Alerta
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {alertEnabled ? "Visible en la parte superior del portal" : "Desactivado"}
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
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Tipo de Aviso
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAlertType("warning")}
                      className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
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
                      className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
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
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Mensaje del Aviso
                  </label>
                  <textarea
                    rows={3}
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="Ej: Mantenimiento preventivo en red de fibra óptica este jueves de 2:00 AM a 4:00 AM..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveAlert}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Check className="w-4 h-4" />
                    Guardar Aviso
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 text-xs">
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Deseas restablecer toda la configuración a los valores por defecto?")) {
                resetToDefaults();
                toast.info("Configuración restablecida.");
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer Valores Iniciales
          </button>

          <button
            type="button"
            onClick={() => {
              handleSaveCompany();
              handleSaveAlert();
              onClose();
            }}
            className="px-5 py-2 rounded-xl font-bold bg-white text-slate-950 hover:bg-slate-100 transition-all cursor-pointer"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
}
