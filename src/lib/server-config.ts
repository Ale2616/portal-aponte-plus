/**
 * Gestor de Persistencia Global del Servidor para Portal Aponte Plus
 *
 * Persistencia:
 *  1. Vercel KV / Upstash Redis REST API si están configuradas las variables de entorno
 *     (KV_REST_API_URL / UPSTASH_REDIS_REST_URL)
 *  2. Almacén persistente en disco (data/portal-config.json o /tmp/ en Vercel Serverless)
 *  3. Caché en memoria RAM de proceso (globalThis)
 */

import fs from "fs";
import path from "path";
import {
  PortalConfig,
  CompanyInfo,
  PromotionItem,
  GlobalAlert,
  HomeAdBanner,
  DEFAULT_CONFIG,
} from "@/types/config";

export type { PortalConfig, CompanyInfo, PromotionItem, GlobalAlert, HomeAdBanner };
export { DEFAULT_CONFIG };

// ─── Memoria RAM Global ─────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __GLOBAL_PORTAL_CONFIG__: PortalConfig | undefined;
}

// ─── Conexión REST a Vercel KV / Upstash Redis ─────────────────────────────────

function getRedisConfig(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_API_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_API_TOKEN;

  if (url && token) {
    return { url: url.replace(/\/+$/, ""), token };
  }
  return null;
}

async function getFromRedis(): Promise<PortalConfig | null> {
  const redis = getRedisConfig();
  if (!redis) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${redis.url}/get/portal:global_config`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${redis.token}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const json = await res.json();
    if (!json || !json.result) return null;

    const parsed: PortalConfig =
      typeof json.result === "string" ? JSON.parse(json.result) : json.result;

    return parsed;
  } catch {
    return null;
  }
}

async function saveToRedis(config: PortalConfig): Promise<boolean> {
  const redis = getRedisConfig();
  if (!redis) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${redis.url}/set/portal:global_config`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Persistencia en Archivo Local / tmp ────────────────────────────────────────

function getConfigFilePath(): string {
  const defaultDir = path.join(process.cwd(), "data");
  const tmpDir = path.join(process.cwd(), ".next", "cache");
  const fallbackTmp = "/tmp";

  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    return path.join(defaultDir, "portal-config.json");
  } catch {
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return path.join(tmpDir, "portal-config.json");
    } catch {
      return path.join(fallbackTmp, "portal-config.json");
    }
  }
}

function readConfigFile(): PortalConfig | null {
  try {
    const file = getConfigFilePath();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return null;
}

function writeConfigFile(config: PortalConfig): void {
  try {
    const file = getConfigFilePath();
    fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf-8");
  } catch {}
}

// ─── Funciones Públicas ─────────────────────────────────────────────────────────

export async function getGlobalPortalConfig(): Promise<PortalConfig> {
  // 1. Intentar Redis / KV
  const redisConfig = await getFromRedis();
  if (redisConfig) {
    globalThis.__GLOBAL_PORTAL_CONFIG__ = redisConfig;
    return redisConfig;
  }

  // 2. Intentar archivo en disco
  const diskConfig = readConfigFile();
  if (diskConfig) {
    globalThis.__GLOBAL_PORTAL_CONFIG__ = diskConfig;
    return diskConfig;
  }

  // 3. Memoria global
  if (globalThis.__GLOBAL_PORTAL_CONFIG__) {
    return globalThis.__GLOBAL_PORTAL_CONFIG__;
  }

  // 4. Default
  globalThis.__GLOBAL_PORTAL_CONFIG__ = DEFAULT_CONFIG;
  return DEFAULT_CONFIG;
}

export async function setGlobalPortalConfig(
  newConfig: Partial<PortalConfig>
): Promise<PortalConfig> {
  const current = await getGlobalPortalConfig();

  // Asegurar que homeAdBanner tenga imageUrls (hasta 5 imágenes)
  const incomingBanner: Partial<HomeAdBanner> = newConfig.homeAdBanner ?? {};
  let finalImageUrls: string[] = [];

  if (Array.isArray(incomingBanner.imageUrls) && incomingBanner.imageUrls.length > 0) {
    finalImageUrls = incomingBanner.imageUrls.filter(Boolean).slice(0, 5);
  } else if (incomingBanner.imageUrl) {
    finalImageUrls = [incomingBanner.imageUrl];
  } else if (current.homeAdBanner?.imageUrls && current.homeAdBanner.imageUrls.length > 0) {
    finalImageUrls = current.homeAdBanner.imageUrls.slice(0, 5);
  } else {
    finalImageUrls = [current.homeAdBanner.imageUrl || "/banner-promo-fibra.jpg"];
  }

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
    homeAdBanner: {
      ...current.homeAdBanner,
      ...incomingBanner,
      imageUrl: finalImageUrls[0] || incomingBanner.imageUrl || current.homeAdBanner.imageUrl,
      imageUrls: finalImageUrls,
    },
    actualizadoEn: new Date().toISOString(),
  };

  globalThis.__GLOBAL_PORTAL_CONFIG__ = merged;
  writeConfigFile(merged);
  void saveToRedis(merged);

  return merged;
}
