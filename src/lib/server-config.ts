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
    const timeout = setTimeout(() => controller.abort(), 3500);

    // Intentar GET estándar de Upstash
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
    if (!json || json.result === null || json.result === undefined) return null;

    const parsed: PortalConfig =
      typeof json.result === "string" ? JSON.parse(json.result) : json.result;

    return parsed;
  } catch (err) {
    console.warn("[server-config] Error al leer desde Upstash Redis:", err);
    return null;
  }
}

async function saveToRedis(config: PortalConfig): Promise<boolean> {
  const redis = getRedisConfig();
  if (!redis) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Formato recomendado oficial Upstash Redis REST API (Array de comando en body POST):
    // ["SET", "portal:global_config", "<JSON_STRING>"]
    const commandPayload = JSON.stringify([
      "SET",
      "portal:global_config",
      JSON.stringify(config),
    ]);

    const res = await fetch(redis.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
        "Content-Type": "application/json",
      },
      body: commandPayload,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (res.ok) return true;

    // Fallback: endpoint directo /set/portal:global_config
    const fallbackRes = await fetch(`${redis.url}/set/portal:global_config`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    return fallbackRes.ok;
  } catch (err) {
    console.warn("[server-config] Error al guardar en Upstash Redis:", err);
    return false;
  }
}

// ─── Persistencia en Archivo Local / tmp ────────────────────────────────────────

const DATA_CONFIG_PATH = path.join(process.cwd(), "data", "portal-config.json");
const TMP_CONFIG_PATH = path.join("/tmp", "portal-config.json");

function readConfigFile(): PortalConfig | null {
  // 1. Intentar /tmp (contiene la versión más reciente en entornos serverless)
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ TMP_CONFIG_PATH)) {
      const content = fs.readFileSync(/*turbopackIgnore: true*/ TMP_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}

  // 2. Intentar ruta estándar de proyecto data/portal-config.json
  try {
    if (fs.existsSync(DATA_CONFIG_PATH)) {
      const content = fs.readFileSync(DATA_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}

  return null;
}

function writeConfigFile(config: PortalConfig): void {
  const jsonString = JSON.stringify(config, null, 2);

  // 1. Escribir en data/portal-config.json si el disco es editable
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DATA_CONFIG_PATH, jsonString, "utf-8");
  } catch {}

  // 2. Replicar en /tmp/portal-config.json para Vercel Serverless
  try {
    fs.writeFileSync(/*turbopackIgnore: true*/ TMP_CONFIG_PATH, jsonString, "utf-8");
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

  // Asegurar que homeAdBanner tenga imageUrls (hasta 5 imágenes) y soporte array vacío
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
      enabled: effectiveEnabled,
      imageUrl: finalImageUrls[0] || "",
      imageUrls: finalImageUrls,
    },
    actualizadoEn: new Date().toISOString(),
  };

  globalThis.__GLOBAL_PORTAL_CONFIG__ = merged;
  writeConfigFile(merged);
  await saveToRedis(merged);

  return merged;
}
