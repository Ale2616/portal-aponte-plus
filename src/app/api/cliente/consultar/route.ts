import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeDocument } from "@/lib/utils";
import { isInvoiceReported } from "@/lib/wisphub";
import fs from "fs";
import path from "path";
import { Invoice } from "@/lib/types";

const ConsultarSchema = z.object({
  documento: z
    .string()
    .min(1, "Debes ingresar un número de documento")
    .max(30, "El documento es demasiado largo"),
});

// Cache en memoria para lectura rápida
let cachedClientesList: any[] | null = null;
let lastCacheTime = 0;

function getClientesList(): any[] {
  const now = Date.now();
  if (cachedClientesList && now - lastCacheTime < 30000) {
    return cachedClientesList;
  }

  try {
    const jsonPath = path.join(process.cwd(), "src", "data", "clientes.json");
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.clientes) {
        cachedClientesList = Array.isArray(parsed.clientes)
          ? parsed.clientes
          : Object.values(parsed.clientes);
        lastCacheTime = now;
        return cachedClientesList || [];
      }
    }
  } catch (err) {
    console.error("[API Consultar] Error al leer src/data/clientes.json:", err);
  }

  return [];
}

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

    if (!cleanDocument) {
      return NextResponse.json(
        { success: false, error: "El documento ingresado no contiene caracteres válidos." },
        { status: 400 }
      );
    }

    // 1. OBTENER LISTA DE CLIENTES DESDE clientes.json
    const allClients = getClientesList();

    if (!allClients || allClients.length === 0) {
      return NextResponse.json(
        { success: false, error: "La base de datos de clientes no está disponible." },
        { status: 500 }
      );
    }

    // 2. BUSCAR COINCIDENCIA EXACTA POR CÉDULA / DNI
    // Regla estricta: c.cedula.toString().trim() === cleanDocument.toString().trim()
    const foundClient = allClients.find((c: any) => {
      if (!c || !c.cedula) return false;
      const cCedula = c.cedula.toString().trim();
      const sCedula = sanitizeDocument(cCedula);
      return cCedula === cleanDocument || sCedula === cleanDocument || c.id === `ap_${cleanDocument}`;
    });

    // 3. SI NO EXISTE, RETORNAR ERROR 404 CLARO ("Abonado no encontrado")
    // NUNCA retornar clientes[0] ni clientes por defecto
    if (!foundClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Abonado no encontrado. Por favor verifica el número de documento e intenta de nuevo.",
        },
        { status: 404 }
      );
    }

    // 4. PREPARAR FACTURAS CON ESTADO DE REPORTE EN SESIÓN
    const rawInvoices: Invoice[] = foundClient.invoices || [];
    const updatedInvoices = rawInvoices.map((inv) => ({
      ...inv,
      tieneReportePendiente: isInvoiceReported(inv.id),
    }));

    // Separar invoices del perfil del cliente para respuesta limpia
    const { invoices, ...clientProfile } = foundClient;

    return NextResponse.json({
      success: true,
      source: "clientes.json",
      cliente: clientProfile,
      facturas: updatedInvoices,
    });
  } catch (err: any) {
    console.error("[API /cliente/consultar Error]:", err);
    return NextResponse.json(
      { success: false, error: "Error interno al procesar la consulta. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
