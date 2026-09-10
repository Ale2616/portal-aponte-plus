import { NextRequest, NextResponse } from "next/server";
import {
  getGlobalPortalConfig,
  setGlobalPortalConfig,
  PortalConfig,
} from "@/lib/server-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/configuracion
 * Retorna la configuración global completa del portal (Promociones, Datos Comerciales, Alerta, Banner Carrusel).
 */
export async function GET() {
  try {
    const config = await getGlobalPortalConfig();

    return NextResponse.json(
      {
        success: true,
        config,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error: any) {
    console.error("[API Configuracion GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener la configuración global." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/configuracion
 * Guarda y actualiza la configuración global del portal en Vercel KV / Servidor.
 * Requiere PIN de administrador ("1130").
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { pin, config } = body as { pin?: string; config?: Partial<PortalConfig> };

    if (pin !== "1130") {
      return NextResponse.json(
        {
          success: false,
          error: "PIN de administrador no válido o no autorizado.",
        },
        { status: 401 }
      );
    }

    if (!config || typeof config !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "No se proporcionó un objeto de configuración válido.",
        },
        { status: 400 }
      );
    }

    const updatedConfig = await setGlobalPortalConfig(config);

    console.log("[API Configuracion] Configuración global guardada en el servidor.");

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      message: "Configuración global actualizada y sincronizada en el servidor.",
    });
  } catch (error: any) {
    console.error("[API Configuracion POST Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al guardar la configuración en el servidor.",
      },
      { status: 500 }
    );
  }
}
