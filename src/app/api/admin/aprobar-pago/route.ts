import { NextRequest, NextResponse } from "next/server";
import { sendPaymentPushNotification } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/aprobar-pago
 *
 * Endpoint administrativo para marcar un pago como verificado/aprobado
 * y disparar inmediatamente la notificación Web Push a todos los dispositivos del abonado.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cedula, id_servicio, nombre, monto, servicio, url } = body;

    const cleanCedula = String(cedula || "").trim();
    if (!cleanCedula) {
      return NextResponse.json(
        { success: false, error: "La cédula del abonado es requerida." },
        { status: 400 }
      );
    }

    // Disparar la notificación push al dispositivo del abonado
    const pushResult = await sendPaymentPushNotification({
      cedula: cleanCedula,
      idServicio: id_servicio ? String(id_servicio).trim() : undefined,
      nombre: nombre || "Cliente",
      monto: monto || 0,
      servicio: servicio || "Internet Fibra Óptica",
      url: url || `/?cedula=${encodeURIComponent(cleanCedula)}`,
    });

    return NextResponse.json({
      success: true,
      pushNotified: pushResult.success,
      deliveredCount: pushResult.deliveredCount || 0,
      totalDevices: pushResult.totalDevices || 0,
      pushError: pushResult.error || null,
      message: pushResult.success
        ? `Pago aprobado y notificación push entregada a ${pushResult.deliveredCount || 1} dispositivo(s).`
        : `Pago aprobado. (Nota Push: ${pushResult.error || "Cliente sin suscripción activa"})`,
    });
  } catch (error: any) {
    console.error("[API Aprobar Pago Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al procesar la aprobación." },
      { status: 500 }
    );
  }
}
