import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeDocument } from "@/lib/utils";
import { getClientByDocument } from "@/lib/wisphub";

const ConsultarSchema = z.object({
  documento: z
    .string()
    .min(1, "Debes ingresar un número de documento")
    .max(30, "El documento es demasiado largo"),
  id_servicio: z.union([z.string(), z.number()]).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = ConsultarSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || "Datos de consulta inválidos";
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const rawInput = parseResult.data.documento.toString().trim();
    const cleanDocument = sanitizeDocument(rawInput);
    const targetServiceId = parseResult.data.id_servicio ? String(parseResult.data.id_servicio).trim() : null;

    if (!cleanDocument) {
      return NextResponse.json(
        { success: false, error: "El documento ingresado no contiene caracteres válidos." },
        { status: 400 }
      );
    }

    // 1. Verificación de seguridad de credenciales en el servidor
    const apiKey = process.env.WISPHUB_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "Error de sincronización con el servidor: Credenciales no configuradas en el servidor.",
        },
        { status: 500 }
      );
    }

    // 2. Consulta real a la API de WispHub (pasa targetServiceId si fue seleccionado)
    const result = await getClientByDocument(cleanDocument, targetServiceId);

    // Si detecta 2 o más servicios y no se especificó id_servicio, activa el selector multi-línea
    if (result.multipleServices && Array.isArray(result.servicios) && result.servicios.length >= 2) {
      const firstNombre = result.nombre || result.servicios.find((s: any) => s.nombre || s.nombre_completo)?.nombre || "";
      return NextResponse.json({
        success: true,
        multipleServices: true,
        servicios: result.servicios,
        documento: cleanDocument,
        cedula: cleanDocument,
        nombre: firstNombre,
        nombre_completo: firstNombre,
        nombreTitular: firstNombre,
      });
    }

    if (!result.success || !result.cliente) {
      const status = result.statusCode || (result.error?.includes("no encontrado") ? 404 : 502);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Error de sincronización con el sistema.",
        },
        { status }
      );
    }

    const { cliente, facturas = [] } = result;

    const pendientes = facturas.filter(
      (inv) => inv.estado !== "pagada" && (inv.saldoPendiente > 0 || inv.estado === "pendiente" || inv.estado === "vencida")
    );
    const historial = facturas.filter(
      (inv) => inv.estado === "pagada" || inv.saldoPendiente === 0
    );
    const totalPendiente = pendientes.reduce((acc, inv) => acc + (inv.saldoPendiente || inv.total || 0), 0);

    // 3. Respuesta estandarizada para el frontend y campos normalizados requeridos
    return NextResponse.json({
      success: true,
      source: "wisphub_api",
      cliente,
      facturas,
      pendientes,
      historial,
      totalPendiente,
      servicios: result.servicios,
      nombre: cliente.nombreCompleto,
      cedula: cliente.cedula,
      usuario: cliente.usuario,
      plan: cliente.plan.nombre,
      valor: cliente.plan.precioMensual,
      estado: cliente.estadoServicio,
      fecha_corte: cliente.servicio.fechaCorte,
      saldo_pendiente: cliente.saldoTotalPendiente,
      ip: cliente.servicio.ip,
    });
  } catch (err: any) {
    console.error("[API /cliente/consultar Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Error de sincronización con el sistema: Fallo inesperado al procesar la solicitud.",
      },
      { status: 500 }
    );
  }
}
