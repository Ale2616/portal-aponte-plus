import { NextRequest, NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/save-subscription
 *
 * Registra o actualiza la suscripción Web Push en la base de datos/almacenamiento para el cliente.
 * Soporta formato WebPush estándar y upsert por endpoint.
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

    console.log(`[Push] Suscripción guardada exitosamente para cédula: ${cleanCedula}`);

    return NextResponse.json({
      success: true,
      message: "Suscripción a notificaciones push registrada con éxito.",
      cedula: cleanCedula,
      id_servicio: id_servicio || undefined,
    });
  } catch (error: any) {
    console.error("[API /api/push/save-subscription Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al registrar la suscripción push." },
      { status: 500 }
    );
  }
}
