import { NextRequest, NextResponse } from "next/server";
import { sendPaymentPushNotification } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/notificaciones/enviar
 *
 * Dispara una notificación push Web al abonado cuando su pago ha sido validado.
 * Payload esperado:
 * {
 *   cedula: string,
 *   id_servicio?: string,
 *   nombre?: string,
 *   monto?: number | string,
 *   servicio?: string,
 *   url?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cedula, id_servicio, nombre, monto, servicio, url } = body;

    if (!cedula) {
      return NextResponse.json(
        { success: false, error: "El campo 'cedula' es obligatorio para enviar la notificación." },
        { status: 400 }
      );
    }

    const result = await sendPaymentPushNotification({
      cedula,
      idServicio: id_servicio,
      nombre,
      monto,
      servicio,
      url,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "No se pudo entregar la notificación push." },
        { status: 200 } // Retornar 200 para no romper flujos administrativos si el cliente no activó push
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notificación push enviada exitosamente.",
    });
  } catch (error: any) {
    console.error("[API Enviar Push Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al procesar el envío de la notificación." },
      { status: 500 }
    );
  }
}
