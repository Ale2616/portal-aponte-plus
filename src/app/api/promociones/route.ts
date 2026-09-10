import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export interface PromocionGlobal {
  imagenUrl: string;
  titulo: string;
  descripcion: string;
  botonTexto: string;
  linkWhatsapp: string;
  activa: boolean;
  actualizadoEn: string;
}

const DEFAULT_PROMO: PromocionGlobal = {
  imagenUrl: "/banner-promo-fibra.jpg",
  titulo: "¡Pásate a Fibra Óptica con Alta Velocidad!",
  descripcion: "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada y ultra velocidad.",
  botonTexto: "📲 Preguntar por WhatsApp",
  linkWhatsapp: "https://wa.me/573185577157?text=Hola%2C%20vi%20la%20promoci%C3%B3n%20en%20el%20portal%20y%20deseo%20m%C3%A1s%20informaci%C3%B3n%20sobre%20el%20servicio%20de%20internet",
  activa: true,
  actualizadoEn: new Date().toISOString(),
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "promocion.json");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

async function readPromoData(): Promise<PromocionGlobal> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      imagenUrl: parsed.imagenUrl ?? DEFAULT_PROMO.imagenUrl,
      titulo: parsed.titulo ?? DEFAULT_PROMO.titulo,
      descripcion: parsed.descripcion ?? DEFAULT_PROMO.descripcion,
      botonTexto: parsed.botonTexto ?? DEFAULT_PROMO.botonTexto,
      linkWhatsapp: parsed.linkWhatsapp ?? DEFAULT_PROMO.linkWhatsapp,
      activa: typeof parsed.activa === "boolean" ? parsed.activa : DEFAULT_PROMO.activa,
      actualizadoEn: parsed.actualizadoEn ?? DEFAULT_PROMO.actualizadoEn,
    };
  } catch {
    return DEFAULT_PROMO;
  }
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
    let finalImageUrl = (body.imagenUrl ?? currentData.imagenUrl ?? "").toString().trim();

    // Si viene una imagen en Base64, la guardamos físicamente en public/uploads/
    if (finalImageUrl.startsWith("data:image/")) {
      try {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });

        const matches = finalImageUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const extension = matches[1] === "jpeg" ? "jpg" : matches[1].replace("+xml", "");
          const buffer = Buffer.from(matches[2], "base64");
          const fileName = `promo-${Date.now()}.${extension}`;
          const filePath = path.join(UPLOADS_DIR, fileName);

          await fs.writeFile(filePath, buffer);
          finalImageUrl = `/uploads/${fileName}`;
        }
      } catch (err) {
        console.warn("[API Promociones] Advertencia al procesar archivo Base64:", err);
      }
    }

    if (!finalImageUrl) {
      finalImageUrl = "/banner-promo-fibra.jpg";
    }

    const updatedData: PromocionGlobal = {
      imagenUrl: finalImageUrl,
      titulo: (body.titulo ?? currentData.titulo ?? "").toString().trim() || DEFAULT_PROMO.titulo,
      descripcion: (body.descripcion ?? currentData.descripcion ?? "").toString().trim() || DEFAULT_PROMO.descripcion,
      botonTexto: (body.botonTexto ?? currentData.botonTexto ?? "").toString().trim() || DEFAULT_PROMO.botonTexto,
      linkWhatsapp: (body.linkWhatsapp ?? currentData.linkWhatsapp ?? "").toString().trim() || DEFAULT_PROMO.linkWhatsapp,
      activa: typeof body.activa === "boolean" ? body.activa : (typeof body.enabled === "boolean" ? body.enabled : currentData.activa),
      actualizadoEn: new Date().toISOString(),
    };

    // Asegurar directorio de datos
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify(updatedData, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Promoción actualizada correctamente y disponible de forma global para todos los clientes.",
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
