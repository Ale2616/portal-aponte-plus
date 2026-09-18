import { NextRequest, NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/notificaciones/suscribir
 *
 * Registra o actualiza la suscripción Web Push del abonado en Upstash Redis.
 * Payload esperado:
 * {
 *   cedula: string,
 *   id_servicio?: string,
 *   subscription: PushSubscriptionJSON
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cedula, id_servicio, subscription } = body;

    if (!cedula || !subscription) {
      return NextResponse.json(
        { success: false, error: "La 'cedula' y el objeto 'subscription' son obligatorios." },
        { status: 400 }
      );
    }

    const saved = await saveSubscription(cedula, id_servicio, subscription);

    return NextResponse.json({
      success: true,
      message: "Suscripción a notificaciones push registrada con éxito.",
      savedInRedis: saved,
    });
  } catch (error: any) {
    console.error("[API Suscribir Push Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al registrar la suscripción." },
      { status: 500 }
    );
  }
}
