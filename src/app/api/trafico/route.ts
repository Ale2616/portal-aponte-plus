import { NextRequest, NextResponse } from "next/server";
import { getMikrotikQueueTraffic, getEmptyTrafficResult } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/**
 * Endpoint unificado para consulta de tráfico y velocidad en tiempo real desde MikroTik.
 *
 * Admite peticiones GET y POST:
 * - GET /api/trafico?cedula=1020304050
 * - GET /api/trafico?ip=172.16.100.17
 * - GET /api/trafico?nombre=cola_cliente
 * - POST /api/trafico con { cedula, ip, nombre }
 */
async function handleTrafficQuery(identifier: string, cedula?: string) {
  const target = (identifier || "").trim();
  const cleanCedula = (cedula || "").trim();

  if (!target && !cleanCedula) {
    return NextResponse.json(
      getEmptyTrafficResult("Debe especificar un identificador de cliente, IP o cédula"),
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }

  const trafficData = await getMikrotikQueueTraffic(target, cleanCedula);

  return NextResponse.json(trafficData, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "X-Mikrotik-Status": trafficData.enLinea ? "online" : "standby",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ip = searchParams.get("ip") || "";
    const cedula = searchParams.get("cedula") || searchParams.get("documento") || "";
    const nombre = searchParams.get("nombre") || searchParams.get("name") || "";
    const id = searchParams.get("id") || searchParams.get("id_servicio") || searchParams.get("cliente") || "";

    const identifier = ip || nombre || id || cedula;

    return await handleTrafficQuery(identifier, cedula);
  } catch (error: any) {
    console.warn("[API /api/trafico GET Error Defensivo]:", error?.message || error);
    return NextResponse.json(getEmptyTrafficResult("Error interno en consulta de tráfico"), {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = body.ip || "";
    const cedula = body.cedula || body.documento || "";
    const nombre = body.nombre || body.name || "";
    const id = body.id || body.id_servicio || body.cliente || "";

    const identifier = ip || nombre || id || cedula;

    return await handleTrafficQuery(identifier, cedula);
  } catch (error: any) {
    console.warn("[API /api/trafico POST Error Defensivo]:", error?.message || error);
    return NextResponse.json(getEmptyTrafficResult("Error interno en consulta de tráfico"), {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}
