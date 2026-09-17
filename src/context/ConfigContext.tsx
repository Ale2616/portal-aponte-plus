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
  GlobalSettings,
  DEFAULT_GLOBAL_SETTINGS,
} from "@/types/config";
import { isDefaultImageList } from "@/lib/image-compression";

export type { PortalConfig, CompanyInfo, PromotionItem, GlobalAlert, HomeAdBanner, GlobalSettings };

interface ConfigContextType {
  config: PortalConfig;
  globalSettings: GlobalSettings;
  isLoading: boolean;
  updateCompanyInfo: (info: Partial<CompanyInfo>) => Promise<void>;
  addPromotion: (promo: Omit<PromotionItem, "id">) => Promise<void>;
  updatePromotion: (id: string, promo: Partial<PromotionItem>) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  togglePromotion: (id: string) => Promise<void>;
  updateGlobalAlert: (alert: Partial<GlobalAlert>) => Promise<void>;
  updateHomeAdBanner: (banner: Partial<HomeAdBanner>) => Promise<boolean>;
  saveAllConfig: (newConfig: PortalConfig) => Promise<void>;
  saveGlobalSettings: (newSettings: GlobalSettings) => Promise<boolean>;
  resetToDefaults: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  setLocalConfig: (newConfig: PortalConfig) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PortalConfig>(DEFAULT_CONFIG);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Carga de Configuración Global desde /api/config (SIN localStorage) ───────
  const fetchServerConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/config?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const rawSettings: GlobalSettings = {
            titular: (data.titular || data.settings?.titular || DEFAULT_GLOBAL_SETTINGS.titular).trim(),
            canalesPago: {
              nequi: (data.canalesPago?.nequi || data.settings?.canalesPago?.nequi || DEFAULT_GLOBAL_SETTINGS.canalesPago.nequi).trim(),
              bancolombia: (data.canalesPago?.bancolombia || data.settings?.canalesPago?.bancolombia || DEFAULT_GLOBAL_SETTINGS.canalesPago.bancolombia).trim(),
              breB: (data.canalesPago?.breB || data.settings?.canalesPago?.breB || DEFAULT_GLOBAL_SETTINGS.canalesPago.breB).trim(),
            },
            banners: (
              Array.isArray(data.banners)
                ? data.banners
                : Array.isArray(data.settings?.banners)
                ? data.settings.banners
                : []
            ).filter(
              (b: any) =>
                b &&
                typeof b.url === "string" &&
                b.url.trim() !== "" &&
                !b.url.includes("banner1.webp") &&
                !b.url.includes("banner2.webp") &&
                !b.url.includes("banner3.webp")
            ),
            avisoGlobal: {
              activo: Boolean(data.avisoGlobal?.activo ?? data.settings?.avisoGlobal?.activo ?? false),
              texto: (data.avisoGlobal?.texto || data.settings?.avisoGlobal?.texto || DEFAULT_GLOBAL_SETTINGS.avisoGlobal.texto).trim(),
            },
          };

          setGlobalSettings(rawSettings);

          // Sincronizar PortalConfig compatible para el resto de la aplicación
          setConfig((prev) => {
            const activeBannerUrls = rawSettings.banners
              .filter((b) => b.active === true && b.url && b.url.trim() !== "")
              .map((b) => b.url);

            return {
              ...prev,
              companyInfo: {
                ...prev.companyInfo,
                accountHolder: rawSettings.titular,
                nequiNumber: rawSettings.canalesPago.nequi,
              },
              globalAlert: {
                ...prev.globalAlert,
                enabled: rawSettings.avisoGlobal.activo,
                message: rawSettings.avisoGlobal.texto,
              },
              homeAdBanner: {
                ...prev.homeAdBanner,
                enabled: activeBannerUrls.length > 0,
                imageUrl: activeBannerUrls[0] || "",
                imageUrls: activeBannerUrls,
              },
            };
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

    // Revalidación periódica cada 15 segundos para reflejar cambios en tiempo real a todos los clientes
    const interval = setInterval(fetchServerConfig, 15000);

    // Revalidar cuando la pestaña vuelve a enfocarse
    const onFocus = () => fetchServerConfig();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchServerConfig]);

  // ─── Guardado Centralizado en /api/config ──────────────────────────────────────
  const saveGlobalSettings = async (newSettings: GlobalSettings): Promise<boolean> => {
    // Actualización optimista inmediata
    setGlobalSettings(newSettings);
    const activeBannerUrls = newSettings.banners
      .filter((b) => b.active === true && b.url && b.url.trim() !== "")
      .map((b) => b.url);

    setConfig((prev) => ({
      ...prev,
      companyInfo: {
        ...prev.companyInfo,
        accountHolder: newSettings.titular,
        nequiNumber: newSettings.canalesPago.nequi,
      },
      globalAlert: {
        ...prev.globalAlert,
        enabled: newSettings.avisoGlobal.activo,
        message: newSettings.avisoGlobal.texto,
      },
      homeAdBanner: {
        ...prev.homeAdBanner,
        enabled: activeBannerUrls.length > 0,
        imageUrl: activeBannerUrls[0] || "",
        imageUrls: activeBannerUrls,
      },
    }));

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        body: JSON.stringify({
          pin: "1130",
          ...newSettings,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar la configuración");
      }

      await fetchServerConfig();
      return true;
    } catch (err: any) {
      console.error("[ConfigContext] Error al guardar en /api/config:", err);
      toast.error("Error al sincronizar con el servidor", {
        description: err.message,
      });
      return false;
    }
  };

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
        globalSettings,
        isLoading,
        updateCompanyInfo,
        addPromotion,
        updatePromotion,
        deletePromotion,
        togglePromotion,
        updateGlobalAlert,
        updateHomeAdBanner,
        saveAllConfig,
        saveGlobalSettings,
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
