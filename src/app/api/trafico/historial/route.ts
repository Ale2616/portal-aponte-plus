import { NextRequest } from "next/server";
import { GET as handleGet, POST as handlePost } from "@/app/api/trafico/sincronizar-historial/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/**
 * GET /api/trafico/historial?id_servicio={id}&cedula={cedula}&anio={year}
 *
 * Endpoint canónico para extraer el historial de consumo anual y mensual
 * dinámicamente desde WispHub y la persistencia local.
 */
export async function GET(req: NextRequest) {
  return handleGet(req);
}

/**
 * POST /api/trafico/historial
 */
export async function POST(req: NextRequest) {
  return handlePost(req);
}
