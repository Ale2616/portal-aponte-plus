import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/lib/redis";
import { getGlobalPortalConfig, setGlobalPortalConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export interface PromocionGlobal {
  imagenUrl: string;
  imageUrls?: string[];
  titulo: string;
  descripcion: string;
  botonTexto: string;
  linkWhatsapp: string;
  activa: boolean;
  actualizadoEn: string;
}

const DEFAULT_PROMO: PromocionGlobal = {
  imagenUrl: "/banner-promo-fibra.jpg",
  imageUrls: ["/banner-promo-fibra.jpg"],
  titulo: "¡Pásate a Fibra Óptica con Alta Velocidad!",
  descripcion: "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada y ultra velocidad.",
  botonTexto: "Preguntar por WhatsApp",
  linkWhatsapp: "https://wa.me/573185577157?text=Hola%2C%20vi%20la%20promoci%C3%B3n%20en%20el%20portal%20y%20deseo%20m%C3%A1s%20informaci%C3%B3n%20sobre%20el%20servicio%20de%20internet",
  activa: true,
  actualizadoEn: new Date().toISOString(),
};

const BANNER_KEY = "banner_data";

async function readPromoData(): Promise<PromocionGlobal> {
  try {
    const raw = await redisGet<any>(BANNER_KEY);
    if (raw && typeof raw === "object") {
      const imgUrl = raw.imageUrl || raw.imagenUrl || (Array.isArray(raw.imageUrls) ? raw.imageUrls[0] : "") || DEFAULT_PROMO.imagenUrl;
      const imgs = Array.isArray(raw.imageUrls) && raw.imageUrls.length > 0 ? raw.imageUrls : [imgUrl];

      return {
        imagenUrl: imgUrl,
        imageUrls: imgs,
        titulo: raw.titulo ?? DEFAULT_PROMO.titulo,
        descripcion: raw.descripcion ?? DEFAULT_PROMO.descripcion,
        botonTexto: raw.botonTexto ?? DEFAULT_PROMO.botonTexto,
        linkWhatsapp: raw.linkWhatsapp ?? DEFAULT_PROMO.linkWhatsapp,
        activa: typeof raw.enabled === "boolean" ? raw.enabled : (typeof raw.activa === "boolean" ? raw.activa : DEFAULT_PROMO.activa),
        actualizadoEn: raw.actualizadoEn ?? new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("[API Promociones] Error al leer desde Redis:", err);
  }

  return DEFAULT_PROMO;
}

export async function GET() {
  const promo = await readPromoData();

  return NextResponse.json(
    {
      success: true,
      promocion: promo,
      ...promo,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "El cuerpo de la petición debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const pin = (body.pin || body.codigoPin || req.headers.get("x-admin-pin") || "").toString().trim();

    // Verificación de seguridad PIN 1130
    if (pin !== "1130") {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado: PIN administrativo incorrecto o faltante (Requerido: 1130).",
        },
        { status: 401 }
      );
    }

    const currentData = await readPromoData();

    // Procesar imágenes (soporte de Base64 directo o URLs)
    let imageUrls: string[] = [];
    if (Array.isArray(body.imageUrls)) {
      imageUrls = body.imageUrls.filter(Boolean);
    } else if (body.imageUrl || body.imagenUrl) {
      imageUrls = [(body.imageUrl || body.imagenUrl).toString().trim()];
    } else if (currentData.imageUrls) {
      imageUrls = currentData.imageUrls;
    }

    const finalImageUrl = imageUrls[0] || currentData.imagenUrl || DEFAULT_PROMO.imagenUrl;

    const isEnabled =
      typeof body.activa === "boolean"
        ? body.activa
        : typeof body.enabled === "boolean"
        ? body.enabled
        : imageUrls.length > 0;

    const updatedData: PromocionGlobal = {
      imagenUrl: finalImageUrl,
      imageUrls: imageUrls.length > 0 ? imageUrls : [finalImageUrl],
      titulo: (body.titulo ?? currentData.titulo ?? "").toString().trim() || DEFAULT_PROMO.titulo,
      descripcion: (body.descripcion ?? currentData.descripcion ?? "").toString().trim() || DEFAULT_PROMO.descripcion,
      botonTexto: (body.botonTexto ?? currentData.botonTexto ?? "").toString().trim() || DEFAULT_PROMO.botonTexto,
      linkWhatsapp: (body.linkWhatsapp ?? currentData.linkWhatsapp ?? "").toString().trim() || DEFAULT_PROMO.linkWhatsapp,
      activa: isEnabled,
      actualizadoEn: new Date().toISOString(),
    };

    // Guardado EXCLUSIVO en Upstash Redis con persistencia indefinida permanente (SIN fs.writeFile, SIN memoria global)
    await redisSet(BANNER_KEY, {
      enabled: isEnabled,
      imageUrl: finalImageUrl,
      imageUrls: updatedData.imageUrls,
      titulo: updatedData.titulo,
      descripcion: updatedData.descripcion,
      botonTexto: updatedData.botonTexto,
      linkWhatsapp: updatedData.linkWhatsapp,
      whatsappMensaje: body.whatsappMensaje || currentData.descripcion,
      actualizadoEn: updatedData.actualizadoEn,
    });

    // Sincronizar también con la configuración global
    try {
      await setGlobalPortalConfig({
        homeAdBanner: {
          enabled: isEnabled,
          imageUrl: finalImageUrl,
          imageUrls: updatedData.imageUrls || [],
          titulo: updatedData.titulo,
          descripcion: updatedData.descripcion,
          botonTexto: updatedData.botonTexto,
          linkWhatsapp: updatedData.linkWhatsapp,
          whatsappMensaje: body.whatsappMensaje || "Hola, vi la promoción en el portal...",
        },
      });
    } catch (syncErr) {
      console.warn("[API Promociones] Advertencia al sincronizar con server-config:", syncErr);
    }

    return NextResponse.json({
      success: true,
      message: "Promoción guardada permanentemente en Upstash Redis de forma indefinida.",
      promocion: updatedData,
      ...updatedData,
    });
  } catch (error: any) {
    console.error("[API Promociones Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno al guardar la promoción.",
      },
      { status: 500 }
    );
  }
}
