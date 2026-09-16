import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/lib/redis";
import { getGlobalPortalConfig, setGlobalPortalConfig } from "@/lib/server-config";
import { HomeAdBanner, DEFAULT_CONFIG } from "@/types/config";

export const dynamic = "force-dynamic";

const BANNER_KEY = "banner_data";

/**
 * GET /api/banner
 * Retorna las promociones/banner del carrusel directamente desde Upstash Redis.
 * NUNCA sobreescribe con imágenes de muestra si Upstash contiene datos válidos.
 */
export async function GET() {
  try {
    const bannerFromRedis = await redisGet<HomeAdBanner>(BANNER_KEY);

    if (bannerFromRedis && typeof bannerFromRedis === "object") {
      return NextResponse.json(
        {
          success: true,
          banner: bannerFromRedis,
          ...bannerFromRedis,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    // Fallback secundario a la configuración global de Redis
    const globalConfig = await getGlobalPortalConfig();
    const banner = globalConfig.homeAdBanner || DEFAULT_CONFIG.homeAdBanner;

    return NextResponse.json(
      {
        success: true,
        banner,
        ...banner,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("[API Banner GET Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al consultar promociones del banner desde la base de datos.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/banner
 * Guarda las promociones del carrusel EXCLUSIVAMENTE en Upstash Redis de forma permanente.
 * Sin memoria global, sin fs.writeFile, sin ttl/ex/px.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = (body.pin || body.codigoPin || req.headers.get("x-admin-pin") || "").toString().trim();

    if (pin !== "1130") {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado: PIN administrativo incorrecto o faltante (Requerido: 1130).",
        },
        { status: 401 }
      );
    }

    const bannerData = body.banner || body;

    let imageUrls: string[] = [];
    if (Array.isArray(bannerData.imageUrls)) {
      imageUrls = bannerData.imageUrls.filter(Boolean).slice(0, 5);
    } else if (bannerData.imageUrl) {
      imageUrls = [bannerData.imageUrl];
    }

    const isAutoDisabled = imageUrls.length === 0;
    const enabled = isAutoDisabled ? false : (bannerData.enabled !== undefined ? bannerData.enabled : true);

    const updatedBanner: HomeAdBanner = {
      enabled,
      imageUrl: imageUrls[0] || "",
      imageUrls,
      titulo: (bannerData.titulo || "¡Pásate a Fibra Óptica con Alta Velocidad!").toString().trim(),
      descripcion: (bannerData.descripcion || "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada.").toString().trim(),
      botonTexto: (bannerData.botonTexto || "Preguntar por WhatsApp").toString().replace(/📲/g, "").replace(/💬/g, "").trim() || "Preguntar por WhatsApp",
      whatsappMensaje: (bannerData.whatsappMensaje || "Hola, vi la promoción en el portal...").toString().trim(),
      linkWhatsapp: bannerData.linkWhatsapp || undefined,
      actualizadoEn: new Date().toISOString(),
    };

    // Guardar EXCLUSIVAMENTE en Upstash Redis sin expiración
    await redisSet(BANNER_KEY, updatedBanner);

    // Sincronizar con la configuración general en Redis
    try {
      await setGlobalPortalConfig({
        homeAdBanner: updatedBanner,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Banner guardado permanentemente en Upstash Redis sin expiración.",
      banner: updatedBanner,
      ...updatedBanner,
    });
  } catch (error: any) {
    console.error("[API Banner POST Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al persistir el banner en Upstash Redis.",
      },
      { status: 500 }
    );
  }
}
