"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface PromotionItem {
  id: string;
  tag: string;
  titulo: string;
  descripcion: string;
  botonTexto: string;
  whatsappMensaje: string;
  gradiente: string;
  icono: string;
  imagenUrl?: string;
  activo: boolean;
}

export interface CompanyInfo {
  companyName: string;
  legalName: string;
  supportPhone: string;
  supportPhoneFormatted: string;
  nequiNumber: string;
  accountHolder: string;
}

export interface GlobalAlert {
  enabled: boolean;
  message: string;
  type: "warning" | "info";
}

export interface HomeAdBanner {
  enabled: boolean;
  imageUrl: string;
  titulo: string;
  descripcion: string;
  botonTexto: string;
  whatsappMensaje: string;
}

export interface PortalConfig {
  companyInfo: CompanyInfo;
  promotions: PromotionItem[];
  globalAlert: GlobalAlert;
  homeAdBanner: HomeAdBanner;
}

const DEFAULT_CONFIG: PortalConfig = {
  companyInfo: {
    companyName: "Internet Aponte Plus",
    legalName: "Internet Aponte Plus S.A.S.",
    supportPhone: "3185577157",
    supportPhoneFormatted: "318 557 7157",
    nequiNumber: "311 276 0959",
    accountHolder: "Orlando Aponte / Aponte Plus",
  },
  // Promociones específicas (se eliminaron promociones genéricas de fidelidad)
  promotions: [
    {
      id: "promo-100m",
      tag: "🔥 Plan Recomendado",
      titulo: "Pásate a 100 Megas simétricas por solo $10.000 más",
      descripcion: "Disfruta de máxima velocidad para streaming en 4K, teletrabajo y juegos en línea sin lag con fibra óptica dedicada.",
      botonTexto: "Pedir Upgrade",
      whatsappMensaje: "Hola, soy cliente de Internet Aponte Plus y me interesa la promoción para pasarme a 100 Megas simétricas por $10.000 más.",
      gradiente: "from-blue-600 via-indigo-600 to-violet-700",
      icono: "Zap",
      imagenUrl: "",
      activo: true,
    },
    {
      id: "promo-referidos",
      tag: "🎁 Plan Amigos",
      titulo: "Recomienda a un vecino y recibe 50% de descuento en tu próxima factura",
      descripcion: "Comparte la mejor conexión de la región. Cuando tu referido instale el servicio, ambos reciben un beneficio especial en su mensualidad.",
      botonTexto: "Referir un Vecino",
      whatsappMensaje: "Hola, quiero referir a un vecino en Internet Aponte Plus para aprovechar la promoción del 50% de descuento.",
      gradiente: "from-emerald-600 via-teal-600 to-cyan-700",
      icono: "Users",
      imagenUrl: "",
      activo: true,
    },
  ],
  globalAlert: {
    enabled: false,
    message: "Aviso de servicio: Mantenimiento preventivo en red de fibra óptica este jueves de 2:00 AM a 4:00 AM.",
    type: "warning",
  },
  homeAdBanner: {
    enabled: true,
    imageUrl: "/banner-promo-fibra.jpg",
    titulo: "¡Pásate a Fibra Óptica con Alta Velocidad!",
    descripcion: "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada y ultra velocidad.",
    botonTexto: "📲 Preguntar por WhatsApp",
    whatsappMensaje: "Hola, vi la promoción en el portal y deseo más información sobre el servicio de internet",
  },
};

const STORAGE_KEY = "aponte_plus_portal_config";

interface ConfigContextType {
  config: PortalConfig;
  updateCompanyInfo: (info: Partial<CompanyInfo>) => void;
  addPromotion: (promo: Omit<PromotionItem, "id">) => void;
  updatePromotion: (id: string, promo: Partial<PromotionItem>) => void;
  deletePromotion: (id: string) => void;
  togglePromotion: (id: string) => void;
  updateGlobalAlert: (alert: Partial<GlobalAlert>) => void;
  updateHomeAdBanner: (banner: Partial<HomeAdBanner>) => void;
  saveAllConfig: (newConfig: PortalConfig) => void;
  resetToDefaults: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PortalConfig>(DEFAULT_CONFIG);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Mezclar con defaults para asegurar que no falten propiedades nuevas
        setConfig({
          companyInfo: { ...DEFAULT_CONFIG.companyInfo, ...(parsed.companyInfo || {}) },
          promotions: Array.isArray(parsed.promotions) && parsed.promotions.length > 0
            ? parsed.promotions
            : DEFAULT_CONFIG.promotions,
          globalAlert: { ...DEFAULT_CONFIG.globalAlert, ...(parsed.globalAlert || {}) },
          homeAdBanner: { ...DEFAULT_CONFIG.homeAdBanner, ...(parsed.homeAdBanner || {}) },
        });
      }
    } catch (err) {
      console.warn("[ConfigContext] Error al leer configuración local:", err);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const persist = (updated: PortalConfig) => {
    setConfig(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("[ConfigContext] Error al guardar configuración local:", err);
    }
  };

  const updateCompanyInfo = (info: Partial<CompanyInfo>) => {
    const updated = {
      ...config,
      companyInfo: {
        ...config.companyInfo,
        ...info,
      },
    };
    persist(updated);
  };

  const addPromotion = (promo: Omit<PromotionItem, "id">) => {
    const newPromo: PromotionItem = {
      ...promo,
      id: `promo_${Date.now()}`,
    };
    const updated = {
      ...config,
      promotions: [newPromo, ...config.promotions],
    };
    persist(updated);
  };

  const updatePromotion = (id: string, promo: Partial<PromotionItem>) => {
    const updated = {
      ...config,
      promotions: config.promotions.map((p) => (p.id === id ? { ...p, ...promo } : p)),
    };
    persist(updated);
  };

  const deletePromotion = (id: string) => {
    const updated = {
      ...config,
      promotions: config.promotions.filter((p) => p.id !== id),
    };
    persist(updated);
  };

  const togglePromotion = (id: string) => {
    const updated = {
      ...config,
      promotions: config.promotions.map((p) => (p.id === id ? { ...p, activo: !p.activo } : p)),
    };
    persist(updated);
  };

  const updateGlobalAlert = (alert: Partial<GlobalAlert>) => {
    const updated = {
      ...config,
      globalAlert: {
        ...config.globalAlert,
        ...alert,
      },
    };
    persist(updated);
  };

  const updateHomeAdBanner = (banner: Partial<HomeAdBanner>) => {
    const updated = {
      ...config,
      homeAdBanner: {
        ...config.homeAdBanner,
        ...banner,
      },
    };
    persist(updated);
  };

  const saveAllConfig = (newConfig: PortalConfig) => {
    persist(newConfig);
  };

  const resetToDefaults = () => {
    persist(DEFAULT_CONFIG);
  };

  return (
    <ConfigContext.Provider
      value={{
        config,
        updateCompanyInfo,
        addPromotion,
        updatePromotion,
        deletePromotion,
        togglePromotion,
        updateGlobalAlert,
        updateHomeAdBanner,
        saveAllConfig,
        resetToDefaults,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig debe usarse dentro de un ConfigProvider");
  }
  return context;
}
