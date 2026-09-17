import { NextRequest, NextResponse } from "next/server";
import { formatInvoiceMonth } from "@/lib/utils";

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
          error: "Error de sincronización con el servidor: Credenciales no configuradas en el servidor.",
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

    // PRIORIDAD 1: Resolver el usuario EXACTO por id_servicio cuando está disponible.
    // Esto evita el problema de cédulas con múltiples servicios donde cada uno tiene
    // un usuario diferente (ej. nury-garavito-avendano@aponteplus vs nury-garavito-negocio-ropa@aponteplus).
    if (targetServiceId && !targetUsuario) {
      try {
        const clientRes = await fetch(`${baseUrl}/api/clientes/${encodeURIComponent(targetServiceId)}/`, { headers, cache: "no-store" });
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          if (clientData?.usuario) targetUsuario = String(clientData.usuario).trim();
          if (clientData?.cedula && !targetCedula) targetCedula = String(clientData.cedula).trim();
          if (clientData?.id && !targetClientId) targetClientId = String(clientData.id).trim();
        }
      } catch (cErr) {
        console.warn("[WISPHUB API] No fue posible obtener detalle de cliente por id_servicio:", cErr);
      }
    }

    // PRIORIDAD 2: Si solo hay cédula, buscar clientes por cédula y seleccionar el correcto
    if (targetCedula && (!targetUsuario || !targetServiceId)) {
      try {
        const searchRes = await fetch(`${baseUrl}/api/clientes/?cedula=${encodeURIComponent(targetCedula)}&page_size=50`, { headers, cache: "no-store" });
        if (searchRes.ok) {
          const sData = await searchRes.json();
          const items = Array.isArray(sData?.results) ? sData.results : Array.isArray(sData) ? sData : [];

          // Si tenemos un id_servicio, buscar el cliente que coincida exactamente
          let match: any = null;
          if (targetServiceId) {
            match = items.find((c: any) =>
              String(c.id_servicio || c.id || "").trim() === targetServiceId
            );
          }
          // Fallback: buscar por cédula exacta o tomar el primero
          if (!match) {
            match = items.find((c: any) => String(c.cedula || "").trim() === targetCedula) || items[0];
          }

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

    // 2. Consulta paginada a WispHub recorriendo todas las páginas (data.next) con rango histórico
    const rangeParam = "fecha_vencimiento__range_0=2020-01-01&fecha_vencimiento__range_1=2030-12-31";
    const pageSizeParam = "page_size=200";
    let currentUrl: string | null = targetUsuario
      ? `${baseUrl}/api/facturas/?cliente=${encodeURIComponent(targetUsuario)}&${rangeParam}&${pageSizeParam}`
      : targetServiceId
      ? `${baseUrl}/api/facturas/?id_servicio=${encodeURIComponent(targetServiceId)}&${rangeParam}&${pageSizeParam}`
      : `${baseUrl}/api/facturas/?${pageSizeParam}`;

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
      `[WISPHUB API] Facturas totales para servicio ${targetServiceId || targetCedula}:`,
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

      // Match directo por id_servicio (en factura o artículos)
      const matchService = Boolean(targetServiceId && serviceIds.includes(targetServiceId));
      const matchCrossService = Boolean(targetServiceId && invClientId && invClientId === targetServiceId);

      // Match por cliente / cédula / usuario
      const matchClient = Boolean(targetClientId && invClientId && invClientId === targetClientId);
      const matchCedula = Boolean(targetCedula && invCedula && invCedula === targetCedula);
      const matchCrossClient = Boolean(targetClientId && serviceIds.includes(targetClientId));
      const matchUsuario = Boolean(targetUsuario && invUsuario && invUsuario.toLowerCase() === targetUsuario.toLowerCase());

      // CORREGIDO: WispHub puede usar IDs de servicio internos diferentes en artículos vs clientes.
      // Ejemplo: el cliente tiene id_servicio=1182 pero las facturas referencian id_servicio=1323 en artículos.
      // Si la consulta se hizo por usuario (ya filtrada por persona en WispHub), aceptar por cédula/usuario.
      if (targetServiceId && serviceIds.length > 0) {
        // Match directo por servicio: ideal
        if (matchService || matchCrossService) return true;
        // Fallback: la consulta fue por usuario y la cédula/usuario coincide → misma persona, aceptar
        if (targetUsuario && (matchUsuario || matchCedula)) return true;
        if (targetCedula && matchCedula) return true;
        return false;
      }

      return matchService || matchClient || matchCedula || matchCrossService || matchCrossClient || matchUsuario;
    });

    // FALLBACK: Si el filtrado no encontró nada, relajar usando cédula o usuario
    if (matchedInvoices.length === 0 && (targetCedula || targetUsuario)) {
      matchedInvoices = allRawInvoices.filter((raw: any) => {
        const invCed = String(
          raw.cedula ||
          (typeof raw.cliente === "object" ? raw.cliente?.cedula : "") ||
          ""
        ).trim();
        const invUsr = String(
          (typeof raw.cliente === "object" ? raw.cliente?.usuario : "") || ""
        ).trim();
        const matchCed = Boolean(targetCedula && invCed && invCed === targetCedula);
        const matchUsr = Boolean(targetUsuario && invUsr && invUsr.toLowerCase() === targetUsuario.toLowerCase());
        return matchCed || matchUsr;
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
      if (!periodoStr || periodoStr.toLowerCase().includes("mes en curso")) {
        periodoStr = formatInvoiceMonth(periodoStr, raw.fecha_emision || raw.fecha || raw.created_at, dueDateStr);
      }

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
        estadoEtiqueta: isPaid ? "Pagada" : "Pendiente",
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
        error: "Error de sincronización con el servidor: No fue posible consultar el historial de facturas.",
      },
      { status: 502 }
    );
  }
}
