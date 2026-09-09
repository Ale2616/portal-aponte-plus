import { NextRequest, NextResponse } from "next/server";

interface WisphubRawInvoice {
  id?: number | string;
  id_factura?: number | string;
  id_servicio?: number | string;
  folio?: string | null;
  fecha?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  fecha_pago?: string | null;
  periodo?: string | null;
  subtotal?: number | string;
  sub_total?: number | string;
  iva?: number | string;
  impuestos_total?: number | string;
  total: number | string;
  saldo_pendiente?: number | string;
  saldo?: number | string;
  estado: string | number;
  concepto?: string;
  descripcion?: string;
  pdf_factura?: string;
  pdf_url?: string;
  url_factura?: string;
  cliente?: any;
  servicio?: any;
  articulos?: any[];
  [key: string]: any;
}

export async function GET(req: NextRequest) {
  return handleFacturasQuery(req);
}

export async function POST(req: NextRequest) {
  return handleFacturasQuery(req);
}

async function handleFacturasQuery(req: NextRequest) {
  try {
    let idServicio = "";
    let idCliente = "";
    let cedula = "";
    let usuario = "";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      idServicio = String(body?.id_servicio || body?.id || "").trim();
      idCliente = String(body?.cliente || body?.id_cliente || "").trim();
      cedula = String(body?.cedula || "").trim();
      usuario = String(body?.usuario || body?.username || "").trim();
    } else {
      const { searchParams } = new URL(req.url);
      idServicio = String(searchParams.get("id_servicio") || searchParams.get("id") || "").trim();
      idCliente = String(searchParams.get("cliente") || searchParams.get("id_cliente") || "").trim();
      cedula = String(searchParams.get("cedula") || "").trim();
      usuario = String(searchParams.get("usuario") || searchParams.get("username") || "").trim();
    }

    if (!idServicio && !idCliente && !cedula && !usuario) {
      return NextResponse.json(
        {
          success: false,
          error: "Debe suministrar 'id_servicio', 'cliente', 'cedula' o 'usuario' para consultar las facturas.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.WISPHUB_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "Error de sincronización con WispHub: Credenciales (WISPHUB_API_KEY) no configuradas en el servidor.",
        },
        { status: 500 }
      );
    }

    const baseUrl = (process.env.WISPHUB_BASE_URL || "https://api.wisphub.net").replace(/\/+$/, "");
    const headers: Record<string, string> = {
      "Authorization": `Api-Key ${apiKey}`,
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // 1. Fallback dinámico de cédula / servicio / usuario si alguno falta
    let targetCedula = cedula;
    let targetServiceId = idServicio;
    let targetClientId = idCliente;
    let targetUsuario = usuario;

    // Si idCliente contiene '@', corresponde directamente al usuario en WispHub
    if (!targetUsuario && targetClientId && targetClientId.includes("@")) {
      targetUsuario = targetClientId;
    }

    if (targetCedula && (!targetUsuario || !targetServiceId)) {
      try {
        const searchRes = await fetch(`${baseUrl}/api/clientes/?cedula=${encodeURIComponent(targetCedula)}`, { headers, cache: "no-store" });
        if (searchRes.ok) {
          const sData = await searchRes.json();
          const items = Array.isArray(sData?.results) ? sData.results : Array.isArray(sData) ? sData : [];
          const match = items.find((c: any) => String(c.cedula || "").trim() === targetCedula) || items[0];
          if (match) {
            if (match.usuario && !targetUsuario) targetUsuario = String(match.usuario).trim();
            if (match.id_servicio && !targetServiceId) targetServiceId = String(match.id_servicio || match.id || "").trim();
            if (match.id && !targetClientId) targetClientId = String(match.id).trim();
          }
        }
      } catch (sErr) {
        console.warn("[WISPHUB API] No fue posible resolver cliente por cédula:", sErr);
      }
    }

    if (targetServiceId && (!targetUsuario || !targetCedula)) {
      try {
        const clientRes = await fetch(`${baseUrl}/api/clientes/${encodeURIComponent(targetServiceId)}/`, { headers, cache: "no-store" });
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          if (clientData?.usuario && !targetUsuario) targetUsuario = String(clientData.usuario).trim();
          if (clientData?.cedula && !targetCedula) targetCedula = String(clientData.cedula).trim();
          if (clientData?.id && !targetClientId) targetClientId = String(clientData.id).trim();
        }
      } catch (cErr) {
        console.warn("[WISPHUB API] No fue posible obtener detalle de cliente por id_servicio:", cErr);
      }
    }

    // 2. Consulta paginada a WispHub recorriendo todas las páginas (data.next) con rango histórico
    const rangeParam = "fecha_vencimiento__range_0=2020-01-01&fecha_vencimiento__range_1=2030-12-31";
    let currentUrl: string | null = targetUsuario
      ? `${baseUrl}/api/facturas/?cliente=${encodeURIComponent(targetUsuario)}&${rangeParam}`
      : targetServiceId
      ? `${baseUrl}/api/facturas/?id_servicio=${encodeURIComponent(targetServiceId)}&${rangeParam}`
      : `${baseUrl}/api/facturas/`;

    const allRawInvoices: WisphubRawInvoice[] = [];
    let pageCount = 0;

    while (currentUrl && pageCount < 50) {
      pageCount++;
      // Convertir siempre http:// a https:// para que fetch de Node no pierda Authorization en redirección
      const secureUrl: string = currentUrl.replace(/^http:\/\//i, "https://");
      try {
        const res: Response = await fetch(secureUrl, { headers, cache: "no-store" });
        if (!res.ok) {
          console.warn(`[WISPHUB API] Error en página ${pageCount} de facturas: HTTP ${res.status}`);
          break;
        }
        const data: any = await res.json();
        const results = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : data?.id_factura || data?.id
          ? [data]
          : [];

        if (pageCount === 1) {
          console.log(
            `[WISPHUB API] Facturas encontradas para servicio ${idServicio || targetServiceId}:`,
            data.results?.length || data.length || 0
          );
        }

        allRawInvoices.push(...results);
        currentUrl = data?.next ? String(data.next) : null;
      } catch (fetchErr: any) {
        console.warn(`[WISPHUB API] Fallo de conexión en página ${pageCount}:`, fetchErr.message);
        break;
      }
    }

    console.log(
      `[WISPHUB API] Facturas encontradas para servicio ${targetServiceId || targetCedula}:`,
      allRawInvoices.length
    );

    // 3. Filtrado en memoria: extraer todas las facturas correspondientes a este servicio/abonado
    let matchedInvoices = allRawInvoices.filter((raw: any) => {
      // Extraer IDs de servicio vinculados
      const serviceIds: string[] = [];
      if (raw.id_servicio !== undefined && raw.id_servicio !== null) {
        serviceIds.push(String(raw.id_servicio).trim());
      }
      if (raw.servicio) {
        const s = typeof raw.servicio === "object" ? (raw.servicio?.id_servicio || raw.servicio?.id) : raw.servicio;
        if (s) serviceIds.push(String(s).trim());
      }
      if (Array.isArray(raw.articulos)) {
        for (const art of raw.articulos) {
          if (art?.servicio) {
            const as = typeof art.servicio === "object" ? (art.servicio?.id_servicio || art.servicio?.id) : art.servicio;
            if (as) serviceIds.push(String(as).trim());
          }
        }
      }

      // Extraer cliente y cédula
      const invClientId = String(
        raw.id_cliente ||
        raw.cliente_id ||
        (typeof raw.cliente === "object" ? (raw.cliente?.id || raw.cliente?.id_cliente) : raw.cliente) ||
        ""
      ).trim();

      const invCedula = String(
        raw.cedula ||
        (typeof raw.cliente === "object" ? raw.cliente?.cedula : "") ||
        ""
      ).trim();

      const invUsuario = String(
        (typeof raw.cliente === "object" ? raw.cliente?.usuario : "") || ""
      ).trim();

      const matchService = Boolean(targetServiceId && serviceIds.includes(targetServiceId));
      const matchClient = Boolean(targetClientId && invClientId && invClientId === targetClientId);
      const matchCedula = Boolean(targetCedula && invCedula && invCedula === targetCedula);
      const matchCrossService = Boolean(targetServiceId && invClientId && invClientId === targetServiceId);
      const matchCrossClient = Boolean(targetClientId && serviceIds.includes(targetClientId));
      const matchUsuario = Boolean(targetUsuario && invUsuario && invUsuario.toLowerCase() === targetUsuario.toLowerCase());

      return matchService || matchClient || matchCedula || matchCrossService || matchCrossClient || matchUsuario;
    });

    // FALLBACK POR CÉDULA: Si la búsqueda inicial devolvió 0 y tenemos cédula, realizar filtrado alternativo por cédula
    if (matchedInvoices.length === 0 && targetCedula) {
      matchedInvoices = allRawInvoices.filter((raw: any) => {
        const invCed = String(
          raw.cedula ||
          (typeof raw.cliente === "object" ? raw.cliente?.cedula : "") ||
          ""
        ).trim();
        return invCed === targetCedula;
      });
    }

    // 4. Estandarizar facturas para el frontend
    const facturasEstandarizadas = matchedInvoices.map((raw: any) => {
      const idStr = String(raw.id_factura || raw.id || "").trim();
      const rawEstado = String(raw.estado ?? "").toLowerCase().trim();
      const rawSaldo = raw.saldo_pendiente ?? raw.saldo;
      const totalNum = parseFloat(String(raw.total || 0)) || 0;
      const subtotalNum = parseFloat(String(raw.subtotal || raw.sub_total || totalNum)) || totalNum;
      const ivaNum = parseFloat(String(raw.iva || raw.impuestos_total || 0)) || 0;

      const isPaid =
        rawEstado === "pagada" ||
        rawEstado === "1" ||
        rawEstado === "pago" ||
        rawEstado === "pagado" ||
        rawEstado === "cancelada" ||
        rawEstado === "cobrada";

      const dueDateStr = raw.fecha_vencimiento || raw.fecha_limite || new Date().toISOString().split("T")[0];
      const isOverdue = !isPaid && new Date(dueDateStr) < new Date();
      const estado = isPaid ? "pagada" : isOverdue ? "vencida" : "pendiente";

      const saldoPendiente = isPaid
        ? 0
        : rawSaldo !== undefined && rawSaldo !== null && parseFloat(String(rawSaldo)) > 0
        ? parseFloat(String(rawSaldo))
        : totalNum;

      // Extraer periodo facturado
      let periodoStr = raw.periodo ? String(raw.periodo).trim() : "";
      if (!periodoStr && Array.isArray(raw.articulos) && raw.articulos.length > 0) {
        const desc = String(raw.articulos[0]?.descripcion || "");
        const match = desc.match(/Periodo\s+(?:del\s+)?([^\r\n]+)/i);
        if (match) periodoStr = match[1].trim();
      }
      if (!periodoStr) periodoStr = "Mes en curso";

      // Concepto
      let conceptoStr = raw.concepto || raw.descripcion || "";
      if (!conceptoStr && Array.isArray(raw.articulos) && raw.articulos.length > 0) {
        const fullDesc = String(raw.articulos[0]?.descripcion || "");
        const firstLine = fullDesc.split("\r\n")[0] || fullDesc.split("\n")[0] || "";
        conceptoStr = firstLine.trim();
      }
      if (!conceptoStr) conceptoStr = `Servicio de Internet Banda Ancha - ${periodoStr}`;

      const pdfFactura =
        raw.pdf_factura ||
        raw.pdf_url ||
        raw.url_factura ||
        raw.pdf ||
        raw.link_pdf ||
        raw.url_pdf ||
        undefined;

      const pdfUrl = pdfFactura || `/api/facturas/${idStr}/pdf`;
      const fechaPagoStr = raw.fecha_pago ? String(raw.fecha_pago).trim() : undefined;

      return {
        id: idStr,
        folio: raw.folio ? String(raw.folio) : `FAC-${idStr}`,
        fecha: raw.fecha_emision || raw.fecha || dueDateStr,
        fechaEmision: raw.fecha_emision || raw.fecha || dueDateStr,
        fechaVencimiento: dueDateStr,
        fechaPago: fechaPagoStr,
        periodo: periodoStr,
        total: totalNum,
        subtotal: subtotalNum,
        impuestos: ivaNum,
        saldoPendiente,
        estado,
        estadoEtiqueta: isPaid ? "Pagada" : isOverdue ? "Vencida" : "Pendiente",
        concepto: conceptoStr,
        pdfUrl,
        pdfFactura: pdfFactura || pdfUrl,
        tieneReportePendiente: false,
      };
    });

    // 5. Separación en colecciones requeridas: pendientes e historial
    const pendientes = facturasEstandarizadas.filter(
      (inv) => inv.estado !== "pagada" && (inv.saldoPendiente > 0 || inv.estado === "pendiente" || inv.estado === "vencida")
    );

    const historial = facturasEstandarizadas
      .filter((inv) => inv.estado === "pagada" || inv.saldoPendiente === 0)
      .sort((a, b) => {
        const timeA = new Date(a.fechaPago || a.fechaEmision || a.fechaVencimiento || 0).getTime();
        const timeB = new Date(b.fechaPago || b.fechaEmision || b.fechaVencimiento || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return Number(b.id || 0) - Number(a.id || 0);
      });

    const totalPendiente = pendientes.reduce((acc, inv) => acc + (inv.saldoPendiente || inv.total || 0), 0);

    return NextResponse.json({
      success: true,
      id_servicio: targetServiceId || undefined,
      id_cliente: targetClientId || undefined,
      cedula: targetCedula || undefined,
      usuario: targetUsuario || undefined,
      totalFacturas: facturasEstandarizadas.length,
      pendientes,
      historial,
      totalPendiente,
      facturas: facturasEstandarizadas,
    });
  } catch (err: any) {
    console.error("[API /api/facturas Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Error de sincronización con WispHub: No fue posible consultar el historial de facturas.",
      },
      { status: 502 }
    );
  }
}
