/**
 * Cliente HTTP REST para Upstash Redis / Vercel KV
 * 
 * Reglas críticas:
 * 1. Persistencia permanente e indefinida: NUNCA usar opciones 'ex', 'px' ni 'ttl'.
 * 2. Cero variables de memoria global ('let cache = ...' o 'globalThis') para evitar
 *    estados desincronizados entre invocaciones serverless en Vercel.
 * 3. Cero almacenamiento en el sistema de archivos local ('fs.writeFile').
 */

export interface RedisCredentials {
  url: string;
  token: string;
}

/**
 * Obtiene las credenciales de Upstash Redis / Vercel KV desde las variables de entorno.
 */
export function getRedisConfig(): RedisCredentials | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.REDIS_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_TOKEN;

  if (url && token) {
    return {
      url: url.replace(/\/+$/, ""),
      token: token.trim(),
    };
  }

  return null;
}

/**
 * Obtiene un valor desde Upstash Redis sin caché intermedio.
 * Retorna null si la clave no existe o si Redis no está configurado.
 */
export async function redisGet<T = any>(key: string): Promise<T | null> {
  const redis = getRedisConfig();
  if (!redis) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${redis.url}/get/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${redis.token}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Upstash Redis] Error HTTP ${res.status} al consultar clave '${key}'.`);
      return null;
    }

    const json = await res.json();
    if (json === null || json === undefined || json.result === null || json.result === undefined) {
      return null;
    }

    if (typeof json.result === "string") {
      try {
        return JSON.parse(json.result) as T;
      } catch {
        return json.result as unknown as T;
      }
    }

    return json.result as T;
  } catch (err: any) {
    console.warn(`[Upstash Redis] Excepción al leer clave '${key}':`, err.message);
    return null;
  }
}

/**
 * Guarda un valor en Upstash Redis de forma permanente e indefinida.
 * NO utiliza 'ex', 'px' ni 'ttl'. La persistencia es indefinida.
 */
export async function redisSet(key: string, value: any): Promise<boolean> {
  const redis = getRedisConfig();
  if (!redis) {
    console.warn(`[Upstash Redis] Variables de entorno no configuradas al guardar '${key}'.`);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const stringValue = typeof value === "string" ? value : JSON.stringify(value);

    // Formato oficial Upstash REST API para comandos: POST ["SET", key, value]
    // SIN argumentos de expiración (persistencia permanente indefinida)
    const commandPayload = JSON.stringify(["SET", key, stringValue]);

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

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.result === "OK" || Boolean(data.result);
    }

    // Fallback: endpoint directo POST /set/:key sin query params de expiración
    const fallbackRes = await fetch(`${redis.url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
        "Content-Type": "application/json",
      },
      body: stringValue,
    });

    return fallbackRes.ok;
  } catch (err: any) {
    console.error(`[Upstash Redis] Excepción al guardar clave '${key}':`, err.message);
    return false;
  }
}

/**
 * Elimina una clave de Upstash Redis.
 */
export async function redisDel(key: string): Promise<boolean> {
  const redis = getRedisConfig();
  if (!redis) return false;

  try {
    const res = await fetch(`${redis.url}/del/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Cliente helper redis para compatibilidad directa con API upstash
 */
export const redis = {
  get: redisGet,
  set: (key: string, value: any) => redisSet(key, value),
  del: redisDel,
};
