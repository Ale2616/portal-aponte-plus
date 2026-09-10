/**
 * WispHub Web Scraper — Obtiene datos reales de Traffic Flow
 * mediante autenticación de sesión en el panel web de WispHub (Django).
 *
 * Arquitectura de protección contra rate-limiting y bloqueos de IP:
 *
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  CAPAS DE PROTECCIÓN EMPRESARIAL                                │
 *  │                                                                 │
 *  │  1. Caché Multi-Tier (L1 RAM -> L2 Redis -> L3 Disco)           │
 *  │     - FRESH (< 6 Horas): respuesta instantánea < 10ms           │
 *  │  2. Stale-While-Revalidate (SWR)                                │
 *  │     - STALE (6h - 24h): entrega inmediata dato viejo +          │
 *  │       worker en segundo plano (fire-and-forget)                 │
 *  │  3. Mutex de Sesión y Login Único                               │
 *  │     - Reutiliza cookie sessionid (TTL 25 min)                   │
 *  │     - Deduplica llamadas a /accounts/login/ con loginPromise    │
 *  │  4. Deduplicación de Peticiones en Vuelo (In-Flight Coalesce)   │
 *  │     - N peticiones concurrentes para el mismo cliente           │
 *  │       comparten la misma promesa única de scraping              │
 *  │  5. Semáforo de Concurrencia Global                             │
 *  │     - Máx 1 conexión simultánea a WispHub                       │
 *  │  6. Batch Queue para CRON                                       │
 *  │     - Secuencial con sleep(800ms) y backoff de 5.000ms ante     │
 *  │       errores para simular navegación humana                    │
 *  └─────────────────────────────────────────────────────────────────┘
 */

import * as cheerio from "cheerio";
import {
  getTrafficCache,
  setTrafficCache,
  invalidateTrafficCache,
  getTrafficCacheStats,
  ScrapedDayTraffic,
  CacheStatus,
} from "./traffic-cache";

// Re-exportar tipos para compatibilidad
export type { ScrapedDayTraffic, CacheStatus };

export interface ScrapedTrafficResult {
  success: boolean;
  dias: ScrapedDayTraffic[];
  source: "wisphub_scraping";
  error?: string;
  cached?: boolean;
  stale?: boolean;
  cacheStatus?: CacheStatus;
  responseTimeMs?: number;
}

// ─── Caché de Sesión de Administrador (Django) ──────────────────────────────────

interface SessionCache {
  sessionId: string;
  csrfToken: string;
  createdAt: number;
}

const SESSION_TTL_MS = 25 * 60 * 1000; // 25 minutos
let cachedSession: SessionCache | null = null;
let activeLoginPromise: Promise<boolean> | null = null;

function isSessionValid(): boolean {
  if (!cachedSession) return false;
  return Date.now() - cachedSession.createdAt < SESSION_TTL_MS;
}

// ─── Semáforo de Concurrencia (Máx 1 conexión pesada simultánea) ────────────────

let activeScraping = false;

async function acquireSemaphore(timeoutMs = 25000): Promise<boolean> {
  if (!activeScraping) {
    activeScraping = true;
    return true;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      clearInterval(interval);
      resolve(false);
    }, timeoutMs);

    const interval = setInterval(() => {
      if (!activeScraping) {
        clearTimeout(timer);
        clearInterval(interval);
        activeScraping = true;
        resolve(true);
      }
    }, 150);
  });
}

function releaseSemaphore(): void {
  activeScraping = false;
}

// ─── Deduplicación de Peticiones en Vuelo (In-Flight Promise Coalescing) ─────────

const inFlightScrapes = new Map<string, Promise<ScrapedTrafficResult>>();

// ─── Set de Revalidaciones en Segundo Plano (SWR) ───────────────────────────────

const revalidatingSet = new Set<string>();

// ─── Constantes y Configuración HTTP ────────────────────────────────────────────

const WISPHUB_BASE = "https://wisphub.net";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Login Autenticado con Mutex ────────────────────────────────────────────────

/**
 * Realiza el login en wisphub.net extrayendo el csrftoken y capturando sessionid.
 * Utiliza un Mutex (activeLoginPromise) para asegurar que solo una petición
 * ejecute el login si 20 peticiones llegan simultáneamente.
 */
async function wisphubLogin(): Promise<boolean> {
  if (isSessionValid()) return true;

  // Si ya hay un login en progreso, esperar el mismo resultado
  if (activeLoginPromise) {
    return activeLoginPromise;
  }

  const user = process.env.WISPHUB_ADMIN_USER;
  const pass = process.env.WISPHUB_ADMIN_PASS;

  if (!user || !pass) {
    console.error("[WispHub Scraper] Variables WISPHUB_ADMIN_USER y WISPHUB_ADMIN_PASS no configuradas.");
    return false;
  }

  activeLoginPromise = (async () => {
    try {
      // Paso 1: GET /accounts/login/ para obtener csrftoken
      const loginPageRes = await fetch(`${WISPHUB_BASE}/accounts/login/`, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": UA },
      });

      const setCookies = loginPageRes.headers.getSetCookie ? loginPageRes.headers.getSetCookie() : [];
      const csrfCookieHeader = setCookies.find((c: string) => c.startsWith("csrftoken="));
      const csrfTokenFromCookie = csrfCookieHeader
        ? csrfCookieHeader.split("=")[1].split(";")[0]
        : "";

      if (!csrfTokenFromCookie) {
        console.error("[WispHub Scraper] No se pudo obtener csrftoken del GET /accounts/login/");
        return false;
      }

      // Extraer csrfmiddlewaretoken del HTML
      const pageBody = await loginPageRes.text();
      const csrfInputMatch = pageBody.match(/csrfmiddlewaretoken[^>]*value="([^"]*)"/);
      const csrfMiddlewareToken = csrfInputMatch ? csrfInputMatch[1] : csrfTokenFromCookie;

      // Paso 2: POST /accounts/login/
      const formData = new URLSearchParams({
        csrfmiddlewaretoken: csrfMiddlewareToken,
        login: user,
        password: pass,
        token_device: "",
        name_device: "PortalApontePlus",
        type_device: "web",
      });

      const loginRes = await fetch(`${WISPHUB_BASE}/accounts/login/`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": `csrftoken=${csrfTokenFromCookie}`,
          "Referer": `${WISPHUB_BASE}/accounts/login/`,
          "Origin": WISPHUB_BASE,
        },
        body: formData.toString(),
      });

      const loginSetCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
      const sessionCookieHeader = loginSetCookies.find((c: string) => c.startsWith("sessionid="));
      const newCsrfHeader = loginSetCookies.find((c: string) => c.startsWith("csrftoken="));

      const sessionId = sessionCookieHeader
        ? sessionCookieHeader.split("=")[1].split(";")[0]
        : "";
      const newCsrf = newCsrfHeader
        ? newCsrfHeader.split("=")[1].split(";")[0]
        : csrfTokenFromCookie;

      if (!sessionId) {
        console.error(`[WispHub Scraper] Login falló. Status: ${loginRes.status}`);
        return false;
      }

      cachedSession = {
        sessionId,
        csrfToken: newCsrf,
        createdAt: Date.now(),
      };

      console.log("[WispHub Scraper] Sesión establecida exitosamente.");
      return true;
    } catch (err: any) {
      console.error("[WispHub Scraper] Error durante login:", err.message);
      cachedSession = null;
      return false;
    } finally {
      activeLoginPromise = null;
    }
  })();

  return activeLoginPromise;
}

async function ensureSession(): Promise<SessionCache | null> {
  if (isSessionValid() && cachedSession) {
    return cachedSession;
  }
  cachedSession = null;
  const ok = await wisphubLogin();
  return ok ? cachedSession : null;
}

// ─── Fetch con Sesión y Reintento ───────────────────────────────────────────────

async function fetchWithSession(url: string, retried = false): Promise<Response | null> {
  const session = await ensureSession();
  if (!session) return null;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        "Accept": "application/json, text/html, */*",
        "Cookie": `sessionid=${session.sessionId}; csrftoken=${session.csrfToken}`,
        "Referer": WISPHUB_BASE + "/",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (res.status === 403 && !retried) {
      console.warn("[WispHub Scraper] 403 recibido, re-autenticando sesión...");
      cachedSession = null;
      return fetchWithSession(url, true);
    }

    return res;
  } catch (err: any) {
    console.error(`[WispHub Scraper] Error al consultar ${url}:`, err.message);
    return null;
  }
}

// ─── Parsing de Métricas de Tráfico ─────────────────────────────────────────────

function parseTrafficValueToGb(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number(raw.toFixed(2));

  const str = String(raw).trim().toUpperCase();
  const numMatch = str.match(/([\d.,]+)/);
  if (!numMatch) return 0;

  const num = parseFloat(numMatch[1].replace(",", "."));
  if (isNaN(num)) return 0;

  if (str.includes("TB")) return Number((num * 1024).toFixed(2));
  if (str.includes("GB")) return Number(num.toFixed(2));
  if (str.includes("MB")) return Number((num / 1024).toFixed(2));
  if (str.includes("KB")) return Number((num / (1024 * 1024)).toFixed(2));

  if (num > 50_000_000) return Number((num / (1024 * 1024 * 1024)).toFixed(2));
  if (num > 10_000) return Number((num / 1024).toFixed(2));
  return Number(num.toFixed(2));
}

function normalizeDate(raw: string): string {
  const trimmed = (raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);

  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
    const [d, m, y] = trimmed.split(/[/\s]/);
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}

  return trimmed;
}

function parseTrafficFromJson(data: any): ScrapedDayTraffic[] {
  const days: ScrapedDayTraffic[] = [];
  if (!data || typeof data !== "object") return days;

  const items = Array.isArray(data) ? data
    : Array.isArray(data.datos) ? data.datos
    : Array.isArray(data.data) ? data.data
    : Array.isArray(data.results) ? data.results
    : Array.isArray(data.estadisticas) ? data.estadisticas
    : Array.isArray(data.trafico) ? data.trafico
    : Array.isArray(data.dias) ? data.dias
    : Array.isArray(data.semana) ? data.semana
    : null;

  if (items) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const dateVal = item.fecha || item.date || item.dia || item.day || item.timestamp || "";
      if (!dateVal) continue;
      const fecha = normalizeDate(String(dateVal));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;

      const dl = item.rx ?? item.download ?? item.bajada ?? item.descarga ?? item.rx_bytes ??
        item.download_bytes ?? item.bytes_in ?? item.download_mib ?? item.bajada_mib ?? 0;
      const ul = item.tx ?? item.upload ?? item.subida ?? item.tx_bytes ??
        item.upload_bytes ?? item.bytes_out ?? item.upload_mib ?? item.subida_mib ?? 0;

      days.push({
        fecha,
        downloadGb: parseTrafficValueToGb(dl),
        uploadGb: parseTrafficValueToGb(ul),
      });
    }
    return days;
  }

  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "object" && val !== null && /^\d{4}-\d{2}-\d{2}/.test(key)) {
      const item: any = val;
      days.push({
        fecha: key.substring(0, 10),
        downloadGb: parseTrafficValueToGb(item.rx ?? item.download ?? item.bajada ?? 0),
        uploadGb: parseTrafficValueToGb(item.tx ?? item.upload ?? item.subida ?? 0),
      });
    }
  }

  if (data.labels && Array.isArray(data.labels) && data.datasets && Array.isArray(data.datasets)) {
    const dlDs = data.datasets.find((ds: any) => /rx|download|bajada|descarga/i.test(ds.label || ""));
    const ulDs = data.datasets.find((ds: any) => /tx|upload|subida/i.test(ds.label || ""));

    for (let i = 0; i < data.labels.length; i++) {
      const fecha = normalizeDate(data.labels[i]);
      if (!fecha) continue;
      days.push({
        fecha,
        downloadGb: parseTrafficValueToGb(dlDs?.data?.[i] ?? 0),
        uploadGb: parseTrafficValueToGb(ulDs?.data?.[i] ?? 0),
      });
    }
  }

  return days;
}

function parseTrafficFromHtml(html: string): ScrapedDayTraffic[] {
  const days: ScrapedDayTraffic[] = [];
  try {
    const $ = cheerio.load(html);

    $("script").each((_, el) => {
      const scriptContent = $(el).html() || "";
      const labelsMatch = scriptContent.match(/labels\s*:\s*\[([^\]]+)\]/);
      const dataMatch = scriptContent.match(/data\s*:\s*\[([^\]]+)\]/g);

      if (labelsMatch && dataMatch && dataMatch.length >= 1) {
        const labels = labelsMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, ""));
        const dataSets = dataMatch.map((m) => {
          const vals = m.match(/\[([^\]]+)\]/);
          if (!vals) return [];
          return vals[1].split(",").map((v) => parseFloat(v.trim()) || 0);
        });

        if (labels.length > 0 && dataSets.length > 0) {
          for (let i = 0; i < labels.length; i++) {
            const fecha = normalizeDate(labels[i]);
            if (!fecha) continue;
            days.push({
              fecha,
              downloadGb: parseTrafficValueToGb(dataSets[0]?.[i] ?? 0),
              uploadGb: parseTrafficValueToGb(dataSets[1]?.[i] ?? 0),
            });
          }
        }
      }
    });

    if (days.length === 0) {
      $("table").each((_, table) => {
        $(table).find("tr").each((rowIdx, row) => {
          if (rowIdx === 0) return;
          const cells = $(row).find("td");
          if (cells.length >= 3) {
            const fecha = normalizeDate($(cells[0]).text().trim());
            if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
              days.push({
                fecha,
                downloadGb: parseTrafficValueToGb($(cells[1]).text().trim()),
                uploadGb: parseTrafficValueToGb($(cells[2]).text().trim()),
              });
            }
          }
        });
      });
    }
  } catch (err: any) {
    console.error("[WispHub Scraper] Error parseando HTML:", err.message);
  }

  return days;
}

// ─── Ejecución Interna de Scraping para un Servicio ─────────────────────────────

async function _doScrapeForService(cleanId: string): Promise<ScrapedDayTraffic[]> {
  const endpoints = [
    `${WISPHUB_BASE}/api/trafico/semana/servicio/${cleanId}/`,
    `${WISPHUB_BASE}/api/trafico/hoy/servicio/${cleanId}/`,
  ];

  for (const url of endpoints) {
    const res = await fetchWithSession(url);
    if (!res || !res.ok) continue;

    const contentType = res.headers.get("content-type") || "";
    let days: ScrapedDayTraffic[] = [];

    if (contentType.includes("application/json")) {
      try {
        days = parseTrafficFromJson(await res.json());
      } catch (e: any) {
        console.warn(`[WispHub Scraper] Error parseando JSON de ${url}:`, e.message);
      }
    } else {
      try {
        const htmlBody = await res.text();
        try {
          days = parseTrafficFromJson(JSON.parse(htmlBody));
        } catch {
          days = parseTrafficFromHtml(htmlBody);
        }
      } catch (e: any) {
        console.warn(`[WispHub Scraper] Error parseando respuesta de ${url}:`, e.message);
      }
    }

    if (days.length > 0) {
      days.sort((a, b) => b.fecha.localeCompare(a.fecha));
      return days;
    }
  }

  return [];
}

// ─── Worker de Revalidación en Segundo Plano (SWR) ──────────────────────────────

async function triggerBackgroundRevalidation(cleanId: string): Promise<void> {
  if (revalidatingSet.has(cleanId)) return;
  revalidatingSet.add(cleanId);

  // Ejecución completamente asíncrona ("fire-and-forget")
  (async () => {
    try {
      const acquired = await acquireSemaphore(15000);
      if (!acquired) {
        console.warn(`[WispHub SWR] Semáforo ocupado, omitiendo revalidación de ${cleanId}`);
        return;
      }
      try {
        const days = await _doScrapeForService(cleanId);
        if (days.length > 0) {
          await setTrafficCache(cleanId, days);
          console.log(`[WispHub SWR] Revalidado en background: servicio ${cleanId} (${days.length} días)`);
        }
      } finally {
        releaseSemaphore();
      }
    } catch (err: any) {
      console.warn(`[WispHub SWR] Error revalidando ${cleanId}:`, err.message);
    } finally {
      revalidatingSet.delete(cleanId);
    }
  })();
}

// ─── API Pública: scrapeTrafficWeek con SWR y Concurrencia ──────────────────────

/**
 * Consulta el tráfico de la semana para un servicio.
 *
 * Flujo:
 * 1. Revisa Caché Multi-Tier (L1 RAM -> L2 Redis -> L3 Disco).
 * 2. Si FRESH (< 6h): retorna inmediatamente (< 15ms).
 * 3. Si STALE (6h - 24h): retorna dato viejo inmediatamente (< 20ms) y
 *    dispara revalidación silenciosa en background (SWR).
 * 4. Si MISS: deduplica en inFlightScrapes y adquiere el semáforo para
 *    scrapear WispHub de forma segura.
 */
export async function scrapeTrafficWeek(serviceId: string | number): Promise<ScrapedTrafficResult> {
  const startTime = Date.now();
  const cleanId = String(serviceId || "").trim();

  if (!cleanId) {
    return {
      success: false,
      dias: [],
      source: "wisphub_scraping",
      error: "ID de servicio no proporcionado",
      responseTimeMs: Date.now() - startTime,
    };
  }

  // 1. Verificar Caché Multi-Tier
  const cacheResult = await getTrafficCache(cleanId);

  // CASO A: Caché Fresco (< 6h) ➔ Retornar inmediatamente
  if (cacheResult.status === "fresh" && cacheResult.data) {
    return {
      success: true,
      dias: cacheResult.data,
      source: "wisphub_scraping",
      cached: true,
      stale: false,
      cacheStatus: "fresh",
      responseTimeMs: Date.now() - startTime,
    };
  }

  // CASO B: Stale-While-Revalidate (6h - 24h) ➔ Retornar viejo + revalidar en background
  if (cacheResult.status === "stale" && cacheResult.data) {
    triggerBackgroundRevalidation(cleanId);
    return {
      success: true,
      dias: cacheResult.data,
      source: "wisphub_scraping",
      cached: true,
      stale: true,
      cacheStatus: "stale",
      responseTimeMs: Date.now() - startTime,
    };
  }

  // CASO C: Cache Miss ➔ Verificar si ya hay una petición en vuelo para este ID
  if (inFlightScrapes.has(cleanId)) {
    try {
      const result = await inFlightScrapes.get(cleanId)!;
      return {
        ...result,
        responseTimeMs: Date.now() - startTime,
      };
    } catch {
      // Si falla, continuar al flujo normal
    }
  }

  if (!process.env.WISPHUB_ADMIN_USER || !process.env.WISPHUB_ADMIN_PASS) {
    return {
      success: false,
      dias: [],
      source: "wisphub_scraping",
      error: "Credenciales de WispHub no configuradas en el servidor.",
      cacheStatus: "miss",
      responseTimeMs: Date.now() - startTime,
    };
  }

  // Crear la promesa coalescida para peticiones concurrentes
  const scrapePromise = (async (): Promise<ScrapedTrafficResult> => {
    const acquired = await acquireSemaphore(25000);
    if (!acquired) {
      return {
        success: false,
        dias: [],
        source: "wisphub_scraping",
        error: "Servidor ocupado sincronizando tráfico. Por favor reintenta en breve.",
        cacheStatus: "miss",
      };
    }

    try {
      const days = await _doScrapeForService(cleanId);
      if (days.length > 0) {
        await setTrafficCache(cleanId, days);
        console.log(`[WispHub Scraper] Tráfico obtenido y cacheado para servicio ${cleanId}: ${days.length} días`);
        return {
          success: true,
          dias: days,
          source: "wisphub_scraping",
          cached: false,
          cacheStatus: "fresh",
        };
      }

      return {
        success: false,
        dias: [],
        source: "wisphub_scraping",
        error: "No se pudieron extraer datos de tráfico de WispHub",
        cacheStatus: "miss",
      };
    } finally {
      releaseSemaphore();
    }
  })();

  inFlightScrapes.set(cleanId, scrapePromise);

  try {
    const res = await scrapePromise;
    return {
      ...res,
      responseTimeMs: Date.now() - startTime,
    };
  } finally {
    inFlightScrapes.delete(cleanId);
  }
}

// ─── Batch Scraping Secuencial para CRON Job ────────────────────────────────────

export interface BatchScrapeOptions {
  sleepBetweenMs?: number;   // Pausa entre clientes (default 800ms)
  backoffOnErrorMs?: number; // Pausa ante error (default 5000ms)
  maxServices?: number;      // Límite de seguridad opcional
}

export interface BatchScrapeResult {
  total: number;
  refreshed: number;
  skippedFresh: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

/**
 * Itera secuencialmente sobre una lista de IDs de servicio.
 * Salta clientes con caché fresco (< 6h) y añade pausas para evitar
 * cualquier riesgo de detección o bloqueo de IP.
 */
export async function batchScrapeTraffic(
  serviceIds: (string | number)[],
  options: BatchScrapeOptions = {}
): Promise<BatchScrapeResult> {
  const startBatchTime = Date.now();
  const sleepMs = options.sleepBetweenMs ?? 800;
  const backoffMs = options.backoffOnErrorMs ?? 5000;
  const max = options.maxServices ?? 1000;

  const targetIds = serviceIds.slice(0, max);
  const result: BatchScrapeResult = {
    total: targetIds.length,
    refreshed: 0,
    skippedFresh: 0,
    failed: 0,
    errors: [],
    durationMs: 0,
  };

  if (!process.env.WISPHUB_ADMIN_USER || !process.env.WISPHUB_ADMIN_PASS) {
    result.errors.push("Credenciales WISPHUB_ADMIN_USER/WISPHUB_ADMIN_PASS no configuradas.");
    result.durationMs = Date.now() - startBatchTime;
    return result;
  }

  // Bloquear el semáforo para el batch completo
  const acquired = await acquireSemaphore(30000);
  if (!acquired) {
    result.errors.push("No se pudo adquirir el semáforo de scraping (otro proceso en curso).");
    result.durationMs = Date.now() - startBatchTime;
    return result;
  }

  try {
    for (let i = 0; i < targetIds.length; i++) {
      const cleanId = String(targetIds[i]).trim();
      if (!cleanId) continue;

      // 1. Si ya tiene caché fresco, no tocar WispHub
      const cache = await getTrafficCache(cleanId);
      if (cache.status === "fresh") {
        result.skippedFresh++;
        continue;
      }

      try {
        console.log(`[WispHub CRON] Procesando cliente ${i + 1}/${targetIds.length} (ID: ${cleanId})...`);
        const days = await _doScrapeForService(cleanId);

        if (days.length > 0) {
          await setTrafficCache(cleanId, days);
          result.refreshed++;
        } else {
          result.failed++;
          result.errors.push(`Servicio ${cleanId}: Sin datos encontrados`);
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Servicio ${cleanId}: ${err.message}`);
        console.warn(`[WispHub CRON] Error en servicio ${cleanId}, activando backoff de ${backoffMs}ms...`);
        await sleep(backoffMs);
      }

      // Pausa humanizada entre requests
      await sleep(sleepMs);
    }
  } finally {
    releaseSemaphore();
  }

  result.durationMs = Date.now() - startBatchTime;
  return result;
}

// ─── Re-exportaciones y Mantenimiento ───────────────────────────────────────────

export { invalidateTrafficCache, getTrafficCacheStats };

export function invalidateScraperSession(): void {
  cachedSession = null;
}
