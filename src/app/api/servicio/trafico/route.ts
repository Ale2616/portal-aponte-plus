import { NextRequest, NextResponse } from "next/server";
import { getMikrotikQueueTraffic, getEmptyTrafficResult } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/**
 * GET /api/servicio/trafico
 *
 * Parámetros admitidos:
 * - ?ip=172.16.100.17 (Dirección IP de la línea del abonado)
 * - ?id=12345 (ID o nombre de cola en MikroTik)
 *
 * Respuesta: Métricas numéricas sanitizadas de velocidad y consumo acumulado en tiempo real.
 * Si el router no responde (timeout) o el cliente está desconectado, retorna HTTP 200 con ceros
 * defensivamente para garantizar la estabilidad total de la interfaz del usuario.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ip = searchParams.get("ip") || "";
    const id = searchParams.get("id") || searchParams.get("id_servicio") || "";

    const target = (ip || id).trim();

    if (!target) {
      return NextResponse.json(
        getEmptyTrafficResult("Debe especificar la IP o ID del servicio (?ip=...)"),
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    const trafficData = await getMikrotikQueueTraffic(target);

    return NextResponse.json(trafficData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "X-Mikrotik-Status": trafficData.enLinea ? "online" : "standby",
      },
    });
  } catch (error: any) {
    // Manejo defensivo: nunca arrojar 500 hacia el cliente
    console.warn("[API /api/servicio/trafico Error]:", error?.message || error);
    return NextResponse.json(getEmptyTrafficResult("Error interno en consulta de tráfico"), {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}
