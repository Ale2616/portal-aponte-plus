/**
 * Gestor de Persistencia Global del Servidor para Portal Aponte Plus
 *
 * Persistencia Indefinida:
 *  - Exclusivamente en Upstash Redis / Vercel KV REST API.
 *  - Sin variables en memoria global (cero desincronizaciones serverless).
 *  - Sin guardado en el sistema de archivos local (cero pérdida por efimeridad en Vercel).
 *  - Sin expiración (ttl/ex/px).
 */

import {
  PortalConfig,
  CompanyInfo,
  PromotionItem,
  GlobalAlert,
  HomeAdBanner,
  DEFAULT_CONFIG,
} from "@/types/config";
import { redisGet, redisSet } from "./redis";

export type { PortalConfig, CompanyInfo, PromotionItem, GlobalAlert, HomeAdBanner };
export { DEFAULT_CONFIG };

const CONFIG_KEY = "portal:global_config";
const BANNER_KEY = "banner_data";

/**
 * Obtiene la configuración global directamente desde Upstash Redis.
 * NUNCA sobreescribe con datos o imágenes demo si Upstash contiene datos válidos.
 * Solo usa DEFAULT_CONFIG si la base de datos está completamente vacía (null).
 */
export async function getGlobalPortalConfig(): Promise<PortalConfig> {
  try {
    // 1. Consultar configuración general y banner en Upstash Redis en paralelo
    const [redisConfig, redisBanner] = await Promise.all([
      redisGet<PortalConfig>(CONFIG_KEY),
      redisGet<HomeAdBanner>(BANNER_KEY),
    ]);

    // 2. Si existe configuración en Redis
    if (redisConfig && typeof redisConfig === "object") {
      const result: PortalConfig = {
        companyInfo: {
          ...DEFAULT_CONFIG.companyInfo,
          ...(redisConfig.companyInfo || {}),
        },
        promotions: Array.isArray(redisConfig.promotions)
          ? redisConfig.promotions
          : DEFAULT_CONFIG.promotions,
        globalAlert: {
          ...DEFAULT_CONFIG.globalAlert,
          ...(redisConfig.globalAlert || {}),
        },
        homeAdBanner: {
          ...DEFAULT_CONFIG.homeAdBanner,
          ...(redisConfig.homeAdBanner || {}),
        },
        actualizadoEn: redisConfig.actualizadoEn || new Date().toISOString(),
      };

      // Si existe clave 'banner_data' guardada directamente por el admin, priorizarla
      if (redisBanner && typeof redisBanner === "object") {
        result.homeAdBanner = {
          ...result.homeAdBanner,
          ...redisBanner,
        };
      }

      return result;
    }

    // 3. Si solo existe 'banner_data' en Redis
    if (redisBanner && typeof redisBanner === "object") {
      return {
        ...DEFAULT_CONFIG,
        homeAdBanner: {
          ...DEFAULT_CONFIG.homeAdBanner,
          ...redisBanner,
        },
        actualizadoEn: new Date().toISOString(),
      };
    }

    // 4. Base de datos vacía (null): Retornar configuración por defecto limpia
    return DEFAULT_CONFIG;
  } catch (err) {
    console.warn("[server-config] Error al leer configuración global desde Upstash Redis:", err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Guarda la configuración global en Upstash Redis con persistencia indefinida.
 * No utiliza memoria global ni fs.writeFile.
 */
export async function setGlobalPortalConfig(
  newConfig: Partial<PortalConfig>
): Promise<PortalConfig> {
  const current = await getGlobalPortalConfig();

  // Procesar banner si viene en la actualización
  const incomingBanner: Partial<HomeAdBanner> = newConfig.homeAdBanner ?? {};
  let finalImageUrls: string[] = [];

  if (Array.isArray(incomingBanner.imageUrls)) {
    finalImageUrls = incomingBanner.imageUrls.filter(Boolean).slice(0, 5);
  } else if (incomingBanner.imageUrl) {
    finalImageUrls = [incomingBanner.imageUrl];
  } else if (current.homeAdBanner?.imageUrls) {
    finalImageUrls = current.homeAdBanner.imageUrls.slice(0, 5);
  } else {
    finalImageUrls = [];
  }

  const isAutoDisabled = finalImageUrls.length === 0;
  const effectiveEnabled = isAutoDisabled
    ? false
    : incomingBanner.enabled !== undefined
    ? incomingBanner.enabled
    : current.homeAdBanner?.enabled ?? true;

  const updatedBanner: HomeAdBanner = {
    ...current.homeAdBanner,
    ...incomingBanner,
    enabled: effectiveEnabled,
    imageUrl: finalImageUrls[0] || "",
    imageUrls: finalImageUrls,
    actualizadoEn: new Date().toISOString(),
  };

  const merged: PortalConfig = {
    companyInfo: {
      ...current.companyInfo,
      ...(newConfig.companyInfo || {}),
    },
    promotions: Array.isArray(newConfig.promotions)
      ? newConfig.promotions
      : current.promotions,
    globalAlert: {
      ...current.globalAlert,
      ...(newConfig.globalAlert || {}),
    },
    homeAdBanner: updatedBanner,
    actualizadoEn: new Date().toISOString(),
  };

  // Guardar en Upstash Redis de forma indefinida y permanente (SIN ttl ni expiración)
  await Promise.all([
    redisSet(CONFIG_KEY, merged),
    redisSet(BANNER_KEY, updatedBanner),
  ]);

  return merged;
}
