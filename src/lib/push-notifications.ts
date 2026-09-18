import webpush from "web-push";
import { redis } from "@/lib/redis";
import fs from "fs";
import path from "path";

// Inicializar configuración VAPID si las llaves existen
export function ensureVapidConfig() {
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@internetaponteplus.com";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      return true;
    } catch (err: any) {
      console.warn("[Web Push VAPID Warning]:", err?.message);
    }
  }
  return false;
}

// Fallback local en caso de que Upstash Redis no esté configurado en desarrollo
const LOCAL_SUBS_FILE = path.join(process.cwd(), "src", "data", "local-push-subs.json");

function getLocalSubs(): Record<string, any> {
  try {
    if (fs.existsSync(LOCAL_SUBS_FILE)) {
      const content = fs.readFileSync(LOCAL_SUBS_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return {};
}

function saveLocalSub(key: string, sub: any) {
  try {
    const dir = path.dirname(LOCAL_SUBS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = getLocalSubs();
    current[key] = sub;
    fs.writeFileSync(LOCAL_SUBS_FILE, JSON.stringify(current, null, 2), "utf-8");
  } catch {}
}

/**
 * Guarda una suscripción Web Push en Upstash Redis (con fallback local)
 */
export async function saveSubscription(
  cedula: string,
  idServicio: string | undefined,
  subscription: any
): Promise<boolean> {
  if (!cedula || !subscription) return false;

  const cleanCedula = String(cedula).trim();
  const subString = typeof subscription === "string" ? subscription : JSON.stringify(subscription);
  const key = `push:sub:${cleanCedula}`;

  // 1. Guardar en Upstash Redis
  let saved = await redis.set(key, subString);

  // Si viene id_servicio, guardar alias secundario para búsquedas por línea
  if (idServicio) {
    const serviceKey = `push:sub:servicio:${String(idServicio).trim()}`;
    await redis.set(serviceKey, subString);
  }

  // 2. Guardar también en respaldo local si Redis no está conectado
  saveLocalSub(key, subscription);

  return saved || true;
}

/**
 * Recupera la suscripción Web Push desde Redis (o respaldo local)
 */
export async function getSubscription(cedula: string, idServicio?: string): Promise<any | null> {
  const cleanCedula = String(cedula || "").trim();
  if (!cleanCedula && !idServicio) return null;

  // 1. Intentar por cédula en Redis
  if (cleanCedula) {
    const raw = await redis.get<string | object>(`push:sub:${cleanCedula}`);
    if (raw) {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  }

  // 2. Intentar por id_servicio en Redis
  if (idServicio) {
    const rawServ = await redis.get<string | object>(`push:sub:servicio:${String(idServicio).trim()}`);
    if (rawServ) {
      return typeof rawServ === "string" ? JSON.parse(rawServ) : rawServ;
    }
  }

  // 3. Fallback local
  const local = getLocalSubs();
  if (cleanCedula && local[`push:sub:${cleanCedula}`]) {
    return local[`push:sub:${cleanCedula}`];
  }

  return null;
}

/**
 * Envía una notificación Web Push de Confirmación de Pago
 */
export async function sendPaymentPushNotification(params: {
  cedula: string;
  idServicio?: string;
  nombre?: string;
  monto?: number | string;
  servicio?: string;
  url?: string;
}): Promise<{ success: boolean; error?: string }> {
  const isConfigured = ensureVapidConfig();
  if (!isConfigured) {
    return { success: false, error: "VAPID no está configurado correctamente" };
  }

  const sub = await getSubscription(params.cedula, params.idServicio);
  if (!sub) {
    return { success: false, error: "No se encontró suscripción push para el abonado" };
  }

  const nombre = params.nombre || "Cliente";
  const monto = params.monto ? Number(params.monto).toLocaleString("es-CO") : "";
  const servicio = params.servicio ? ` (${params.servicio})` : "";
  const targetUrl = params.url || `/?cedula=${encodeURIComponent(params.cedula)}`;

  const body = monto
    ? `Hola ${nombre}, tu pago de $${monto} para el servicio${servicio} ha sido aprobado exitosamente. Tu servicio continúa activo.`
    : `Hola ${nombre}, tu pago ha sido validado exitosamente. Tu servicio de Internet continúa activo.`;

  const payload = JSON.stringify({
    title: "✅ ¡Pago Confirmado!",
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    url: targetUrl,
    tag: "pago-confirmado",
    timestamp: Date.now(),
  });

  try {
    await webpush.sendNotification(sub, payload);
    return { success: true };
  } catch (err: any) {
    console.error("[Web Push Error al enviar]:", err?.statusCode, err?.message);

    // Si la suscripción expiró o fue cancelada (410 Gone / 404 Not Found), eliminarla de Redis
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await redis.del(`push:sub:${params.cedula}`);
      if (params.idServicio) {
        await redis.del(`push:sub:servicio:${params.idServicio}`);
      }
    }

    return { success: false, error: err?.message || "Error al enviar notificación push" };
  }
}
