import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { redis, redisGet, redisSet } from "@/lib/redis";

// ─── BLINDAJE CONTRA CACHÉ DE VERCEL / NEXT.JS (OBLIGATORIO) ─────────────────
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export interface GlobalSettings {
  titular: string; // ej. "Andrés Aponte / Aponte Plus"
  canalesPago: {
    nequi: string;
    bancolombia: string;
    breB: string;
  };
  banners: Array<{
    id: string;
    url: string;
    active: boolean;
  }>;
  avisoGlobal: {
    activo: boolean;
    texto: string;
  };
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  titular: "Andrés Aponte / Aponte Plus",
  canalesPago: {
    nequi: "311 276 0959",
    bancolombia: "84758122483",
    breB: "311 276 0959",
  },
  banners: [],
  avisoGlobal: {
    activo: false,
    texto: "Aviso de mantenimiento programado.",
  },
};

const REDIS_KEY = "isp:global_settings";
let devLocalFallback: GlobalSettings | null = null;

/**
 * GET /api/config
 * Consulta pública en tiempo real conectada a Upstash Redis con cabeceras anti-caché agresivas.
 */
export async function GET() {
  try {
    const raw = (await redisGet<GlobalSettings>(REDIS_KEY)) || devLocalFallback;

    let settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS;
    if (raw && typeof raw === "object") {
      const rawBanners = Array.isArray(raw.banners) ? raw.banners : [];
      // Filtrar de raíz cualquier banner inexistente tipo /banner1.webp o rutas vacías
      const safeBanners = rawBanners.filter(
        (b) =>
          b &&
          typeof b.url === "string" &&
          b.url.trim() !== "" &&
          !b.url.includes("banner1.webp") &&
          !b.url.includes("banner2.webp") &&
          !b.url.includes("banner3.webp")
      );

      settings = {
        titular: (raw.titular || DEFAULT_GLOBAL_SETTINGS.titular).trim(),
        canalesPago: {
          nequi: (raw.canalesPago?.nequi || DEFAULT_GLOBAL_SETTINGS.canalesPago.nequi).trim(),
          bancolombia: (raw.canalesPago?.bancolombia || DEFAULT_GLOBAL_SETTINGS.canalesPago.bancolombia).trim(),
          breB: (raw.canalesPago?.breB || DEFAULT_GLOBAL_SETTINGS.canalesPago.breB).trim(),
        },
        banners: safeBanners,
        avisoGlobal: {
          activo: Boolean(raw.avisoGlobal?.activo ?? false),
          texto: (raw.avisoGlobal?.texto || DEFAULT_GLOBAL_SETTINGS.avisoGlobal.texto).trim(),
        },
      };
    }

    return NextResponse.json(
      {
        success: true,
        ...settings,
        settings,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error: any) {
    console.error("[API /api/config GET Error]:", error);
    return NextResponse.json(
      {
        success: true,
        ...DEFAULT_GLOBAL_SETTINGS,
        settings: DEFAULT_GLOBAL_SETTINGS,
        warning: "Fallback a configuración predeterminada por error de conexión a Redis.",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  }
}

/**
 * POST /api/config (o PUT)
 * Guardado reactivo desde panel administrativo con validación de PIN (1130).
 * Invalida inmediatamente la caché de borde de Vercel (revalidatePath).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = body.pin || req.headers.get("x-admin-pin") || "";

    if (pin !== "1130") {
      return NextResponse.json(
        {
          success: false,
          error: "PIN de administrador no válido o no autorizado.",
        },
        { status: 401 }
      );
    }

    // Estructurar el objeto limpio para guardar en Redis
    const cleanSettings: GlobalSettings = {
      titular: (body.titular || body.settings?.titular || DEFAULT_GLOBAL_SETTINGS.titular).trim(),
      canalesPago: {
        nequi: (body.canalesPago?.nequi || body.settings?.canalesPago?.nequi || DEFAULT_GLOBAL_SETTINGS.canalesPago.nequi).trim(),
        bancolombia: (body.canalesPago?.bancolombia || body.settings?.canalesPago?.bancolombia || DEFAULT_GLOBAL_SETTINGS.canalesPago.bancolombia).trim(),
        breB: (body.canalesPago?.breB || body.settings?.canalesPago?.breB || DEFAULT_GLOBAL_SETTINGS.canalesPago.breB).trim(),
      },
      banners: Array.isArray(body.banners)
        ? body.banners
        : Array.isArray(body.settings?.banners)
        ? body.settings.banners
        : DEFAULT_GLOBAL_SETTINGS.banners,
      avisoGlobal: {
        activo: Boolean(body.avisoGlobal?.activo ?? body.settings?.avisoGlobal?.activo ?? false),
        texto: (body.avisoGlobal?.texto || body.settings?.avisoGlobal?.texto || DEFAULT_GLOBAL_SETTINGS.avisoGlobal.texto).trim(),
      },
    };

    // Guardar en Redis usando await redis.set("isp:global_settings", JSON.stringify(body))
    devLocalFallback = cleanSettings;
    await redis.set("isp:global_settings", JSON.stringify(body));

    // Invalidar caché de borde en Vercel
    try {
      revalidatePath("/", "layout");
      revalidatePath("/api/config");
    } catch (e) {
      console.warn("[revalidatePath Warning]:", e);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Configuración global guardada y sincronizada en Redis sin caché.",
        ...cleanSettings,
        settings: cleanSettings,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error: any) {
    console.error("[API /api/config POST Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al guardar la configuración en el servidor.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
