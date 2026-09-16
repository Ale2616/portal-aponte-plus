import { NextRequest, NextResponse } from "next/server";
import { branding } from "@/config/branding";
import { formatCurrency, formatDate, formatInvoiceMonth } from "@/lib/utils";
import { redisGet } from "@/lib/redis";
import { GlobalSettings, DEFAULT_GLOBAL_SETTINGS } from "@/types/config";

export const dynamic = "force-dynamic";

/**
 * Función robusta para garantizar que la forma de pago sea un texto limpio
 * y JAMÁS un '[object Object]' ni undefined/null.
 */
function cleanPaymentMethod(val: any): string {
  if (!val) return "Efectivo / Transferencia";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (
      trimmed === "" ||
      trimmed === "[object Object]" ||
      trimmed.toLowerCase() === "undefined" ||
      trimmed.toLowerCase() === "null"
    ) {
      return "Efectivo / Transferencia";
    }
    return trimmed;
  }
  if (typeof val === "object") {
    const text =
      val.nombre ||
      val.metodo ||
      val.name ||
      val.descripcion ||
      val.tipo ||
      val.forma_pago ||
      val.formaPago ||
      "";
    if (typeof text === "string" && text.trim() && text !== "[object Object]") {
      return text.trim();
    }
    return "Efectivo / Transferencia";
  }
  return String(val);
}

/**
 * Limpia el nombre del plan eliminando duplicaciones como "50MbsMbs $70.000"
 * y precios repetidos concatenados, normalizándolo (ej. "50 Mbps").
 */
function cleanPlanName(plan: string): string {
  if (!plan) return "";
  let s = plan;
  // Eliminar precios con signo de pesos ej. "$70.000", "$ 80000", "$70.000 COP"
  s = s.replace(/\$\s*[\d.,]+\s*(cop|mensual|mes)?/gi, "");
  // Eliminar precios entre paréntesis ej. "(70.000)", "($70.000)"
  s = s.replace(/\(\s*\$?\s*[\d.,]+\s*(cop|mensual|mes)?\s*\)/gi, "");
  // Eliminar precios separados con guión o slash ej. "- 70.000", "/ 70.000"
  s = s.replace(/[-/|:]\s*\$?\s*[\d.,]+\s*(cop|mensual|mes)?/gi, "");
  // Eliminar números de miles sueltos que correspondan al precio (ej. "70000" o "70.000")
  s = s.replace(/\b\d{2,3}[.,]\d{3}\b/gi, "");
  s = s.replace(/\b\d{5,6}\b/gi, "");
  // Normalizar repeticiones de unidades
  s = s.replace(/mbsmbs/gi, " Mbps");
  s = s.replace(/mbpsmbps/gi, " Mbps");
  s = s.replace(/megasmegas/gi, " Megas");
  // Si dice sólo "50Mbs", convertir a "50 Mbps"
  s = s.replace(/(\d+)\s*mbs\b/gi, "$1 Mbps");
  // Limpiar guiones o separadores al final
  s = s.replace(/[-/|:]+\s*$/g, "");
  // Limpiar espacios dobles
  return s.replace(/\s+/g, " ").trim();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  // 1. Obtener datos dinámicos desde searchParams enviados por el portal / modal
  let folio = (searchParams.get("folio") || "").trim();
  let fechaEmision = (searchParams.get("fechaEmision") || searchParams.get("emision") || searchParams.get("fecha") || "").trim();
  let fechaVencimiento = (searchParams.get("fechaVencimiento") || searchParams.get("vencimiento") || "").trim();
  let periodo = (searchParams.get("periodo") || "").trim();
  let concepto = (searchParams.get("concepto") || "").trim();
  let estado = (searchParams.get("estado") || "").trim().toLowerCase();
  let nombre = (searchParams.get("nombre") || searchParams.get("cliente") || "").trim();
  let cedula = (searchParams.get("cedula") || searchParams.get("nit") || "").trim();
  let telefono = (searchParams.get("telefono") || searchParams.get("celular") || searchParams.get("tel") || "").trim();
  let direccion = (searchParams.get("direccion") || "").trim();
  let ciudad = (searchParams.get("ciudad") || "").trim();
  let plan = (searchParams.get("plan") || "").trim();
  let rawTotal = searchParams.get("total") || searchParams.get("tarifa");
  let rawSaldo = searchParams.get("saldoPendiente") || searchParams.get("saldo");

  const rawMetodoParam =
    searchParams.get("metodoPago") ||
    searchParams.get("formaPago") ||
    searchParams.get("metodo_pago") ||
    searchParams.get("forma_de_pago") ||
    "";
  let metodoPago = cleanPaymentMethod(rawMetodoParam);

  if (!folio) {
    folio = id.toUpperCase().startsWith("FAC-")
      ? id.toUpperCase()
      : `FAC-${id.toUpperCase().replace(/[^A-Z0-9]/g, "-")}`;
  }

  const folioNumber = folio.replace(/^FAC-+/i, "");

  // 2. Fallback: Si faltan datos críticos y se accede por URL directa, consultar WispHub API
  if (!rawTotal || !fechaEmision || !nombre || !rawMetodoParam || rawMetodoParam === "[object Object]") {
    try {
      const apiKey = process.env.WISPHUB_API_KEY;
      const baseUrl = (process.env.WISPHUB_BASE_URL || "https://api.wisphub.net").replace(/\/+$/, "");
      if (apiKey) {
        const invRes = await fetch(`${baseUrl}/api/facturas/${encodeURIComponent(id)}/`, {
          headers: {
            Authorization: `Api-Key ${apiKey}`,
            "Api-Key": apiKey,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (invRes.ok) {
          const rawInv = await invRes.json();
          if (rawInv.folio && !searchParams.get("folio")) folio = String(rawInv.folio);
          if (!rawTotal && rawInv.total) rawTotal = String(rawInv.total);
          if (!fechaEmision && (rawInv.fecha_emision || rawInv.fecha)) {
            fechaEmision = rawInv.fecha_emision || rawInv.fecha;
          }
          if (!fechaVencimiento && (rawInv.fecha_vencimiento || rawInv.fecha_limite)) {
            fechaVencimiento = rawInv.fecha_vencimiento || rawInv.fecha_limite;
          }
          if (!periodo && rawInv.periodo) periodo = String(rawInv.periodo);
          if (!concepto && (rawInv.concepto || rawInv.descripcion)) {
            concepto = rawInv.concepto || rawInv.descripcion;
          }
          if (!concepto && Array.isArray(rawInv.articulos) && rawInv.articulos.length > 0) {
            const fullDesc = String(rawInv.articulos[0]?.descripcion || "");
            const firstLine = fullDesc.split("\r\n")[0] || fullDesc.split("\n")[0] || "";
            if (firstLine.trim()) concepto = firstLine.trim();
          }
          if (!estado && rawInv.estado) estado = String(rawInv.estado).toLowerCase();
          
          if (!rawMetodoParam || rawMetodoParam === "[object Object]") {
            const rawFp = rawInv.forma_pago || rawInv.metodo_pago || rawInv.forma_de_pago;
            metodoPago = cleanPaymentMethod(rawFp);
          }

          // Resolver datos del cliente
          const rawCli = rawInv.cliente;
          if (rawCli && typeof rawCli === "object") {
            if (!nombre) nombre = rawCli.nombre || rawCli.nombre_completo || "";
            if (!cedula) cedula = String(rawCli.cedula || "");
            if (!telefono) telefono = String(rawCli.telefono || rawCli.celular || "");
            if (!direccion) direccion = rawCli.direccion || "";
            if (!ciudad) ciudad = rawCli.ciudad || "";
            if (!plan && (rawCli.plan_internet?.nombre || rawCli.plan_nombre)) {
              plan = rawCli.plan_internet?.nombre || rawCli.plan_nombre;
            }
          } else if (rawCli || rawInv.id_cliente) {
            const clientId = rawCli || rawInv.id_cliente;
            const cRes = await fetch(`${baseUrl}/api/clientes/${encodeURIComponent(clientId)}/`, {
              headers: {
                Authorization: `Api-Key ${apiKey}`,
                "Api-Key": apiKey,
                Accept: "application/json",
              },
              cache: "no-store",
            });
            if (cRes.ok) {
              const cData = await cRes.json();
              if (!nombre) nombre = cData.nombre || cData.nombre_completo || "";
              if (!cedula) cedula = String(cData.cedula || "");
              if (!telefono) telefono = String(cData.telefono || cData.celular || "");
              if (!direccion) direccion = cData.direccion || "";
              if (!ciudad) ciudad = cData.ciudad || "";
              if (!plan && (cData.plan_internet?.nombre || cData.plan_nombre)) {
                plan = cData.plan_internet?.nombre || cData.plan_nombre;
              }
            }
          }
        }
      }
    } catch (apiErr) {
      console.warn("[PDF Route WispHub Fallback Warning]:", apiErr);
    }
  }

  // 3. Normalizar valores
  const total = parseFloat(String(rawTotal || "0").replace(/[^0-9.-]+/g, "")) || 0;
  const saldo = parseFloat(String(rawSaldo || rawTotal || "0").replace(/[^0-9.-]+/g, "")) || 0;

  const nombreDisplay = (nombre || "Cliente Registrado").replace(/^Abonado\b/i, "Cliente");
  const cedulaDisplay = cedula || "N/A";
  const direccionDisplay = direccion || (ciudad ? `Curillo, ${ciudad}` : "Curillo, Caquetá");
  const municipioDisplay = "Curillo - Caquetá";
  const telefonoDisplay = telefono || "318 557 7157";
  const emisionFormatted = formatDate(fechaEmision || new Date().toISOString());
  const vencimientoFormatted = formatDate(fechaVencimiento || new Date().toISOString());
  const periodoDisplay = formatInvoiceMonth(periodo, fechaEmision, fechaVencimiento);
  const metodoPagoDisplay = metodoPago;
  const conceptoDisplay = concepto || (plan ? `Servicio de Internet Fibra Óptica - ${cleanPlanName(plan)}` : "Servicio Internet Fibra Óptica Residencial - Canal Dedicado");

  const isPaid =
    estado === "pagada" ||
    estado === "pago" ||
    estado === "pagado" ||
    estado === "1" ||
    estado === "cobrada" ||
    estado === "cancelada" ||
    (saldo === 0 && total > 0);

  const conceptoReal = conceptoDisplay && conceptoDisplay.trim()
    ? conceptoDisplay.trim()
    : "Servicio Internet Fibra Óptica Residencial - Canal Dedicado";

  // Detección si la factura es por cámaras, equipos o servicios técnicos
  const conceptoLower = conceptoReal.toLowerCase();
  const isEquipmentOrCustom =
    conceptoLower.includes("camara") ||
    conceptoLower.includes("cámara") ||
    conceptoLower.includes("cctv") ||
    conceptoLower.includes("dvr") ||
    conceptoLower.includes("nvr") ||
    conceptoLower.includes("kit") ||
    conceptoLower.includes("equipo") ||
    conceptoLower.includes("router") ||
    conceptoLower.includes("cable") ||
    conceptoLower.includes("antena") ||
    conceptoLower.includes("ont") ||
    conceptoLower.includes("instalaci") ||
    conceptoLower.includes("mano de obra") ||
    conceptoLower.includes("soporte");

  const planDisplay = cleanPlanName(plan || "");

  // Consultar canales de pago dinámicos desde Redis
  const redisSettings = (await redisGet<GlobalSettings>("isp:global_settings").catch(() => null)) || DEFAULT_GLOBAL_SETTINGS;
  const nequiNumber = redisSettings?.canalesPago?.nequi || "311 276 0959";
  const bancolombiaNumber = redisSettings?.canalesPago?.bancolombia || "84758122483";
  const brebNumber = redisSettings?.canalesPago?.breB || "311 276 0959";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${folio} - ${branding.companyName}</title>
  <style>
    /* ─── AISLAMIENTO ESTRICTO DE IMPRESIÓN (1 SOLA PÁGINA) ─── */
    @page {
      size: letter portrait;
      margin: 0mm !important;
    }

    @media print {
      /* 1. Congelar y recortar el viewport para evitar páginas en blanco */
      html, body {
        height: 100% !important;
        max-height: 100% !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* 2. Ocultar absolutamente todo en el árbol del DOM */
      body * {
        visibility: hidden !important;
      }

      /* 3. Hacer visible ÚNICAMENTE el contenedor del comprobante */
      #comprobante-oficial, #comprobante-oficial * {
        visibility: visible !important;
      }

      /* 4. Fijar el comprobante en la mitad superior de la primera página */
      #comprobante-oficial {
        display: block !important;
        position: absolute !important;
        top: 10mm !important;
        left: 0 !important;
        right: 0 !important;
        width: 92% !important;
        max-width: 195mm !important;
        max-height: 130mm !important;
        margin: 0 auto !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 8px !important;
        padding: 16px !important;
        page-break-before: avoid !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        break-after: avoid !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .no-print {
        display: none !important;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 24px 16px;
      background: #f1f5f9;
      color: #1e293b;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .num-solid {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    .sheet-preview {
      width: 100%;
      max-width: 820px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* ─── ESTRUCTURA LIMPIA Y DIRECTA (#comprobante-oficial) ─── */
    #comprobante-oficial {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 20px;
      color: #1e293b;
      font-size: 12px;
      width: 100%;
      max-width: 740px;
      margin: 0 auto;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
    }

    /* Encabezado Simplificado y Compacto */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #e2e8f0;
      padding-top: 0;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }

    .brand-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-img {
      height: 48px;
      width: auto;
      object-fit: contain;
      display: block;
      flex-shrink: 0;
    }

    .company-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      line-height: 1.2;
    }

    .company-sub1 {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
      line-height: 1.2;
    }

    .company-sub2 {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.2;
    }

    .header-right {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
    }

    .header-right-folio {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-top: 0;
    }

    .seal-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin-top: 3px;
    }

    .seal-paid {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #86efac;
    }

    .seal-pending {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fcd34d;
    }

    /* Cajas de Información en 2 Columnas Compactas */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 12px;
      line-height: 1.4;
    }

    .info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
    }

    .info-col-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin-bottom: 6px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 2px;
    }

    .info-line {
      margin-bottom: 3px;
      color: #334155;
    }

    .info-label {
      font-weight: 600;
      color: #475569;
    }

    .status-paid {
      color: #059669;
      font-weight: 700;
    }

    .status-pending {
      color: #d97706;
      font-weight: 700;
    }

    /* Tabla de Detalle Contable */
    .table-container {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin: 8px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11.5px;
    }

    th {
      background: #f1f5f9;
      padding: 6px 10px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
      border-bottom: 1px solid #cbd5e1;
    }

    th.col-border, td.col-border {
      border-left: 1px solid #cbd5e1;
    }

    td {
      padding: 10px;
      font-size: 12px;
      color: #1e293b;
      vertical-align: middle;
      word-break: break-word;
      white-space: normal;
      line-height: 1.4;
    }

    .concept-title {
      font-weight: 600;
      color: #0f172a;
    }

    /* Zona Inferior: Canales a la Izquierda y Total Directo a la Derecha */
    .bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin: 10px 0 2px 0;
      padding-top: 2px;
    }

    .channels-container {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: #334155;
      font-size: 11px;
    }

    .channels-label {
      padding-top: 1px;
      flex-shrink: 0;
    }

    .channels-rows {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .channel-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .channel-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .channel-icon {
      width: 14px;
      height: 14px;
      object-fit: contain;
      border-radius: 2px;
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }

    .total-box {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .total-label {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      color: #1e293b;
      letter-spacing: 0.3px;
    }

    .total-amount {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }

    .web-wrapper {
      margin-bottom: 14px;
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      text-decoration: none;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="sheet-preview">
    <!-- Barra superior sólo para web -->
    <div class="web-wrapper no-print">
      <button onclick="window.print()" class="btn-print">
        🖨️ Imprimir Comprobante
      </button>
    </div>

    <!-- ─── ESTRUCTURA LIMPIA Y DIRECTA (#comprobante-oficial) ─── -->
    <div id="comprobante-oficial">
      <!-- Encabezado Simplificado -->
      <div class="header-row">
        <div class="brand-left">
          <img src="/logo.jpg" alt="${branding.companyName}" class="logo-img">
          <div>
            <h1 class="company-title">Internet Aponte Plus</h1>
            <div class="company-sub1">
              NIT: 901.458.789-2 • Curillo, Caquetá
            </div>
            <div class="company-sub2">
              WhatsApp: 318 557 7157
            </div>
          </div>
        </div>

        <div class="header-right">
          <div class="header-right-folio">No. FAC-${folioNumber}</div>
          <span class="seal-badge ${isPaid ? 'seal-paid' : 'seal-pending'}">
            ${isPaid ? '✓ CANCELADA / PAGADA' : 'PENDIENTE DE PAGO'}
          </span>
        </div>
      </div>

      <!-- Cajas de Información en 2 Columnas -->
      <div class="info-grid">
        <!-- Caja 1: ADQUIRENTE / CLIENTE -->
        <div class="info-box">
          <div class="info-col-title">ADQUIRENTE / CLIENTE</div>
          <div class="info-line"><span class="info-label">Nombre:</span> <strong>${nombreDisplay}</strong></div>
          <div class="info-line"><span class="info-label">Cédula / NIT:</span> <strong class="num-solid">${cedulaDisplay}</strong></div>
          <div class="info-line"><span class="info-label">Dirección:</span> ${direccionDisplay}</div>
          <div class="info-line"><span class="info-label">Municipio:</span> ${municipioDisplay}</div>
          <div class="info-line"><span class="info-label">Teléfono:</span> <strong class="num-solid">${telefonoDisplay}</strong></div>
          ${!isEquipmentOrCustom && planDisplay ? `<div class="info-line"><span class="info-label">Plan Contratado:</span> <strong>${planDisplay}</strong></div>` : ''}
        </div>

        <!-- Caja 2: DATOS DE LA OPERACIÓN -->
        <div class="info-box">
          <div class="info-col-title">DATOS DE LA OPERACIÓN</div>
          <div class="info-line"><span class="info-label">Periodo Facturado:</span> <strong>${periodoDisplay}</strong></div>
          <div class="info-line"><span class="info-label">Forma de Pago:</span> <strong>${metodoPagoDisplay}</strong></div>
          <div class="info-line"><span class="info-label">Estado:</span> <span class="${isPaid ? 'status-paid' : 'status-pending'}">${isPaid ? 'CANCELADA / PAGADA' : 'PENDIENTE DE PAGO'}</span></div>
        </div>
      </div>

      <!-- Tabla de Cobro Directa -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">ÍTEM</th>
              <th class="col-border" style="width: 52%;">DESCRIPCIÓN DEL SERVICIO O PRODUCTO</th>
              <th class="col-border" style="width: 8%; text-align: center;">CANT.</th>
              <th class="col-border" style="width: 16%; text-align: right;">VR. UNITARIO</th>
              <th class="col-border" style="width: 16%; text-align: right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center;" class="num-solid">1</td>
              <td class="col-border">
                <span class="concept-title">${conceptoReal}</span>
              </td>
              <td class="col-border num-solid" style="text-align: center;">1</td>
              <td class="col-border num-solid" style="text-align: right;">${formatCurrency(total)}</td>
              <td class="col-border num-solid" style="text-align: right;">${formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Zona Inferior: Canales a la Izquierda y Total Directo a la Derecha -->
      <div class="bottom-row">
        <!-- Izquierda: Canales de Pago con Iconos (Bre-B debajo de Nequi) -->
        <div class="channels-container">
          <span class="channels-label"><strong>Canales de Pago:</strong></span>
          <div class="channels-rows">
            <div class="channel-row">
              <span class="channel-item">
                <img src="/nequi-icon.png" alt="Nequi" class="channel-icon" />
                <span>Nequi: <strong class="num-solid">${nequiNumber}</strong></span>
              </span>
              <span style="color: #cbd5e1;">•</span>
              <span class="channel-item">
                <img src="/bancolombia-icon.png" alt="Bancolombia" class="channel-icon" />
                <span>Bancolombia: <strong class="num-solid">${bancolombiaNumber}</strong></span>
              </span>
            </div>
            <div class="channel-row">
              <span class="channel-item">
                <img src="/breb-icon.png" alt="Bre-B" class="channel-icon" />
                <span>Bre-B: <strong class="num-solid">${brebNumber}</strong></span>
              </span>
            </div>
          </div>
        </div>

        <!-- Derecha: Recuadro simple con TOTAL -->
        <div class="total-box">
          <span class="total-label">${isPaid ? "TOTAL PAGADO:" : "TOTAL A PAGAR:"}</span>
          <span class="total-amount num-solid">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
