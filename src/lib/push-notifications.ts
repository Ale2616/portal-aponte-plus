import webpush from "web-push";
import { redis } from "@/lib/redis";
import fs from "fs";
import path from "path";

export interface StoredPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  idServicio?: string;
  createdAt?: number;
  updatedAt: number;
}

/**
 * Inicializa la configuración de VAPID para web-push
 */
export function ensureVapidConfig(): boolean {
  const subject = (process.env.VAPID_SUBJECT || "mailto:admin@aponteplus.com").trim();
  const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();

  if (!publicKey || !privateKey) {
    console.error("[Web Push VAPID Error]: Faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en las variables de entorno.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch (err: any) {
    console.error("[Web Push VAPID Config Error]:", err?.message);
    return false;
  }
}

// Fallback local en caso de que Upstash Redis no esté configurado en desarrollo
const LOCAL_SUBS_FILE = path.join(process.cwd(), "src", "data", "local-push-subs.json");

function getLocalSubsMap(): Record<string, any> {
  try {
    if (fs.existsSync(LOCAL_SUBS_FILE)) {
      const content = fs.readFileSync(LOCAL_SUBS_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("[Local Push Subs Read Warning]:", err);
  }
  return {};
}

function writeLocalSubsMap(map: Record<string, any>) {
  try {
    const dir = path.dirname(LOCAL_SUBS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_SUBS_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Local Push Subs Write Warning]:", err);
  }
}

/**
 * Normaliza un objeto o arreglo de suscripciones en un array de StoredPushSubscription válidos
 */
function normalizeSubscriptions(raw: any): StoredPushSubscription[] {
  if (!raw) return [];

  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const valid: StoredPushSubscription[] = [];

  for (const item of items) {
    if (item && typeof item.endpoint === "string" && item.keys?.p256dh && item.keys?.auth) {
      valid.push({
        endpoint: item.endpoint,
        expirationTime: item.expirationTime ?? null,
        keys: {
          p256dh: String(item.keys.p256dh),
          auth: String(item.keys.auth),
        },
        idServicio: item.idServicio ? String(item.idServicio) : undefined,
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || Date.now(),
      });
    }
  }

  return valid;
}

/**
 * Guarda o actualiza una suscripción Web Push en Upstash Redis y fallback local.
 * Soporta múltiples dispositivos por cliente (PC, Móvil, Tablet) deduplicando por endpoint.
 */
export async function saveSubscription(
  cedula: string,
  idServicio: string | undefined,
  subscription: any
): Promise<boolean> {
  const cleanCedula = String(cedula || "").trim();
  if (!cleanCedula || !subscription) return false;

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    console.warn("[Push Save Warning]: Suscripción rechazada, falta endpoint o claves p256dh/auth.");
    return false;
  }

  const cleanServicio = idServicio ? String(idServicio).trim() : undefined;
  const now = Date.now();

  // 1. Obtener lista actual de suscripciones del cliente
  const currentSubs = await getSubscriptions(cleanCedula, cleanServicio);

  // 2. Buscar si ya existe este endpoint para actualizarlo o agregarlo
  const existingIndex = currentSubs.findIndex((s) => s.endpoint === endpoint);
  if (existingIndex >= 0) {
    currentSubs[existingIndex] = {
      ...currentSubs[existingIndex],
      keys: { p256dh: String(p256dh), auth: String(auth) },
      idServicio: cleanServicio || currentSubs[existingIndex].idServicio,
      updatedAt: now,
    };
  } else {
    currentSubs.push({
      endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: { p256dh: String(p256dh), auth: String(auth) },
      idServicio: cleanServicio,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Limitar a los últimos 10 dispositivos registrados para no saturar memoria
  const updatedList = currentSubs.slice(-10);
  const jsonPayload = JSON.stringify(updatedList);
  const cedulaKey = `push:sub:${cleanCedula}`;

  // 3. Persistir en Upstash Redis
  let savedInRedis = await redis.set(cedulaKey, jsonPayload);

  if (cleanServicio) {
    const serviceKey = `push:sub:servicio:${cleanServicio}`;
    await redis.set(serviceKey, jsonPayload);
  }

  // 4. Persistir también en archivo local para desarrollo y respaldo
  try {
    const localMap = getLocalSubsMap();
    localMap[cedulaKey] = updatedList;
    if (cleanServicio) {
      localMap[`push:sub:servicio:${cleanServicio}`] = updatedList;
    }
    writeLocalSubsMap(localMap);
  } catch (localErr) {
    console.warn("[Push Local File Save Error]:", localErr);
  }

  console.log(`[Push] Suscripción guardada exitosamente para cédula: ${cleanCedula}`);

  return savedInRedis || true;
}

/**
 * Recupera todas las suscripciones activas asociadas a una cédula (o idServicio)
 */
export async function getSubscriptions(
  cedula: string,
  idServicio?: string
): Promise<StoredPushSubscription[]> {
  const cleanCedula = String(cedula || "").trim();
  const cleanServicio = idServicio ? String(idServicio).trim() : undefined;

  if (!cleanCedula && !cleanServicio) return [];

  // 1. Intentar consultar por cédula en Upstash Redis
  if (cleanCedula) {
    const raw = await redis.get<any>(`push:sub:${cleanCedula}`);
    const parsed = normalizeSubscriptions(raw);
    if (parsed.length > 0) return parsed;
  }

  // 2. Intentar por id_servicio en Upstash Redis
  if (cleanServicio) {
    const rawServ = await redis.get<any>(`push:sub:servicio:${cleanServicio}`);
    const parsedServ = normalizeSubscriptions(rawServ);
    if (parsedServ.length > 0) return parsedServ;
  }

  // 3. Fallback a almacenamiento local
  const localMap = getLocalSubsMap();
  if (cleanCedula && localMap[`push:sub:${cleanCedula}`]) {
    const localList = normalizeSubscriptions(localMap[`push:sub:${cleanCedula}`]);
    if (localList.length > 0) return localList;
  }

  if (cleanServicio && localMap[`push:sub:servicio:${cleanServicio}`]) {
    const localList = normalizeSubscriptions(localMap[`push:sub:servicio:${cleanServicio}`]);
    if (localList.length > 0) return localList;
  }

  return [];
}

/**
 * Recupera una única suscripción (para compatibilidad hacia atrás con código existente)
 */
export async function getSubscription(cedula: string, idServicio?: string): Promise<StoredPushSubscription | null> {
  const subs = await getSubscriptions(cedula, idServicio);
  return subs.length > 0 ? subs[subs.length - 1] : null;
}

/**
 * Elimina endpoints específicos de suscripción expirados (410 / 404)
 */
export async function removeExpiredSubscriptions(
  cedula: string,
  endpointsToRemove: string[],
  idServicio?: string
): Promise<void> {
  const cleanCedula = String(cedula || "").trim();
  if (!cleanCedula || endpointsToRemove.length === 0) return;

  const currentSubs = await getSubscriptions(cleanCedula, idServicio);
  const filtered = currentSubs.filter((s) => !endpointsToRemove.includes(s.endpoint));

  const cedulaKey = `push:sub:${cleanCedula}`;
  if (filtered.length > 0) {
    await redis.set(cedulaKey, JSON.stringify(filtered));
  } else {
    await redis.del(cedulaKey);
  }

  if (idServicio) {
    const serviceKey = `push:sub:servicio:${String(idServicio).trim()}`;
    if (filtered.length > 0) {
      await redis.set(serviceKey, JSON.stringify(filtered));
    } else {
      await redis.del(serviceKey);
    }
  }

  // Actualizar también almacenamiento local
  const localMap = getLocalSubsMap();
  if (filtered.length > 0) {
    localMap[cedulaKey] = filtered;
    if (idServicio) localMap[`push:sub:servicio:${idServicio}`] = filtered;
  } else {
    delete localMap[cedulaKey];
    if (idServicio) delete localMap[`push:sub:servicio:${idServicio}`];
  }
  writeLocalSubsMap(localMap);
}

/**
 * Envía una notificación Web Push a todos los dispositivos registrados del abonado
 */
export async function sendPaymentPushNotification(params: {
  cedula: string;
  idServicio?: string;
  nombre?: string;
  monto?: number | string;
  servicio?: string;
  url?: string;
  isTest?: boolean;
}): Promise<{ success: boolean; deliveredCount?: number; totalDevices?: number; error?: string }> {
  // 1. Configurar y validar llaves VAPID
  const isConfigured = ensureVapidConfig();
  if (!isConfigured) {
    return { success: false, error: "VAPID no está configurado correctamente en el servidor." };
  }

  const cleanCedula = String(params.cedula || "").trim();
  if (!cleanCedula) {
    return { success: false, error: "Cédula del cliente no especificada." };
  }

  // 2. Obtener todas las suscripciones activas del abonado (multi-dispositivo)
  const subscriptions = await getSubscriptions(cleanCedula, params.idServicio);
  if (!subscriptions || subscriptions.length === 0) {
    return {
      success: false,
      error: `No se encontró ninguna suscripción push activa para el cliente con cédula ${cleanCedula}.`,
    };
  }

  // 3. Construir el payload con los requerimientos técnicos exactos
  const targetUrl = params.url || `/?cedula=${encodeURIComponent(cleanCedula)}`;
  let title = "¡Pago Confirmado! ✅";
  let body = "Tu pago del servicio de internet ha sido registrado con éxito.";

  if (params.isTest) {
    title = "¡Notificación de Prueba! 🔔";
    body = "El canal de notificaciones push está funcionando correctamente en este dispositivo.";
  } else if (params.monto) {
    const montoFormateado = Number(params.monto).toLocaleString("es-CO");
    const plan = params.servicio ? ` (${params.servicio})` : "";
    body = `Tu pago de $${montoFormateado} del servicio de internet${plan} ha sido registrado con éxito.`;
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: "/logo.png",
    badge: "/badge.png",
    url: targetUrl,
    tag: params.isTest ? "prueba-push" : "pago-confirmado",
    timestamp: Date.now(),
  });

  // 4. Despachar a cada dispositivo registrado
  let deliveredCount = 0;
  const expiredEndpoints: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        payload
      );
      deliveredCount++;
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.status;

      // Código 410 (Gone) o 404 (Not Found): La suscripción expiró o fue cancelada por el usuario en el navegador
      if (statusCode === 410 || statusCode === 404) {
        console.warn(`[Web Push] Suscripción expirada (${statusCode} Gone). Eliminando endpoint: ${sub.endpoint}`);
        expiredEndpoints.push(sub.endpoint);
      } else if (statusCode === 401 || statusCode === 400) {
        // Error 401 (Unauthorized) o 400 (Bad Request): Imprimir error detallado de VAPID en consola
        console.error(`[Web Push VAPID Error ${statusCode}]:`, err?.body || err?.message || err);
      } else {
        console.error(`[Web Push Dispatch Error ${statusCode}]:`, err?.message || err);
      }
    }
  }

  // 5. Si hubo suscripciones expiradas (410/404), eliminarlas de la persistencia
  if (expiredEndpoints.length > 0) {
    await removeExpiredSubscriptions(cleanCedula, expiredEndpoints, params.idServicio);
  }

  if (deliveredCount > 0) {
    return {
      success: true,
      deliveredCount,
      totalDevices: subscriptions.length,
    };
  }

  return {
    success: false,
    error: "No se pudo entregar la notificación a los dispositivos registrados (posiblemente expirados).",
  };
}
