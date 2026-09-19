import { NextRequest, NextResponse } from "next/server";
import { sendPaymentPushNotification } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/notificaciones/enviar
 *
 * Dispara una notificación push Web al abonado (pago confirmado o prueba).
 * Payload esperado:
 * {
 *   cedula: string,
 *   id_servicio?: string,
 *   nombre?: string,
 *   monto?: number | string,
 *   servicio?: string,
 *   url?: string,
 *   isTest?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cedula, id_servicio, nombre, monto, servicio, url, isTest } = body;

    const cleanCedula = String(cedula || "").trim();
    if (!cleanCedula) {
      return NextResponse.json(
        { success: false, error: "El campo 'cedula' es obligatorio para enviar la notificación." },
        { status: 400 }
      );
    }

    const result = await sendPaymentPushNotification({
      cedula: cleanCedula,
      idServicio: id_servicio ? String(id_servicio).trim() : undefined,
      nombre,
      monto,
      servicio,
      url,
      isTest: Boolean(isTest),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo entregar la notificación push a ningún dispositivo.",
        },
        { status: 200 } // Retornar 200 para no romper flujos administrativos si el cliente no activó push
      );
    }

    return NextResponse.json({
      success: true,
      deliveredCount: result.deliveredCount,
      totalDevices: result.totalDevices,
      message: isTest
        ? "Notificación push de prueba enviada exitosamente."
        : "Notificación push de confirmación de pago enviada exitosamente.",
    });
  } catch (error: any) {
    console.error("[API Enviar Push Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al procesar el envío de la notificación." },
      { status: 500 }
    );
  }
}
