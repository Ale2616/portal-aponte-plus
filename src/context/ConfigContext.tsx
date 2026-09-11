"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  PortalConfig,
  CompanyInfo,
  PromotionItem,
  GlobalAlert,
  HomeAdBanner,
  DEFAULT_CONFIG,
} from "@/types/config";
import { isDefaultImageList } from "@/lib/image-compression";

export type { PortalConfig, CompanyInfo, PromotionItem, GlobalAlert, HomeAdBanner };

interface ConfigContextType {
  config: PortalConfig;
  isLoading: boolean;
  updateCompanyInfo: (info: Partial<CompanyInfo>) => Promise<void>;
  addPromotion: (promo: Omit<PromotionItem, "id">) => Promise<void>;
  updatePromotion: (id: string, promo: Partial<PromotionItem>) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  togglePromotion: (id: string) => Promise<void>;
  updateGlobalAlert: (alert: Partial<GlobalAlert>) => Promise<void>;
  updateHomeAdBanner: (banner: Partial<HomeAdBanner>) => Promise<boolean>;
  saveAllConfig: (newConfig: PortalConfig) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  setLocalConfig: (newConfig: PortalConfig) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PortalConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("portal_admin_banner_images_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0 && !isDefaultImageList(parsed)) {
            return {
              ...DEFAULT_CONFIG,
              homeAdBanner: {
                ...DEFAULT_CONFIG.homeAdBanner,
                imageUrl: parsed[0],
                imageUrls: parsed,
              },
            };
          }
        }
      } catch {}
    }
    return DEFAULT_CONFIG;
  });
  const [isLoading, setIsLoading] = useState(true);

  // ─── Carga de Configuración Global desde el Servidor (SIN localStorage) ───────
  const fetchServerConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/configuracion", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setConfig((prev) => {
            const prevImgs = prev.homeAdBanner?.imageUrls || [];
            const serverImgs = data.config.homeAdBanner?.imageUrls || [];

            // Si el estado cliente actual ya tiene imágenes personalizadas cargadas
            // y la respuesta del servidor devuelve las 3 imágenes demo por defecto, preservar las personalizadas
            if (prevImgs.length > 0 && !isDefaultImageList(prevImgs) && isDefaultImageList(serverImgs)) {
              return {
                ...data.config,
                homeAdBanner: {
                  ...data.config.homeAdBanner,
                  imageUrl: prevImgs[0],
                  imageUrls: prevImgs,
                },
              };
            }
            return data.config;
          });
        }
      }
    } catch (err) {
      console.warn("[ConfigContext] Error al cargar configuración global del servidor:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Inicializar al montar
  useEffect(() => {
    fetchServerConfig();

    // Revalidación periódica cada 20 segundos para reflejar cambios en tiempo real a todos los clientes
    const interval = setInterval(fetchServerConfig, 20000);

    // Revalidar cuando la pestaña vuelve a enfocarse
    const onFocus = () => fetchServerConfig();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchServerConfig]);

  // ─── Persistencia Global en Servidor ──────────────────────────────────────────
  const persistToServer = async (updated: PortalConfig): Promise<boolean> => {
    setConfig(updated); // Actualización optimista

    try {
      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin: "1130",
          config: updated,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar la configuración en el servidor");
      }

      if (data.config) {
        setConfig(data.config);
      }
      return true;
    } catch (err: any) {
      console.error("[ConfigContext] Error al guardar en servidor:", err);
      toast.error("Error al sincronizar con el servidor", {
        description: err.message,
      });
      // Importante: No sobreescribir inmediatamente el estado local del usuario con fetchServerConfig()
      return false;
    }
  };

  const updateCompanyInfo = async (info: Partial<CompanyInfo>) => {
    const updated: PortalConfig = {
      ...config,
      companyInfo: {
        ...config.companyInfo,
        ...info,
      },
    };
    await persistToServer(updated);
  };

  const addPromotion = async (promo: Omit<PromotionItem, "id">) => {
    const newPromo: PromotionItem = {
      ...promo,
      id: `promo_${Date.now()}`,
    };
    const updated: PortalConfig = {
      ...config,
      promotions: [newPromo, ...config.promotions],
    };
    await persistToServer(updated);
  };

  const updatePromotion = async (id: string, promo: Partial<PromotionItem>) => {
    const updated: PortalConfig = {
      ...config,
      promotions: config.promotions.map((p) => (p.id === id ? { ...p, ...promo } : p)),
    };
    await persistToServer(updated);
  };

  const deletePromotion = async (id: string) => {
    const updated: PortalConfig = {
      ...config,
      promotions: config.promotions.filter((p) => p.id !== id),
    };
    await persistToServer(updated);
  };

  const togglePromotion = async (id: string) => {
    const updated: PortalConfig = {
      ...config,
      promotions: config.promotions.map((p) =>
        p.id === id ? { ...p, activo: !p.activo } : p
      ),
    };
    await persistToServer(updated);
  };

  const updateGlobalAlert = async (alert: Partial<GlobalAlert>) => {
    const updated: PortalConfig = {
      ...config,
      globalAlert: {
        ...config.globalAlert,
        ...alert,
      },
    };
    await persistToServer(updated);
  };

  const updateHomeAdBanner = async (banner: Partial<HomeAdBanner>): Promise<boolean> => {
    const updated: PortalConfig = {
      ...config,
      homeAdBanner: {
        ...config.homeAdBanner,
        ...banner,
      },
    };
    return await persistToServer(updated);
  };

  const setLocalConfig = (newConfig: PortalConfig) => {
    setConfig(newConfig);
  };

  const saveAllConfig = async (newConfig: PortalConfig) => {
    await persistToServer(newConfig);
  };

  const resetToDefaults = async () => {
    await persistToServer(DEFAULT_CONFIG);
  };

  return (
    <ConfigContext.Provider
      value={{
        config,
        isLoading,
        updateCompanyInfo,
        addPromotion,
        updatePromotion,
        deletePromotion,
        togglePromotion,
        updateGlobalAlert,
        updateHomeAdBanner,
        saveAllConfig,
        resetToDefaults,
        refreshConfig: fetchServerConfig,
        setLocalConfig,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig debe usarse dentro de un ConfigProvider");
  }
  return context;
}
