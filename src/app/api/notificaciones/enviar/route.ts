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
      console.error("[API Enviar Push Error]: El campo 'cedula' es obligatorio.");
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
      console.error("[Web Push Error] Falló la entrega de la notificación push:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo entregar la notificación push a ningún dispositivo.",
        },
        { status: 400 } // Error explícito, NUNCA devolver 200 OK falso ante fallas
      );
    }

    console.log(`[Web Push] Notificación entregada exitosamente a ${result.deliveredCount} dispositivo(s) para cédula: ${cleanCedula}`);

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
