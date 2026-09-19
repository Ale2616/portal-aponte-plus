/**
 * Traffic Cache Multi-Tier Store
 *
 * Arquitectura de 3 niveles para respuesta instantánea (< 50ms):
 *  - Nivel 1 (L1 - RAM): Mapa en memoria ultra-rápido (< 1ms).
 *  - Nivel 2 (L2 - Vercel KV / Upstash Redis): Si existen KV_REST_API_URL y KV_REST_API_TOKEN
 *               o UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN, utiliza HTTP REST nativo
 *               para compartir la caché entre instancias Serverless de Vercel (< 35ms).
 *  - Nivel 3 (L3 - Archivo en Disco): data/traffic-cache.json (o /tmp/ en serverless)
 *               para persistencia local si no hay Redis configurado.
 *
 * Políticas de expiración:
 *  - FRESH (< 6 Horas): Se devuelve inmediatamente al cliente.
 *  - STALE (6h - 24h): Se devuelve el dato viejo inmediatamente (UX instantánea)
 *                      y se dispara revalidación en segundo plano.
 *  - MISS (> 24h o inexistente): Requiere scraping síncrono.
 */

import fs from "fs";
import path from "path";

export interface ScrapedDayTraffic {
  fecha: string;       // YYYY-MM-DD
  downloadGb: number;  // Bajada en GB (2 decimales)
  uploadGb: number;    // Subida en GB (2 decimales)
}

export interface MonthlyTraffic {
  mes: string;        // "Ene", "Feb", ...
  mesNumero: number;  // 1 to 12
  year?: number;      // 2026
  downloadGb: number;
  uploadGb: number;
  totalGb: number;
}

export interface CachedTrafficRecord {
  serviceId: string;
  dias: ScrapedDayTraffic[];
  meses?: MonthlyTraffic[];
  cachedAt: number;     // Timestamp en milisegundos
  version: number;
}

export type CacheStatus = "fresh" | "stale" | "miss";

export interface CacheCheckResult {
  status: CacheStatus;
  data: ScrapedDayTraffic[] | null;
  ageMs: number;
  sourceTier: "l1_ram" | "l2_redis" | "l3_disk" | "none";
}

// ─── Constantes de Tiempo ───────────────────────────────────────────────────────

export const FRESH_TTL_MS = 6 * 60 * 60 * 1000;   // 6 horas
export const STALE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 horas

// ─── L1: Almacén en Memoria RAM ─────────────────────────────────────────────────

const l1MemoryStore = new Map<string, CachedTrafficRecord>();
const MAX_L1_ENTRIES = 1000;

// ─── L2: Configuración Vercel KV / Upstash Redis REST ───────────────────────────

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

async function fetchFromRedis(serviceId: string): Promise<CachedTrafficRecord | null> {
  const redis = getRedisConfig();
  if (!redis) return null;

  try {
    const key = `traffic:${serviceId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200); // 1.2s timeout máx

    const res = await fetch(`${redis.url}/get/${encodeURIComponent(key)}`, {
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

    const parsed: CachedTrafficRecord = typeof json.result === "string"
      ? JSON.parse(json.result)
      : json.result;

    return parsed;
  } catch {
    // Si Redis falla o tarda, degradamos suavemente sin error
    return null;
  }
}

async function saveToRedis(record: CachedTrafficRecord): Promise<boolean> {
  const redis = getRedisConfig();
  if (!redis) return false;

  try {
    const key = `traffic:${record.serviceId}`;
    const ttlSeconds = Math.ceil(STALE_TTL_MS / 1000); // Expirar en Redis a las 24h
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${redis.url}/set/${encodeURIComponent(key)}?ex=${ttlSeconds}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── L3: Almacén en Archivo (Disco / tmp) ────────────────────────────────────────

let l3FilePath: string | null = null;

function getDiskFilePath(): string {
  if (l3FilePath) return l3FilePath;

  // Intentar primero en data/ del proyecto
  const defaultDir = path.join(process.cwd(), "data");
  const tmpDir = path.join(process.cwd(), ".next", "cache");
  const fallbackTmp = "/tmp";

  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    const testFile = path.join(defaultDir, "traffic-cache.json");
    l3FilePath = testFile;
    return l3FilePath;
  } catch {
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      l3FilePath = path.join(tmpDir, "traffic-cache.json");
      return l3FilePath;
    } catch {
      l3FilePath = path.join(fallbackTmp, "traffic-cache.json");
      return l3FilePath;
    }
  }
}

function readDiskCache(): Record<string, CachedTrafficRecord> {
  try {
    const file = getDiskFilePath();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf-8");
      return JSON.parse(content) || {};
    }
  } catch {
    // Si no se puede leer, retornamos vacío
  }
  return {};
}

function writeDiskCache(record: CachedTrafficRecord): void {
  try {
    const file = getDiskFilePath();
    const current = readDiskCache();
    current[record.serviceId] = record;

    // Podar registros con más de 24 horas si el archivo crece mucho
    const now = Date.now();
    const keys = Object.keys(current);
    if (keys.length > 500) {
      for (const k of keys) {
        if (now - current[k].cachedAt > STALE_TTL_MS) {
          delete current[k];
        }
      }
    }

    fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf-8");
  } catch {
    // Falla silenciosa si el entorno serverless es estrictamente read-only
  }
}

// ─── API Pública de Caché ───────────────────────────────────────────────────────

/**
 * Consulta el estado del caché para un servicio en los 3 niveles:
 * 1. L1 RAM (< 1ms)
 * 2. L2 Redis / Vercel KV (< 35ms)
 * 3. L3 Disco / File (< 5ms)
 */
export async function getTrafficCache(serviceId: string | number): Promise<CacheCheckResult> {
  const cleanId = String(serviceId || "").trim();
  if (!cleanId) {
    return { status: "miss", data: null, ageMs: 0, sourceTier: "none" };
  }

  const now = Date.now();

  // 1. Revisar L1 (RAM)
  const l1Record = l1MemoryStore.get(cleanId);
  if (l1Record) {
    const age = now - l1Record.cachedAt;
    if (age < FRESH_TTL_MS) {
      return { status: "fresh", data: l1Record.dias, ageMs: age, sourceTier: "l1_ram" };
    }
    if (age < STALE_TTL_MS) {
      return { status: "stale", data: l1Record.dias, ageMs: age, sourceTier: "l1_ram" };
    }
    // Si expiró más de 24h, remover de L1
    l1MemoryStore.delete(cleanId);
  }

  // 2. Revisar L2 (Redis / Vercel KV si está configurado)
  const redisRecord = await fetchFromRedis(cleanId);
  if (redisRecord && redisRecord.dias) {
    const age = now - redisRecord.cachedAt;
    // Promover a L1 RAM para accesos subsiguientes ultrarrápidos
    l1MemoryStore.set(cleanId, redisRecord);

    if (age < FRESH_TTL_MS) {
      return { status: "fresh", data: redisRecord.dias, ageMs: age, sourceTier: "l2_redis" };
    }
    if (age < STALE_TTL_MS) {
      return { status: "stale", data: redisRecord.dias, ageMs: age, sourceTier: "l2_redis" };
    }
  }

  // 3. Revisar L3 (Disco local / tmp)
  const diskMap = readDiskCache();
  const diskRecord = diskMap[cleanId];
  if (diskRecord && diskRecord.dias) {
    const age = now - diskRecord.cachedAt;
    // Promover a L1 RAM
    l1MemoryStore.set(cleanId, diskRecord);

    if (age < FRESH_TTL_MS) {
      return { status: "fresh", data: diskRecord.dias, ageMs: age, sourceTier: "l3_disk" };
    }
    if (age < STALE_TTL_MS) {
      return { status: "stale", data: diskRecord.dias, ageMs: age, sourceTier: "l3_disk" };
    }
  }

  return { status: "miss", data: null, ageMs: 0, sourceTier: "none" };
}

/**
 * Guarda los datos de tráfico en los 3 niveles de caché.
 */
export async function setTrafficCache(
  serviceId: string | number,
  dias: ScrapedDayTraffic[],
  meses?: MonthlyTraffic[]
): Promise<void> {
  const cleanId = String(serviceId || "").trim();
  if (!cleanId || !Array.isArray(dias)) return;

  const record: CachedTrafficRecord = {
    serviceId: cleanId,
    dias,
    meses,
    cachedAt: Date.now(),
    version: 1,
  };

  // 1. Guardar en L1 (RAM)
  l1MemoryStore.set(cleanId, record);
  if (l1MemoryStore.size > MAX_L1_ENTRIES) {
    const oldestKey = l1MemoryStore.keys().next().value;
    if (oldestKey) l1MemoryStore.delete(oldestKey);
  }

  // 2. Guardar en L3 (Disco) de forma síncrona
  writeDiskCache(record);

  // 3. Guardar en L2 (Redis / Vercel KV) de forma asíncrona no bloqueante
  if (getRedisConfig()) {
    void saveToRedis(record);
  }
}

/**
 * Obtiene el registro completo de tráfico (días y meses) de RAM o Disco.
 */
export function getFullTrafficRecord(serviceId: string | number): CachedTrafficRecord | null {
  const cleanId = String(serviceId || "").trim();
  if (!cleanId) return null;

  if (l1MemoryStore.has(cleanId)) {
    return l1MemoryStore.get(cleanId) || null;
  }

  const diskMap = readDiskCache();
  const diskRecord = diskMap[cleanId];
  if (diskRecord) {
    l1MemoryStore.set(cleanId, diskRecord);
    return diskRecord;
  }

  return null;
}

/**
 * Invalida la caché para un servicio o para todos.
 */
export function invalidateTrafficCache(serviceId?: string | number): void {
  if (serviceId) {
    const cleanId = String(serviceId).trim();
    l1MemoryStore.delete(cleanId);
    try {
      const file = getDiskFilePath();
      const current = readDiskCache();
      if (current[cleanId]) {
        delete current[cleanId];
        fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf-8");
      }
    } catch {}
  } else {
    l1MemoryStore.clear();
    try {
      const file = getDiskFilePath();
      if (fs.existsSync(file)) {
        fs.writeFileSync(file, "{}", "utf-8");
      }
    } catch {}
  }
}

/**
 * Retorna estadísticas de uso de caché para monitoreo y logs.
 */
export function getTrafficCacheStats(): {
  l1Count: number;
  redisConfigured: boolean;
  freshTtlHours: number;
  staleTtlHours: number;
} {
  return {
    l1Count: l1MemoryStore.size,
    redisConfigured: Boolean(getRedisConfig()),
    freshTtlHours: FRESH_TTL_MS / (60 * 60 * 1000),
    staleTtlHours: STALE_TTL_MS / (60 * 60 * 1000),
  };
}
