import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { redis, redisGet, redisSet } from "@/lib/redis";
import {
  GlobalSettings,
  DEFAULT_GLOBAL_SETTINGS,
  BannerConfig,
} from "@/types/config";

// ─── BLINDAJE CONTRA CACHÉ DE VERCEL / NEXT.JS (OBLIGATORIO) ─────────────────
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export type { GlobalSettings };
export { DEFAULT_GLOBAL_SETTINGS };

const REDIS_KEY = "isp:global_settings";
const LOCAL_SETTINGS_FILE = path.join(process.cwd(), "src", "data", "global-settings.json");

let devLocalFallback: GlobalSettings | null = null;

function readLocalSettingsFile(): GlobalSettings | null {
  try {
    if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
      const data = fs.readFileSync(LOCAL_SETTINGS_FILE, "utf-8");
      return JSON.parse(data) as GlobalSettings;
    }
  } catch (err) {
    console.warn("[API /api/config] Error al leer archivo local de settings:", err);
  }
  return null;
}

function writeLocalSettingsFile(settings: GlobalSettings): void {
  try {
    const dir = path.dirname(LOCAL_SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.warn("[API /api/config] Error al escribir archivo local de settings (ignorable en Vercel):", err);
  }
}

/**
 * GET /api/config
 * Consulta pública en tiempo real conectada a Upstash Redis con cabeceras anti-caché agresivas.
 */
export async function GET() {
  try {
    let raw: any = await redisGet<GlobalSettings>(REDIS_KEY);
    if (!raw) {
      raw = devLocalFallback || readLocalSettingsFile();
    }

    let settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS;
    if (raw && typeof raw === "object") {
      const rawBanners = Array.isArray(raw.banners) ? raw.banners : [];
      const safeBanners = rawBanners.filter(
        (b: any) =>
          b &&
          typeof b.url === "string" &&
          b.url.trim() !== "" &&
          !b.url.includes("banner1.webp") &&
          !b.url.includes("banner2.webp") &&
          !b.url.includes("banner3.webp")
      );

      const rawBannerConfig = raw.bannerConfig || raw.settings?.bannerConfig;
      const rawCompanyInfo = raw.companyInfo || raw.settings?.companyInfo;

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
        bannerConfig: {
          enabled: Boolean(rawBannerConfig?.enabled ?? raw.bannerEnabled ?? DEFAULT_GLOBAL_SETTINGS.bannerConfig!.enabled),
          titulo: (rawBannerConfig?.titulo || raw.bannerTitulo || DEFAULT_GLOBAL_SETTINGS.bannerConfig!.titulo).trim(),
          descripcion: (rawBannerConfig?.descripcion || raw.bannerDescripcion || DEFAULT_GLOBAL_SETTINGS.bannerConfig!.descripcion).trim(),
          botonTexto: (rawBannerConfig?.botonTexto || raw.bannerBotonTexto || DEFAULT_GLOBAL_SETTINGS.bannerConfig!.botonTexto).trim(),
          whatsappMensaje: (rawBannerConfig?.whatsappMensaje || raw.bannerWhatsappMensaje || DEFAULT_GLOBAL_SETTINGS.bannerConfig!.whatsappMensaje).trim(),
        },
        companyInfo: {
          companyName: (rawCompanyInfo?.companyName || raw.companyName || DEFAULT_GLOBAL_SETTINGS.companyInfo!.companyName).trim(),
          supportPhone: (rawCompanyInfo?.supportPhone || raw.supportPhone || DEFAULT_GLOBAL_SETTINGS.companyInfo!.supportPhone).trim(),
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

    const rawBannerConfig = body.bannerConfig || body.settings?.bannerConfig;
    const rawCompanyInfo = body.companyInfo || body.settings?.companyInfo;

    // Estructurar el objeto limpio para guardar en Redis y en disco local
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
      bannerConfig: {
        enabled: Boolean(
          rawBannerConfig?.enabled ??
          body.bannerEnabled ??
          body.settings?.bannerEnabled ??
          DEFAULT_GLOBAL_SETTINGS.bannerConfig!.enabled
        ),
        titulo: (
          rawBannerConfig?.titulo ||
          body.bannerTitulo ||
          body.settings?.bannerTitulo ||
          DEFAULT_GLOBAL_SETTINGS.bannerConfig!.titulo
        ).trim(),
        descripcion: (
          rawBannerConfig?.descripcion ||
          body.bannerDescripcion ||
          body.settings?.bannerDescripcion ||
          DEFAULT_GLOBAL_SETTINGS.bannerConfig!.descripcion
        ).trim(),
        botonTexto: (
          rawBannerConfig?.botonTexto ||
          body.bannerBotonTexto ||
          body.settings?.bannerBotonTexto ||
          DEFAULT_GLOBAL_SETTINGS.bannerConfig!.botonTexto
        ).trim(),
        whatsappMensaje: (
          rawBannerConfig?.whatsappMensaje ||
          body.bannerWhatsappMensaje ||
          body.settings?.bannerWhatsappMensaje ||
          DEFAULT_GLOBAL_SETTINGS.bannerConfig!.whatsappMensaje
        ).trim(),
      },
      companyInfo: {
        companyName: (
          rawCompanyInfo?.companyName ||
          body.companyName ||
          body.settings?.companyName ||
          DEFAULT_GLOBAL_SETTINGS.companyInfo!.companyName
        ).trim(),
        supportPhone: (
          rawCompanyInfo?.supportPhone ||
          body.supportPhone ||
          body.settings?.supportPhone ||
          DEFAULT_GLOBAL_SETTINGS.companyInfo!.supportPhone
        ).trim(),
      },
    };

    // 1. Guardar en memoria y en disco local para desarrollo
    devLocalFallback = cleanSettings;
    writeLocalSettingsFile(cleanSettings);

    // 2. Guardar en Redis permanente
    await redisSet(REDIS_KEY, cleanSettings);

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
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("[API /api/config POST Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al procesar la solicitud.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
