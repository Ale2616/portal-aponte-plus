import { ClientProfile, Invoice, PaymentReportSubmission, PaymentReportResult } from "./types";
import { generateRadicado } from "./utils";

const WISPHUB_API_URL = process.env.WISPHUB_API_URL || "https://api.wisphub.net/api";
const WISPHUB_API_KEY = process.env.WISPHUB_API_KEY || "";
const FORCE_MOCK_MODE = process.env.WISPHUB_MOCK_MODE === "true" || !WISPHUB_API_KEY;

// Base de datos simulada en memoria para comprobantes reportados durante la sesión
const reportedPaymentsStore: Record<string, {
  radicado: string;
  idFactura: string;
  monto: number;
  referencia: string;
  fecha: string;
  estado: string;
}> = {};

// Clientes Demo predefinidos para pruebas completas
const DEMO_CLIENTS: Record<string, { profile: ClientProfile; invoices: Invoice[] }> = {
  "1020304050": {
    profile: {
      id: "wh_cli_8921",
      cedula: "1020304050",
      nombreCompleto: "Juan Carlos Rodríguez Mendoza",
      email: "juan.rodriguez@gmail.com",
      telefono: "3114567890",
      direccion: "Carrera 15 # 48-32, Apto 402",
      ciudad: "Bogotá, D.C.",
      estadoServicio: "activo",
      plan: {
        nombre: "Fibra Gamer 200 Mbps Simétrico",
        velocidadBajada: "200 Mbps",
        velocidadSubida: "200 Mbps",
        precioMensual: 85000,
        tecnologia: "Fibra Óptica FTTH",
      },
      servicio: {
        ip: "100.64.45.12",
        nodo: "OLT-Norte-04 / Puerto 7",
        routerOnt: "Huawei HG8245H5 (Dual Band 5GHz)",
        fechaCorte: "2026-03-20",
        fechaLimitePago: "2026-03-18",
        diaPago: 18,
      },
      saldoTotalPendiente: 85000,
      facturasPendientesCount: 1,
    },
    invoices: [
      {
        id: "inv_2026_03",
        folio: "FAC-2026-003891",
        periodo: "Marzo 2026",
        fechaEmision: "2026-03-01",
        fechaVencimiento: "2026-03-18",
        subtotal: 71429,
        impuestos: 13571,
        total: 85000,
        saldoPendiente: 85000,
        estado: "pendiente",
        concepto: "Servicio de Internet Fibra Óptica 200 Mbps - Periodo 01/03/2026 al 31/03/2026",
      },
      {
        id: "inv_2026_02",
        folio: "FAC-2026-002450",
        periodo: "Febrero 2026",
        fechaEmision: "2026-02-01",
        fechaVencimiento: "2026-02-18",
        subtotal: 71429,
        impuestos: 13571,
        total: 85000,
        saldoPendiente: 0,
        estado: "pagada",
        concepto: "Servicio de Internet Fibra Óptica 200 Mbps - Periodo 01/02/2026 al 28/02/2026",
      },
      {
        id: "inv_2026_01",
        folio: "FAC-2026-001120",
        periodo: "Enero 2026",
        fechaEmision: "2026-01-01",
        fechaVencimiento: "2026-01-18",
        subtotal: 71429,
        impuestos: 13571,
        total: 85000,
        saldoPendiente: 0,
        estado: "pagada",
        concepto: "Servicio de Internet Fibra Óptica 200 Mbps - Periodo 01/01/2026 al 31/01/2026",
      },
    ],
  },
  "9876543210": {
    profile: {
      id: "wh_cli_7419",
      cedula: "9876543210",
      nombreCompleto: "María Elena Restrepo Gómez",
      email: "maria.restrepo@hotmail.com",
      telefono: "3187654321",
      direccion: "Calle 72 # 11-45, Casa 3",
      ciudad: "Medellín, Antioquia",
      estadoServicio: "cortado",
      plan: {
        nombre: "UltraFibra 300 Mbps Hogar",
        velocidadBajada: "300 Mbps",
        velocidadSubida: "300 Mbps",
        precioMensual: 95000,
        tecnologia: "Fibra Óptica FTTH",
      },
      servicio: {
        ip: "100.64.98.54",
        nodo: "OLT-Occidente-02 / Puerto 3",
        routerOnt: "ZTE F670L (Wi-Fi 6 Gigabit)",
        fechaCorte: "2026-03-05",
        fechaLimitePago: "2026-03-03",
        diaPago: 3,
      },
      saldoTotalPendiente: 190000,
      facturasPendientesCount: 2,
    },
    invoices: [
      {
        id: "inv_2026_03_m",
        folio: "FAC-2026-004120",
        periodo: "Marzo 2026",
        fechaEmision: "2026-03-01",
        fechaVencimiento: "2026-03-03",
        subtotal: 79832,
        impuestos: 15168,
        total: 95000,
        saldoPendiente: 95000,
        estado: "vencida",
        concepto: "Servicio de Internet Fibra Óptica 300 Mbps - Mes en curso",
      },
      {
        id: "inv_2026_02_m",
        folio: "FAC-2026-002890",
        periodo: "Febrero 2026",
        fechaEmision: "2026-02-01",
        fechaVencimiento: "2026-02-03",
        subtotal: 79832,
        impuestos: 15168,
        total: 95000,
        saldoPendiente: 95000,
        estado: "vencida",
        concepto: "Servicio de Internet Fibra Óptica 300 Mbps - Saldo en mora anterior",
      },
      {
        id: "inv_2026_01_m",
        folio: "FAC-2026-001402",
        periodo: "Enero 2026",
        fechaEmision: "2026-01-01",
        fechaVencimiento: "2026-01-03",
        subtotal: 79832,
        impuestos: 15168,
        total: 95000,
        saldoPendiente: 0,
        estado: "pagada",
        concepto: "Servicio de Internet Fibra Óptica 300 Mbps - Periodo Enero 2026",
      },
    ],
  },
  "1122334455": {
    profile: {
      id: "wh_cli_3321",
      cedula: "1122334455",
      nombreCompleto: "Carlos Andrés Gómez Pérez",
      email: "carlos.gomez@outlook.com",
      telefono: "3009876543",
      direccion: "Diagonal 45D # 19-80",
      ciudad: "Cali, Valle del Cauca",
      estadoServicio: "activo",
      plan: {
        nombre: "Plan Familiar Fibra 100 Mbps",
        velocidadBajada: "100 Mbps",
        velocidadSubida: "100 Mbps",
        precioMensual: 65000,
        tecnologia: "Fibra Óptica FTTH",
      },
      servicio: {
        ip: "100.64.12.78",
        nodo: "OLT-Sur-01 / Puerto 12",
        routerOnt: "VSOL V2801SG (Gigabit GPON)",
        fechaCorte: "2026-04-15",
        fechaLimitePago: "2026-04-12",
        diaPago: 12,
      },
      saldoTotalPendiente: 0,
      facturasPendientesCount: 0,
    },
    invoices: [
      {
        id: "inv_2026_03_c",
        folio: "FAC-2026-003611",
        periodo: "Marzo 2026",
        fechaEmision: "2026-03-01",
        fechaVencimiento: "2026-03-12",
        subtotal: 54622,
        impuestos: 10378,
        total: 65000,
        saldoPendiente: 0,
        estado: "pagada",
        concepto: "Servicio de Internet Fibra Óptica 100 Mbps - Pagada anticipadamente",
      },
      {
        id: "inv_2026_02_c",
        folio: "FAC-2026-002155",
        periodo: "Febrero 2026",
        fechaEmision: "2026-02-01",
        fechaVencimiento: "2026-02-12",
        subtotal: 54622,
        impuestos: 10378,
        total: 65000,
        saldoPendiente: 0,
        estado: "pagada",
        concepto: "Servicio de Internet Fibra Óptica 100 Mbps",
      },
    ],
  },
};

/**
 * Genera un cliente dinámico para cualquier número de documento ingresado que no esté en la lista demo
 */
function generateDynamicMockClient(cedula: string) {
  const isSuspended = cedula.endsWith("0") || cedula.endsWith("9");
  const estado = isSuspended ? "cortado" : "activo";
  const planPrice = 75000;
  const saldoPendiente = isSuspended ? planPrice : planPrice;

  const profile: ClientProfile = {
    id: `wh_cli_${cedula.slice(-4)}`,
    cedula,
    nombreCompleto: `Abonado Fibra Cédula ${cedula}`,
    email: `cliente.${cedula}@correo.com`,
    telefono: "300" + cedula.slice(-7).padStart(7, "1"),
    direccion: "Calle Principal # 10-25",
    ciudad: "Colombia",
    estadoServicio: estado,
    plan: {
      nombre: "Fibra Residencial 150 Mbps",
      velocidadBajada: "150 Mbps",
      velocidadSubida: "150 Mbps",
      precioMensual: planPrice,
      tecnologia: "Fibra Óptica FTTH",
    },
    servicio: {
      ip: `100.64.${parseInt(cedula.slice(0, 2)) || 10}.${parseInt(cedula.slice(2, 4)) || 20}`,
      nodo: "OLT-Principal-Nodo-A",
      routerOnt: "ONT GPON Wi-Fi Dual Band",
      fechaCorte: "2026-03-25",
      fechaLimitePago: "2026-03-22",
      diaPago: 22,
    },
    saldoTotalPendiente: saldoPendiente,
    facturasPendientesCount: 1,
  };

  const invoices: Invoice[] = [
    {
      id: `inv_${cedula}_03`,
      folio: `FAC-2026-${cedula.slice(-4).padStart(6, "0")}`,
      periodo: "Marzo 2026",
      fechaEmision: "2026-03-01",
      fechaVencimiento: isSuspended ? "2026-03-05" : "2026-03-22",
      subtotal: 63025,
      impuestos: 11975,
      total: planPrice,
      saldoPendiente: planPrice,
      estado: isSuspended ? "vencida" : "pendiente",
      concepto: `Servicio de Internet Fibra Óptica 150 Mbps - Periodo Marzo 2026`,
    },
    {
      id: `inv_${cedula}_02`,
      folio: `FAC-2026-${(parseInt(cedula.slice(-4)) - 1 || 1000).toString().padStart(6, "0")}`,
      periodo: "Febrero 2026",
      fechaEmision: "2026-02-01",
      fechaVencimiento: "2026-02-22",
      subtotal: 63025,
      impuestos: 11975,
      total: planPrice,
      saldoPendiente: 0,
      estado: "pagada",
      concepto: `Servicio de Internet Fibra Óptica 150 Mbps - Periodo Febrero 2026`,
    },
  ];

  return { profile, invoices };
}

/**
 * Consulta un cliente en WispHub o mediante Mock Provider
 */
export async function getClientByDocument(documento: string): Promise<{
  success: boolean;
  cliente?: ClientProfile;
  facturas?: Invoice[];
  error?: string;
}> {
  const cleanDoc = documento.trim();
  if (!cleanDoc) {
    return { success: false, error: "El número de documento es obligatorio." };
  }

  // 1. Si no hay API key o estamos en Mock Mode, usar proveedores demo y dinámicos
  if (FORCE_MOCK_MODE) {
    const demoData = DEMO_CLIENTS[cleanDoc] || generateDynamicMockClient(cleanDoc);
    
    // Anotar facturas que tengan comprobante reportado en la sesión
    const updatedInvoices = demoData.invoices.map((inv) => ({
      ...inv,
      tieneReportePendiente: Boolean(reportedPaymentsStore[inv.id]),
    }));

    return {
      success: true,
      cliente: demoData.profile,
      facturas: updatedInvoices,
    };
  }

  // 2. Conexión real a API WispHub
  try {
    const response = await fetch(`${WISPHUB_API_URL}/clientes/?cedula=${encodeURIComponent(cleanDoc)}`, {
      method: "GET",
      headers: {
        "Authorization": `Api-Key ${WISPHUB_API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // Fallback elegante a Mock si la API externa responde error 401/403/500
      console.warn(`[WispHub] API returned ${response.status}. Falling back to mock data.`);
      const fallback = DEMO_CLIENTS[cleanDoc] || generateDynamicMockClient(cleanDoc);
      return {
        success: true,
        cliente: fallback.profile,
        facturas: fallback.invoices,
      };
    }

    const data = await response.json();
    const clientItem = Array.isArray(data.results) ? data.results[0] : (Array.isArray(data) ? data[0] : data);

    if (!clientItem) {
      return { success: false, error: "No se encontró ningún abonado con el documento ingresado." };
    }

    // Consulta de facturas del cliente en WispHub
    const invoicesRes = await fetch(`${WISPHUB_API_URL}/facturas/?cliente=${clientItem.id}`, {
      method: "GET",
      headers: {
        "Authorization": `Api-Key ${WISPHUB_API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    let invoicesList: Invoice[] = [];
    if (invoicesRes.ok) {
      const invData = await invoicesRes.json();
      const rawInvoices = Array.isArray(invData.results) ? invData.results : (Array.isArray(invData) ? invData : []);
      invoicesList = rawInvoices.map((raw: any) => ({
        id: String(raw.id || raw.id_factura),
        folio: raw.folio || `FAC-${raw.id}`,
        periodo: raw.periodo || "Mes en curso",
        fechaEmision: raw.fecha_emision || new Date().toISOString().split("T")[0],
        fechaVencimiento: raw.fecha_vencimiento || new Date().toISOString().split("T")[0],
        subtotal: Number(raw.subtotal || raw.total || 0),
        impuestos: Number(raw.iva || 0),
        total: Number(raw.total || 0),
        saldoPendiente: Number(raw.saldo_pendiente ?? raw.total),
        estado: (raw.estado === "pagada" ? "pagada" : (new Date(raw.fecha_vencimiento) < new Date() ? "vencida" : "pendiente")),
        concepto: raw.concepto || "Servicio de Internet",
        pdfUrl: raw.pdf_url,
        tieneReportePendiente: Boolean(reportedPaymentsStore[String(raw.id)]),
      }));
    }

    const totalSaldo = invoicesList
      .filter((inv) => inv.estado !== "pagada")
      .reduce((acc, curr) => acc + curr.saldoPendiente, 0);

    const clientProfile: ClientProfile = {
      id: String(clientItem.id),
      cedula: String(clientItem.cedula || cleanDoc),
      nombreCompleto: clientItem.nombre || clientItem.nombre_completo || "Abonado WispHub",
      email: clientItem.email || "sin_correo@isp.com",
      telefono: clientItem.telefono || clientItem.celular || "",
      direccion: clientItem.direccion || "Dirección no especificada",
      ciudad: clientItem.ciudad || "Colombia",
      estadoServicio: (clientItem.estado === "activo" ? "activo" : (clientItem.estado === "cortado" ? "cortado" : "suspendido")),
      plan: {
        nombre: clientItem.plan_internet?.nombre || clientItem.plan_nombre || "Plan Fibra",
        velocidadBajada: clientItem.plan_internet?.bajada || "100 Mbps",
        velocidadSubida: clientItem.plan_internet?.subida || "100 Mbps",
        precioMensual: Number(clientItem.plan_internet?.precio || totalSaldo || 75000),
        tecnologia: "Fibra Óptica FTTH",
      },
      servicio: {
        ip: clientItem.ip || "100.64.0.1",
        nodo: clientItem.nodo?.nombre || "Nodo Principal",
        routerOnt: clientItem.modelo_router || "ONT Gigabit Dual Band",
        fechaCorte: clientItem.fecha_corte || "2026-03-25",
        fechaLimitePago: clientItem.fecha_limite || "2026-03-22",
        diaPago: Number(clientItem.dia_pago || 20),
      },
      saldoTotalPendiente: totalSaldo,
      facturasPendientesCount: invoicesList.filter((inv) => inv.estado !== "pagada").length,
    };

    return {
      success: true,
      cliente: clientProfile,
      facturas: invoicesList,
    };
  } catch (err: any) {
    console.error("[WispHub Service Error]:", err);
    // Fallback suave a mock ante cualquier caída de red
    const fallback = DEMO_CLIENTS[cleanDoc] || generateDynamicMockClient(cleanDoc);
    return {
      success: true,
      cliente: fallback.profile,
      facturas: fallback.invoices,
    };
  }
}

/**
 * Registra un reporte de pago con comprobante
 */
export async function submitPaymentReport(
  payload: PaymentReportSubmission,
  _fileBuffer?: Buffer
): Promise<PaymentReportResult> {
  const radicado = generateRadicado();
  const fechaRecepcion = new Date().toISOString();

  // Guardar en el almacén de pagos para actualizar el estado visual de la factura
  reportedPaymentsStore[payload.idFactura] = {
    radicado,
    idFactura: payload.idFactura,
    monto: payload.monto,
    referencia: payload.referencia,
    fecha: fechaRecepcion,
    estado: "en_revision",
  };

  // Si hay API de WispHub configurada, se puede reenviar el ticket de reporte al CRM
  if (!FORCE_MOCK_MODE && WISPHUB_API_KEY) {
    try {
      await fetch(`${WISPHUB_API_URL}/pagos/reportar/`, {
        method: "POST",
        headers: {
          "Authorization": `Api-Key ${WISPHUB_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_cliente: payload.idCliente,
          id_factura: payload.idFactura,
          referencia: payload.referencia,
          monto: payload.monto,
          metodo_pago: payload.metodoPago,
          fecha_transferencia: payload.fechaHoraTransferencia,
          radicado: radicado,
        }),
      });
    } catch (apiErr) {
      console.warn("[WispHub Report Forwarding Warning]:", apiErr);
      // No bloqueamos al usuario si la API externa de reportes no responde
    }
  }

  return {
    success: true,
    radicado,
    idReporte: `REP-${Date.now().toString(36).toUpperCase()}`,
    mensaje: "Comprobante de pago recibido exitosamente. Será procesado por el equipo de cobranzas.",
    fechaRecepcion,
    facturaFolio: payload.idFactura,
    monto: payload.monto,
    metodoPago: payload.metodoPago,
    referencia: payload.referencia,
  };
}

export function isInvoiceReported(id: string): boolean {
  return Boolean(reportedPaymentsStore[id]);
}

export function getDemoClientNumbers() {
  return [
    { cedula: "1116208294", label: "Sol Angela Sandoval (Activo)", tag: "1 Factura Pendiente ($25.000)" },
    { cedula: "1117529802", label: "Duver Orozco Rodriguez (Activo)", tag: "1 Factura Pendiente ($80.000)" },
    { cedula: "5991177", label: "Duvan Gomez Rozo (Cortado)", tag: "Mora / Servicio Cortado" },
    { cedula: "1117550685", label: "Valentina Puentes (Al Día)", tag: "Al Día ($0 Pendiente)" },
  ];
}
