import { NextRequest, NextResponse } from "next/server";
import { getWisphubServiceUsage } from "@/lib/wisphub";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idServicio = searchParams.get("id_servicio") || searchParams.get("id");
    const cedula = searchParams.get("cedula") || searchParams.get("documento");

    if (!idServicio && !cedula) {
      return NextResponse.json(
        {
          success: false,
          error: "Debe proporcionar el 'id_servicio' o el número de 'cedula' del abonado.",
        },
        { status: 400 }
      );
    }

    const consumo = await getWisphubServiceUsage(idServicio || undefined, cedula || undefined);

    return NextResponse.json({
      success: true,
      consumo,
    });
  } catch (error: any) {
    console.error("[API Consumo Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener el consumo de red del abonado.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const idServicio = body.id_servicio || body.id;
    const cedula = body.cedula || body.documento;

    if (!idServicio && !cedula) {
      return NextResponse.json(
        {
          success: false,
          error: "Debe proporcionar el 'id_servicio' o el número de 'cedula' del abonado.",
        },
        { status: 400 }
      );
    }

    const consumo = await getWisphubServiceUsage(idServicio || undefined, cedula || undefined);

    return NextResponse.json({
      success: true,
      consumo,
    });
  } catch (error: any) {
    console.error("[API Consumo POST Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener el consumo de red del abonado.",
      },
      { status: 500 }
    );
  }
}
