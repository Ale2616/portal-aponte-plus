import { NextRequest } from "next/server";
import { GET as getHandler, POST as postHandler } from "@/app/api/trafico/sincronizar-historial/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return getHandler(req);
}

export async function POST(req: NextRequest) {
  return postHandler(req);
}
