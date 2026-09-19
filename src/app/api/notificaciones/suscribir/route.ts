import { NextRequest, NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/notificaciones/suscribir
 *
 * Registra o actualiza la suscripción Web Push del abonado en la persistencia.
 * Payload esperado:
 * {
 *   cedula: string,
 *   id_servicio?: string,
 *   subscription: {
 *     endpoint: string,
 *     keys: { p256dh: string, auth: string }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cedula, id_servicio, subscription, endpoint, keys, p256dh, auth } = body;

    const cleanCedula = String(cedula || "").trim();
    if (!cleanCedula) {
      return NextResponse.json(
        { success: false, error: "La 'cedula' del cliente es obligatoria para asociar la suscripción." },
        { status: 400 }
      );
    }

    // Normalizar objeto de suscripción
    let finalSub = subscription;
    if (!finalSub && endpoint) {
      finalSub = {
        endpoint,
        keys: keys || (p256dh && auth ? { p256dh, auth } : undefined),
      };
    }

    if (!finalSub || !finalSub.endpoint || !finalSub.keys?.p256dh || !finalSub.keys?.auth) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos de suscripción incompletos. Se requiere 'endpoint' y claves 'p256dh' y 'auth'.",
        },
        { status: 400 }
      );
    }

    const saved = await saveSubscription(cleanCedula, id_servicio, finalSub);

    if (!saved) {
      return NextResponse.json(
        { success: false, error: "No fue posible almacenar la suscripción en el sistema." },
        { status: 500 }
      );
    }

    console.log(`[Web Push] Dispositivo registrado exitosamente para cédula: ${cleanCedula}`);

    return NextResponse.json({
      success: true,
      message: "Suscripción a notificaciones push registrada con éxito.",
      cedula: cleanCedula,
    });
  } catch (error: any) {
    console.error("[API Suscribir Push Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al registrar la suscripción." },
      { status: 500 }
    );
  }
}
