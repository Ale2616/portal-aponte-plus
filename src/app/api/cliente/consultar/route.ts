import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeDocument } from "@/lib/utils";
import { getClientByDocument } from "@/lib/wisphub";

const ConsultarSchema = z.object({
  documento: z.string().optional(),
  cedula: z.string().optional(),
  id_servicio: z.union([z.string(), z.number()]).optional().nullable(),
}).refine((data) => Boolean(data.documento || data.cedula), {
  message: "Debes ingresar un número de documento o cédula",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = ConsultarSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || "Datos de consulta inválidos";
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const rawInput = (parseResult.data.documento || parseResult.data.cedula || "").toString().trim();
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

    const rawServicio = (cliente.servicio as any) || {};
    const rawCliente = (cliente as any) || {};
    const fechaInstalacion =
      rawServicio.fecha_instalacion ||
      rawServicio.fecha_alta ||
      rawServicio.fecha_ingreso ||
      rawServicio.created_at ||
      rawCliente.fecha_ingreso ||
      null;

    const finalCedula = cliente.cedula || cleanDocument;
    const finalBarrio =
      cliente.barrio ||
      rawServicio.barrio ||
      rawCliente.barrio ||
      "";
    const rawCiudad = cliente.ciudad || rawServicio.ciudad || "Curillo";
    const finalCiudad = (!rawCiudad || rawCiudad.toLowerCase() === "colombia") ? "Curillo" : rawCiudad;
    const rawDepto = cliente.departamento || rawServicio.departamento || "Caquetá";
    const finalDepto = (!rawDepto || rawDepto.toLowerCase() === "colombia") ? "Caquetá" : rawDepto;

    const finalCliente = {
      ...cliente,
      cedula: finalCedula,
      barrio: finalBarrio,
      ciudad: finalCiudad,
      municipio: finalCiudad,
      departamento: finalDepto,
      fecha_instalacion: fechaInstalacion,
      fecha_alta: rawServicio.fecha_alta || rawCliente.fecha_alta || null,
      fecha_ingreso: rawServicio.fecha_ingreso || rawCliente.fecha_ingreso || null,
      created_at: rawServicio.created_at || rawCliente.created_at || null,
      servicio: {
        ...cliente.servicio,
        barrio: rawServicio.barrio || finalBarrio,
        ciudad: finalCiudad,
        municipio: finalCiudad,
        departamento: finalDepto,
        fecha_instalacion: fechaInstalacion,
        fecha_alta: rawServicio.fecha_alta || rawCliente.fecha_alta || null,
        fecha_ingreso: rawServicio.fecha_ingreso || rawCliente.fecha_ingreso || null,
        created_at: rawServicio.created_at || rawCliente.created_at || null,
      },
    };

    // 3. Respuesta estandarizada para el frontend y campos normalizados requeridos
    return NextResponse.json({
      success: true,
      source: "wisphub_api",
      cliente: finalCliente,
      facturas,
      pendientes,
      historial,
      totalPendiente,
      servicios: result.servicios,
      nombre: finalCliente.nombreCompleto,
      cedula: finalCedula,
      usuario: finalCliente.usuario,
      barrio: finalBarrio,
      ciudad: finalCiudad,
      departamento: finalDepto,
      plan: finalCliente.plan.nombre,
      valor: finalCliente.plan.precioMensual,
      estado: finalCliente.estadoServicio,
      fecha_corte: finalCliente.servicio.fechaCorte,
      saldo_pendiente: finalCliente.saldoTotalPendiente,
      ip: finalCliente.servicio.ip,
      fecha_instalacion: fechaInstalacion,
      fecha_alta: rawServicio.fecha_alta || rawCliente.fecha_alta || null,
      fecha_ingreso: rawServicio.fecha_ingreso || rawCliente.fecha_ingreso || null,
      created_at: rawServicio.created_at || rawCliente.created_at || null,
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
