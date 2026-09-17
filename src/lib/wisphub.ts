import {
  ClientProfile,
  Invoice,
  PaymentReportSubmission,
  PaymentReportResult,
  ServiceStatus,
  InvoiceStatus,
  NetworkUsageData,
  DayUsage,
} from "./types";
import { generateRadicado, formatInvoiceMonth } from "./utils";
import { scrapeTrafficWeek } from "./wisphub-scraper";

/**
 * Interfaces para tipado estricto de las respuestas de la API de WispHub
 */
export interface WisphubClientItem {
  id?: number | string;
  id_servicio?: number | string;
  usuario?: string;
  cedula?: string | number;
  nombre?: string;
  nombre_completo?: string;
  apellidos?: string;
  email?: string;
  correo?: string;
  telefono?: string;
  celular?: string;
  telefono_referencia?: string;
  direccion?: string;
  direccion_completa?: string;
  ciudad?: string;
  localidad?: string;
  barrio?: string;
  estado?: string | number;
  ip?: string;
  ip_local?: string;
  plan_internet?: {
    id?: number | string;
    nombre?: string;
    bajada?: string;
    subida?: string;
    precio?: number | string;
  } | string;
  plan_nombre?: string;
  precio_plan?: number | string;
  costo_servicio?: number | string;
  saldo?: number | string;
  saldo_pendiente?: number | string;
  fecha_corte?: string;
  dia_corte?: number | string;
  dia_pago?: number | string;
  fecha_limite?: string;
  nodo?: {
    id?: number | string;
    nombre?: string;
  } | string;
  sectorial?: string;
  modelo_router?: string;
  modelo_antena?: string;
  router?: string;
  servicios?: Array<any>;
  [key: string]: any;
}

export interface WisphubInvoiceItem {
  id?: number | string;
  id_factura?: number | string;
  id_servicio?: number | string;
  folio?: string;
  cliente?: number | string;
  fecha?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  fecha_limite?: string;
  periodo?: string;
  subtotal?: number | string;
  iva?: number | string;
  total: number | string;
  saldo_pendiente?: number | string;
  saldo?: number | string;
  estado: string | number;
  concepto?: string;
  descripcion?: string;
  pdf_url?: string;
  url_factura?: string;
  [key: string]: any;
}

export interface WisphubPaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

/**
 * Obtiene la URL base configurada para la API de WispHub
 * Prioriza WISPHUB_BASE_URL ("https://api.wisphub.net"), soportando WISPHUB_API_URL
 */
export function getWisphubBaseUrl(): string {
  const url = process.env.WISPHUB_BASE_URL || process.env.WISPHUB_API_URL || "https://api.wisphub.net";
  return url.replace(/\/+$/, "");
}

/**
 * Construye URLs completas normalizando prefijos '/api'
 */
export function buildWisphubUrl(endpoint: string): string {
  const base = getWisphubBaseUrl();
  const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (base.endsWith("/api") && cleanPath.startsWith("/api/")) {
    return `${base}${cleanPath.slice(4)}`;
  }
  if (!base.endsWith("/api") && !cleanPath.startsWith("/api/")) {
    return `${base}/api${cleanPath}`;
  }
  return `${base}${cleanPath}`;
}

/**
 * Cabeceras requeridas por WispHub para autenticación con Api-Key
 */
export function getWisphubHeaders(): Record<string, string> {
  const apiKey = process.env.WISPHUB_API_KEY || "";
  return {
    "Api-Key": apiKey,
    "Authorization": `Api-Key ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

/**
 * Almacén en memoria para asociar comprobantes reportados en la sesión
 */
const reportedPaymentsStore: Record<string, {
  radicado: string;
  idFactura: string;
  monto: number;
  referencia: string;
  fecha: string;
  estado: string;
}> = {};

/**
 * Cliente HTTP para realizar peticiones autenticadas a WispHub
 */
export async function fetchWisphub<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.WISPHUB_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Error de sincronización con el servidor: Credenciales no configuradas en el servidor.");
  }

  const url = buildWisphubUrl(endpoint);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getWisphubHeaders(),
        ...(options.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Error de sincronización con el servidor: Credenciales no autorizadas o permisos insuficientes (HTTP ${response.status}).`);
      }
      if (response.status === 404) {
        const error: any = new Error("Error de sincronización con el servidor: Recurso no encontrado en el servidor (HTTP 404).");
        error.status = 404;
        throw error;
      }
      throw new Error(`Error de sincronización con el servidor: Servidor remoto respondió con estado HTTP ${response.status}.`);
    }

    const data = await response.json();
    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Error de sincronización con el servidor: Tiempo de espera agotado al conectar con el servidor.");
    }
    if (err.message && err.message.startsWith("Error de sincronización con el servidor")) {
      throw err;
    }
    throw new Error(`Error de sincronización con el servidor: No fue posible comunicar con el servicio (${err.message || "Fallo de conexión"}).`);
  }
}

/**
 * Busca un cliente por cédula en WispHub
 * Endpoint: /api/clientes/?cedula={cedula}
 */
export async function searchWisphubClient(cedula: string): Promise<WisphubClientItem | null> {
  const cleanDoc = cedula.trim();
  if (!cleanDoc) return null;

  const data = await fetchWisphub<any>(`/api/clientes/?cedula=${encodeURIComponent(cleanDoc)}`);

  const results: WisphubClientItem[] = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : data?.id
    ? [data]
    : [];

  if (results.length === 0) {
    return null;
  }

  // 1. Buscar coincidencia que contenga el nombre real del titular (evitando alias como negocio, casa, etc.)
  const titularMatch = results.find((c) => {
    const n = (c.nombre || c.nombre_completo || "").toLowerCase();
    const docMatch = String(c.cedula || "").trim() === cleanDoc;
    return (
      docMatch &&
      !n.includes("negocio") &&
      !n.includes("casa") &&
      !n.includes("local") &&
      !n.includes("tienda") &&
      !n.includes("finca") &&
      !n.includes("taller") &&
      !n.includes("oficina")
    );
  });

  // 2. Buscar coincidencia exacta de documento
  const exactMatch = results.find(
    (c) => String(c.cedula || "").trim() === cleanDoc
  );

  const best = titularMatch || exactMatch || results[0];

  // 3. Si algún registro de esta cédula contiene teléfono o celular, enriquecer el cliente principal
  const withPhone = results.find((c) => c.telefono || c.celular || c.telefono_referencia);
  if (best && withPhone) {
    if (!best.telefono && withPhone.telefono) best.telefono = withPhone.telefono;
    if (!best.celular && withPhone.celular) best.celular = withPhone.celular;
  }

  if (best && (!best.cedula || String(best.cedula).trim() === "")) {
    best.cedula = cleanDoc;
  }

  return best;
}

/**
 * Sanitiza cualquier texto que venga de WispHub para eliminar etiquetas HTML (<p>, <div>), entidades y espacios raros.
 */
export const limpiarTexto = (texto: any): string => {
  if (!texto) return "";
  return String(texto)
    .replace(/<[^>]*>?/gm, "") // Borra etiquetas <p>, <div>, etc.
    .replace(/&nbsp;/g, " ")   // Borra espacios HTML
    .trim();
};

export interface WisphubServiceSummary {
  idServicio: string;
  id_servicio?: string;
  id?: string;
  idCliente?: string;
  usuario?: string;
  nombre?: string;
  nombre_completo?: string;
  direccion: string;
  alias?: string;
  planNombre: string;
  plan_internet?: string;
  plan?: string;
  estado: string;
  ip?: string;
  nodo?: string;
}

/**
 * Busca todos los servicios / contratos asociados a un número de documento en WispHub.
 * PROHIBIDO usar comentarios, notas técnicas o credenciales internas.
 * Mapea la dirección oficial / alias, titular, ID y plan contratado.
 */
export async function searchWisphubServicesByDocument(cedula: string): Promise<WisphubServiceSummary[]> {
  const cleanDoc = cedula.trim();
  if (!cleanDoc) return [];

  const data = await fetchWisphub<any>(`/api/clientes/?cedula=${encodeURIComponent(cleanDoc)}`);

  const results: WisphubClientItem[] = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : data?.id
    ? [data]
    : [];

  if (results.length === 0) return [];

  const summaries: WisphubServiceSummary[] = [];

  for (const item of results) {
    // Si el item tiene un arreglo interno de servicios (servicios: [...])
    if (Array.isArray(item.servicios) && item.servicios.length > 1) {
      for (const s of item.servicios) {
        const sId = String(s.id_servicio || s.id || item.id_servicio || item.id || "");
        const dir = limpiarTexto(s.direccion || item.direccion || item.direccion_completa || "Dirección Registrada");
        const alias = limpiarTexto(s.nombre || s.alias || dir);
        const titular = limpiarTexto(s.nombre || s.nombre_completo || item.nombre || item.nombre_completo || "");
        
        let plan = "Fibra Óptica";
        if (s.plan_internet && typeof s.plan_internet === "object") {
          plan = limpiarTexto(extractSafeString(s.plan_internet.nombre, plan));
        } else if (typeof s.plan_internet === "string") {
          plan = limpiarTexto(extractSafeString(s.plan_internet, plan));
        } else if (s.plan_nombre || s.plan) {
          plan = limpiarTexto(extractSafeString(s.plan_nombre || s.plan, plan));
        }

        const rawEst = String(s.estado ?? item.estado ?? "activo").toLowerCase();
        const estado = rawEst.includes("cort") || rawEst === "2"
          ? "Suspendido"
          : rawEst.includes("susp") || rawEst === "3"
          ? "Suspendido"
          : "Activo";

        summaries.push({
          idServicio: sId,
          id_servicio: sId,
          id: sId,
          idCliente: String(item.id || sId),
          usuario: s.usuario || item.usuario || undefined,
          nombre: titular,
          nombre_completo: titular,
          direccion: dir.replace(/\r\n|\r|\n/g, " - ").replace(/\s{2,}/g, " ").trim(),
          alias: alias.replace(/\r\n|\r|\n/g, " - ").replace(/\s{2,}/g, " ").trim(),
          planNombre: plan,
          plan_internet: plan,
          plan,
          estado,
          ip: s.ip || item.ip,
          nodo: limpiarTexto(extractSafeString(s.nodo || item.nodo)),
        });
      }
    } else {
      const sId = String(item.id_servicio || item.id || "");
      const dir = limpiarTexto(
        item.direccion || item.direccion_completa || item.barrio || item.ciudad || "Dirección Registrada"
      );
      const alias = limpiarTexto(
        item.nombre_comercial || item.alias || item.barrio || dir
      );
      const titular = limpiarTexto(
        item.nombre || item.nombre_completo || ""
      );

      let plan = "Fibra Óptica";
      if (item.plan_internet && typeof item.plan_internet === "object") {
        plan = limpiarTexto(extractSafeString(item.plan_internet.nombre, plan));
      } else if (typeof item.plan_internet === "string") {
        plan = limpiarTexto(extractSafeString(item.plan_internet, plan));
      } else if (item.plan_nombre || item.plan) {
        plan = limpiarTexto(extractSafeString(item.plan_nombre || item.plan, plan));
      }

      const rawEst = String(item.estado ?? "activo").toLowerCase();
      const estado = rawEst.includes("cort") || rawEst === "2"
        ? "Suspendido"
        : rawEst.includes("susp") || rawEst === "3"
        ? "Suspendido"
        : "Activo";

      summaries.push({
        idServicio: sId,
        id_servicio: sId,
        id: sId,
        idCliente: String(item.id || sId),
        usuario: item.usuario || undefined,
        nombre: titular,
        nombre_completo: titular,
        direccion: dir.replace(/\r\n|\r|\n/g, " - ").replace(/\s{2,}/g, " ").trim(),
        alias: alias.replace(/\r\n|\r|\n/g, " - ").replace(/\s{2,}/g, " ").trim(),
        planNombre: plan,
        plan_internet: plan,
        plan,
        estado,
        ip: item.ip,
        nodo: limpiarTexto(extractSafeString(item.nodo)),
      });
    }
  }

  // Deduplicar por idServicio
  const seen = new Set<string>();
  return summaries.filter((s) => {
    if (!s.idServicio || seen.has(s.idServicio)) return false;
    seen.add(s.idServicio);
    return true;
  });
}

/**
 * Consulta información detallada de un cliente o servicio
 * Endpoint: /api/clientes/{id}/
 */
export async function getWisphubClientDetail(id: string | number): Promise<WisphubClientItem | null> {
  try {
    const data = await fetchWisphub<WisphubClientItem>(`/api/clientes/${id}/`);
    return data || null;
  } catch (err: any) {
    if (err.status === 404) return null;
    console.warn(`[WispHub] No se pudo obtener detalle para cliente ${id}:`, err.message);
    return null;
  }
}

/**
 * Consulta el saldo actual del servicio
 * Endpoint: /api/clientes/{id_servicio}/saldo/
 */
export async function getWisphubClientBalance(idServicio: string | number): Promise<number | null> {
  try {
    const data = await fetchWisphub<any>(`/api/clientes/${idServicio}/saldo/`);
    const val = data?.saldo ?? data?.saldo_pendiente ?? data?.total;
    if (val !== undefined && val !== null) {
      const parsed = parseFloat(String(val));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Realiza peticiones paginadas a WispHub recorriendo los enlaces 'next'
 * hasta extraer el 100% de los elementos disponibles del abonado (hasta 50 páginas de seguridad).
 */
async function fetchAllWisphubPages(initialPathOrUrl: string, maxPages = 50): Promise<any[]> {
  const allResults: any[] = [];
  let currentTarget: string | null = initialPathOrUrl;
  let pageCount = 0;

  while (currentTarget && pageCount < maxPages) {
    pageCount++;
    try {
      let endpoint: string = currentTarget;
      if (currentTarget.startsWith("http://") || currentTarget.startsWith("https://")) {
        const parsed = new URL(currentTarget);
        endpoint = parsed.pathname + parsed.search;
      }

      const data: any = await fetchWisphub<any>(endpoint);
      if (Array.isArray(data?.results)) {
        allResults.push(...data.results);
        currentTarget = data.next ? String(data.next) : null;
      } else if (Array.isArray(data)) {
        allResults.push(...data);
        currentTarget = null;
      } else if (data?.id) {
        allResults.push(data);
        currentTarget = null;
      } else {
        currentTarget = null;
      }
    } catch (err: any) {
      console.warn(`[WispHub Pagination] Advertencia al obtener página ${pageCount} (${currentTarget}):`, err.message);
      break;
    }
  }

  return allResults;
}

/**
 * Mapea una factura cruda de WispHub al tipo estandarizado Invoice.
 * IMPORTANTE: En Internet Aponte Plus los planes son a tarifa plana y fija (exentos de IVA).
 * Se eliminan de raíz subtotales e impuestos ficticios; el valor de WispHub se toma como monto neto exacto.
 */
export function mapWisphubInvoice(raw: WisphubInvoiceItem): Invoice {
  const idStr = String(raw.id_factura || raw.id || `inv_${Date.now()}`);
  const totalNum = parseFloat(String(raw.total || 0)) || 0;

  // Tarifa plana: subtotal es igual al total y el IVA es 0 (exento)
  const subtotalNum = totalNum;
  const ivaNum = 0;

  // Normalizar estado
  const rawEstado = String(raw.estado ?? "").toLowerCase().trim();
  const isPaid =
    rawEstado === "pagada" ||
    rawEstado === "1" ||
    rawEstado === "pago" ||
    rawEstado === "pagado" ||
    rawEstado === "cancelada" ||
    rawEstado === "cobrada";

  const dueDateStr = raw.fecha_vencimiento || raw.fecha_limite || new Date().toISOString().split("T")[0];
  const isOverdue = !isPaid && new Date(dueDateStr) < new Date();

  const estado: InvoiceStatus = isPaid ? "pagada" : isOverdue ? "vencida" : "pendiente";

  const rawSaldo = raw.saldo_pendiente ?? raw.saldo;
  const saldoPendiente = isPaid
    ? 0
    : rawSaldo !== undefined && rawSaldo !== null && parseFloat(String(rawSaldo)) > 0
    ? parseFloat(String(rawSaldo))
    : totalNum;

  // Extraer periodo facturado (desde periodo o desde la descripción del artículo en WispHub)
  let periodoStr = extractSafeString(raw.periodo);
  if (!periodoStr && Array.isArray(raw.articulos) && raw.articulos.length > 0) {
    const desc = String(raw.articulos[0]?.descripcion || "");
    const match = desc.match(/Periodo\s+(?:del\s+)?([^\r\n]+)/i);
    if (match) {
      periodoStr = match[1].trim();
    }
  }
  if (!periodoStr || periodoStr.toLowerCase().includes("mes en curso")) {
    periodoStr = formatInvoiceMonth(periodoStr, raw.fecha_emision || raw.fecha || raw.created_at, dueDateStr);
  }

  // Concepto limpio
  let conceptoStr = raw.concepto || raw.descripcion || "";
  if (!conceptoStr && Array.isArray(raw.articulos) && raw.articulos.length > 0) {
    const fullDesc = String(raw.articulos[0]?.descripcion || "");
    const firstLine = fullDesc.split("\r\n")[0] || fullDesc.split("\n")[0] || "";
    conceptoStr = firstLine.trim();
  }
  if (!conceptoStr) {
    conceptoStr = `Servicio de Internet Banda Ancha - ${periodoStr}`;
  }

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
    periodo: periodoStr,
    fechaEmision: raw.fecha_emision || raw.fecha || new Date().toISOString().split("T")[0],
    fechaVencimiento: dueDateStr,
    fechaPago: fechaPagoStr,
    subtotal: subtotalNum,
    impuestos: ivaNum,
    total: totalNum,
    saldoPendiente,
    estado,
    concepto: conceptoStr,
    pdfUrl,
    pdfFactura,
    tieneReportePendiente: isInvoiceReported(idStr),
  };
}

/**
 * Consulta el listado de facturas asociadas EXCLUSIVAMENTE al servicio/cliente en WispHub.
 * Recorre la paginación completa ('next') para traer el 100% de las facturas (ej. 39 facturas).
 * Aplica filtrado estricto en memoria y las ordena cronológicamente descendente (más reciente primero).
 */
export async function getWisphubInvoices(
  idServicio?: string | number | null,
  idCliente?: string | number | null,
  cedula?: string | null,
  usuario?: string | null
): Promise<Invoice[]> {
  let targetServiceId = String(idServicio || "").trim();
  let targetClientId = String(idCliente || "").trim();
  let targetCedula = String(cedula || "").trim();
  let targetUsuario = String(usuario || "").trim();

  // Si no se suministra ningún identificador, retorna arreglo vacío (0 facturas), nunca datos de terceros
  if (!targetServiceId && !targetClientId && !targetCedula && !targetUsuario) {
    return [];
  }

  // Si no tenemos usuario pero tenemos cédula o id_servicio, resolver el usuario dinámicamente
  if (!targetUsuario && targetCedula) {
    try {
      const basicClient = await searchWisphubClient(targetCedula);
      if (basicClient) {
        if (basicClient.usuario) targetUsuario = String(basicClient.usuario).trim();
        if (!targetServiceId) targetServiceId = String(basicClient.id_servicio || basicClient.id || "").trim();
        if (!targetClientId) targetClientId = String(basicClient.id || targetClientId || "").trim();
      }
    } catch {}
  } else if (!targetUsuario && targetServiceId) {
    try {
      const detailClient = await getWisphubClientDetail(targetServiceId);
      if (detailClient) {
        if (detailClient.usuario) targetUsuario = String(detailClient.usuario).trim();
        if (!targetCedula && detailClient.cedula) targetCedula = String(detailClient.cedula).trim();
        if (!targetClientId) targetClientId = String(detailClient.id || targetClientId || "").trim();
      }
    } catch {}
  }

  let rawInvoices: WisphubInvoiceItem[] = [];
  const rangeParam = "fecha_vencimiento__range_0=2020-01-01&fecha_vencimiento__range_1=2030-12-31";

  // 1. Consulta directa y rápida por usuario de WispHub con rango de fechas histórico completo
  if (targetUsuario) {
    try {
      const userUrl = `/api/facturas/?cliente=${encodeURIComponent(targetUsuario)}&${rangeParam}`;
      const list = await fetchAllWisphubPages(userUrl);
      if (list.length > 0) {
        rawInvoices = list;
      }
    } catch (err: any) {
      console.warn(`[WispHub] Error al consultar facturas para usuario ${targetUsuario}:`, err.message);
    }
  }

  // 2. Si no devolvió por usuario o no había usuario, intentar por id_servicio con rango histórico
  if (rawInvoices.length === 0 && targetServiceId) {
    try {
      const serviceUrl = `/api/facturas/?id_servicio=${encodeURIComponent(targetServiceId)}&${rangeParam}`;
      const list = await fetchAllWisphubPages(serviceUrl);
      if (list.length > 0) {
        rawInvoices = list;
      }
    } catch (err: any) {
      console.warn(`[WispHub] Error al consultar facturas para servicio ${targetServiceId}:`, err.message);
    }
  }

  // 3. Fallback general a /api/facturas/
  if (rawInvoices.length === 0) {
    try {
      const list = await fetchAllWisphubPages("/api/facturas/");
      if (list.length > 0) {
        rawInvoices = list;
      }
    } catch (err: any) {
      console.warn("[WispHub] Error en consulta fallback de facturas:", err.message);
    }
  }

  // Si la API no devolvió facturas, retornar vacío
  if (rawInvoices.length === 0) {
    return [];
  }

  // FILTRADO ESTRICTO DE SEGURIDAD EN MEMORIA (Aislamiento de abonados):
  // Se descarta cualquier factura cuyo servicio, cliente o cédula no pertenezca de forma exacta al abonado
  const strictlyOwnedInvoices = rawInvoices.filter((raw: any) => {
    // 1. Extraer ID del servicio en campo directo o dentro del array de articulos
    let invServiceIds: string[] = [];
    if (raw.id_servicio !== undefined && raw.id_servicio !== null) {
      invServiceIds.push(String(raw.id_servicio).trim());
    }
    if (raw.servicio) {
      const sId = String(typeof raw.servicio === "object" ? raw.servicio?.id_servicio || raw.servicio?.id : raw.servicio).trim();
      if (sId) invServiceIds.push(sId);
    }
    if (Array.isArray(raw.articulos)) {
      for (const art of raw.articulos) {
        const artServ = art?.servicio;
        if (artServ) {
          const aId = String(typeof artServ === "object" ? artServ?.id_servicio || artServ?.id : artServ).trim();
          if (aId) invServiceIds.push(aId);
        }
      }
    }

    // 2. Extraer ID del cliente
    const invClientId = String(
      raw.id_cliente ||
      raw.cliente_id ||
      (typeof raw.cliente === "object" ? raw.cliente?.id || raw.cliente?.id_cliente : raw.cliente) ||
      ""
    ).trim();

    // 3. Extraer Cédula del cliente
    const invCedula = String(
      raw.cedula ||
      (typeof raw.cliente === "object" ? raw.cliente?.cedula : "") ||
      ""
    ).trim();

    // 4. Extraer usuario de WispHub
    const invUsuario = String(
      (typeof raw.cliente === "object" ? raw.cliente?.usuario : "") || ""
    ).trim();

    // Si se especificó un id_servicio concreto y la factura tiene servicios vinculados explícitamente,
    // el match debe ser estricto para evitar mezclar facturas de otras líneas de la misma cédula
    if (targetServiceId && invServiceIds.length > 0) {
      return invServiceIds.includes(targetServiceId) || invClientId === targetServiceId;
    }

    const matchService = Boolean(targetServiceId && invServiceIds.includes(targetServiceId));
    const matchClient = Boolean(targetClientId && invClientId && invClientId === targetClientId);
    const matchCedula = Boolean(targetCedula && invCedula && invCedula === targetCedula);
    const matchCrossService = Boolean(targetServiceId && invClientId && invClientId === targetServiceId);
    const matchCrossClient = Boolean(targetClientId && invServiceIds.includes(targetClientId));
    const matchUsuario = Boolean(targetUsuario && invUsuario && invUsuario.toLowerCase() === targetUsuario.toLowerCase());

    return matchService || matchClient || matchCedula || matchCrossService || matchCrossClient || matchUsuario;
  });

  const mappedInvoices = strictlyOwnedInvoices.map(mapWisphubInvoice);

  // Ordenar de manera cronológica descendente (la más reciente primero)
  mappedInvoices.sort((a, b) => {
    const timeA = new Date(a.fechaEmision || a.fechaVencimiento || 0).getTime();
    const timeB = new Date(b.fechaEmision || b.fechaVencimiento || 0).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return Number(b.id || 0) - Number(a.id || 0);
  });

  return mappedInvoices;
}

/**
 * Extrae de forma segura una cadena legible desde cualquier tipo de dato devuelto por WispHub (string, number, object con nombre/name/id)
 */
export function extractSafeString(val: any, fallback: string = ""): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val.trim() || fallback;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    const candidate = val.nombre ?? val.name ?? val.descripcion ?? val.title ?? val.label ?? val.id;
    if (candidate !== null && candidate !== undefined && typeof candidate !== "object") {
      return String(candidate).trim() || fallback;
    }
    return fallback;
  }
  return fallback;
}

/**
 * Parsea fechas devueltas por WispHub en formato DD/MM/YYYY HH:mm:ss, DD/MM/YYYY o ISO
 */
export function parseWisphubDateTime(str?: string | null): Date | null {
  if (!str || typeof str !== "string") return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    return new Date(year, month, day, hour, minute, second);
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Convierte unidades de tráfico (Bytes o MiB/MB) estrictamente a GB:
 * - Si viene en Bytes (campo de bytes o num > 50,000,000): divide por (1024 * 1024 * 1024).
 * - Si viene en MiB/MB: divide por 1024.
 * - Limita los decimales estrictamente a dos: Number(val.toFixed(2)).
 */
export function convertTrafficUnitToGb(rawVal: any, fieldHint: string = ""): number {
  if (rawVal === undefined || rawVal === null) return 0;
  const num = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ""));
  if (isNaN(num) || num <= 0) return 0;

  const hint = fieldHint.toLowerCase();
  // Detectar si la magnitud o el nombre del campo corresponde a Bytes
  const isBytes = hint.includes("byte") || hint.includes("bytes") || (!hint.includes("mib") && !hint.includes("mb") && num > 50_000_000);
  
  const inGb = isBytes ? num / 1073741824 : num / 1024;
  return Number(inGb.toFixed(2));
}

/**
 * Normaliza y extrae un mapa por fecha (YYYY-MM-DD) de descarga y subida en GB a partir
 * de la respuesta real devuelta por WispHub (o MikroTik).
 */
function extractTrafficMapFromPayload(payload: any): Map<string, { downloadGb: number; uploadGb: number }> {
  const map = new Map<string, { downloadGb: number; uploadGb: number }>();
  if (!payload || typeof payload !== "object") return map;

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.estadisticas)
    ? payload.estadisticas
    : Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload.dias)
    ? payload.dias
    : Array.isArray(payload.trafico)
    ? payload.trafico
    : Array.isArray(payload.historial)
    ? payload.historial
    : null;

  if (items) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const dateVal = item.fecha || item.date || item.dia || item.timestamp;
      let dateKey = "";
      if (typeof dateVal === "string") {
        if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
          dateKey = dateVal.substring(0, 10);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateVal)) {
          const [d, m, y] = dateVal.split(/[\/\s]/);
          dateKey = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
      } else if (dateVal instanceof Date) {
        dateKey = dateVal.toISOString().split("T")[0];
      }

      const down =
        item.download_bytes ?? item.bytes_in ?? item.bytes_bajada ?? item.rx_bytes ?? item.rx ?? item.bajada_mib ?? item.download_mib ?? item.descarga ?? 0;
      const downKey = Object.keys(item).find(k => k.match(/(download|bajada|rx|descarga)/i)) || "";
      const up =
        item.upload_bytes ?? item.bytes_out ?? item.bytes_subida ?? item.tx_bytes ?? item.tx ?? item.subida_mib ?? item.upload_mib ?? item.subida ?? 0;
      const upKey = Object.keys(item).find(k => k.match(/(upload|subida|tx)/i)) || "";

      if (dateKey) {
        map.set(dateKey, {
          downloadGb: convertTrafficUnitToGb(down, downKey),
          uploadGb: convertTrafficUnitToGb(up, upKey),
        });
      }
    }
    return map;
  }

  // Si el objeto utiliza las fechas como claves (ej. { "2026-09-09": { downloadMib: ..., uploadMib: ... } })
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "object" && v !== null && (/^\d{4}-\d{2}-\d{2}/.test(k) || /^\d{2}\/\d{2}\/\d{4}/.test(k))) {
      let dateKey = k;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(k)) {
        const [d, m, y] = k.split(/[\/\s]/);
        dateKey = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      } else if (k.length > 10) {
        dateKey = k.substring(0, 10);
      }

      const item: any = v;
      const down =
        item.download_bytes ?? item.bytes_in ?? item.bytes_bajada ?? item.rx_bytes ?? item.rx ?? item.downloadMib ?? item.bajada_mib ?? item.download_mib ?? item.descarga ?? 0;
      const downKey = Object.keys(item).find(key => key.match(/(download|bajada|rx|descarga)/i)) || "";
      const up =
        item.upload_bytes ?? item.bytes_out ?? item.bytes_subida ?? item.tx_bytes ?? item.tx ?? item.uploadMib ?? item.subida_mib ?? item.upload_mib ?? item.subida ?? 0;
      const upKey = Object.keys(item).find(key => key.match(/(upload|subida|tx)/i)) || "";

      map.set(dateKey, {
        downloadGb: convertTrafficUnitToGb(down, downKey),
        uploadGb: convertTrafficUnitToGb(up, upKey),
      });
    }
  }

  return map;
}

/**
 * Consulta el historial real de estadísticas/tráfico de WispHub para el id_servicio indicado.
 * Utiliza estrictamente la cabecera 'Authorization: Api-Key ${process.env.WISPHUB_API_KEY}'.
 * Permite definir una URL personalizada con la variable de entorno WISPHUB_TRAFFIC_ENDPOINT_URL.
 */
export async function fetchWisphubServiceTraffic(serviceId: string | number): Promise<any> {
  const cleanId = String(serviceId || "").trim();
  if (!cleanId) return null;

  const apiKey = process.env.WISPHUB_API_KEY;
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Api-Key ${apiKey.trim()}`;
  }

  const customUrl = process.env.WISPHUB_TRAFFIC_ENDPOINT_URL
    ? process.env.WISPHUB_TRAFFIC_ENDPOINT_URL.replace("{id_servicio}", cleanId).replace("{id}", cleanId)
    : null;

  const candidateUrls = [
    customUrl,
    `https://api.wisphub.net/api/servicios/${cleanId}/estadisticas/`,
    `https://api.wisphub.net/api/clientes/${cleanId}/estadisticas/`,
    `https://api.wisphub.net/api/clientes/${cleanId}/trafico/`,
    `https://api.wisphub.net/api/servicios/${cleanId}/trafico/`,
  ].filter(Boolean) as string[];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (data) return data;
        } else {
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch {
            // No es JSON válido, ignorar HTML
          }
        }
      }
    } catch (err: any) {
      console.warn(`[WispHub Traffic API] Error consultando ${url}:`, err.message);
    }
  }

  return null;
}

/**
 * Procesa y calcula el consumo de red real del servicio basado exclusivamente en la información
 * entregada por la API de WispHub. No utiliza mock data, funciones Math.random(), ni estimaciones sintéticas.
 * Si WispHub devuelve 0 para un día pasado o no hay registro, el valor se mantiene estrictamente en 0.
 */
export function calculateServiceUsage(raw: any): NetworkUsageData {
  const rawFechaInst = extractSafeString(
    raw.fecha_instalacion || raw.fecha_creacion || raw.fecha_ingreso || raw.fecha_registro || ""
  );
  const parsedInstall = parseWisphubDateTime(rawFechaInst) || new Date();

  // Fecha actual fija del sistema
  const now = new Date();
  const installDayMidnight = new Date(
    parsedInstall.getFullYear(),
    parsedInstall.getMonth(),
    parsedInstall.getDate()
  ).getTime();
  const nowDayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const diffMs = Math.max(0, nowDayMidnight - installDayMidnight);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const diasActivo = diffDays + 1;

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const fechaInstalacionLabel = `${parsedInstall.getDate()} de ${meses[parsedInstall.getMonth()]}, ${parsedInstall.getFullYear()}`;

  // Extraer el mapa de tráfico real recibido de WispHub
  const trafficPayload =
    raw.trafico_real ||
    raw.estadisticas ||
    raw.historial_trafico ||
    raw.consumo_dias ||
    raw.trafico;

  const trafficMap = extractTrafficMapFromPayload(trafficPayload);

  // Bytes directos en el registro del cliente si están presentes
  const directBytesDown = Number(raw.bytes_in ?? raw.bytes_bajada ?? raw.download_bytes ?? raw.rx_bytes ?? 0);
  const directBytesUp = Number(raw.bytes_out ?? raw.bytes_subida ?? raw.upload_bytes ?? raw.tx_bytes ?? 0);
  const directDownGb = directBytesDown > 0 ? convertTrafficUnitToGb(directBytesDown, "bytes") : 0;
  const directUpGb = directBytesUp > 0 ? convertTrafficUnitToGb(directBytesUp, "bytes") : 0;

  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const dayShorts = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  // Generar exactamente los últimos 7 días calendario hasta hoy
  const dias: DayUsage[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayTime = nowDayMidnight - (i * 86400000);
    const dayDate = new Date(dayTime);
    const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
    const isoDateStr = dayDate.toISOString().split("T")[0];
    const isBefore = dayTime < installDayMidnight;
    const isInstallDay = dayTime === installDayMidnight;
    const isToday = i === 0;

    let label = "Sin servicio previo";
    let activo = false;

    if (!isBefore) {
      activo = true;
      const dayNum = Math.round((dayTime - installDayMidnight) / 86400000) + 1;
      if (isInstallDay) {
        label = "Día 1 (Instalación)";
      } else if (isToday) {
        label = `Día ${dayNum} (Hoy)`;
      } else {
        label = `Día ${dayNum}`;
      }
    }

    let dayDown = 0;
    let dayUp = 0;

    // Buscar si existe registro real en el mapa para esta fecha (local o ISO)
    const rec = trafficMap.get(dateStr) || trafficMap.get(isoDateStr);
    if (rec) {
      dayDown = rec.downloadGb;
      dayUp = rec.uploadGb;
    } else if (isToday && (directDownGb > 0 || directUpGb > 0)) {
      // Si para hoy se dispone de telemetría de bytes directa en el servicio
      dayDown = directDownGb;
      dayUp = directUpGb;
    }
    // Si la API no tiene registro o devuelve 0, se mantiene estrictamente en 0 (sin promedios inventados)

    const dayTotal = Number((dayDown + dayUp).toFixed(2));

    dias.push({
      fecha: dateStr,
      dayName: dayNames[dayDate.getDay()],
      dayShort: dayShorts[dayDate.getDay()],
      downloadGb: dayDown,
      uploadGb: dayUp,
      totalGb: dayTotal,
      activo,
      label,
    });
  }

  // Sumas exactas y estrictas de los días reales procesados
  const totalDownloadGb = Number(dias.reduce((acc, d) => acc + d.downloadGb, 0).toFixed(2));
  const totalUploadGb = Number(dias.reduce((acc, d) => acc + d.uploadGb, 0).toFixed(2));
  const totalGb = Number((totalDownloadGb + totalUploadGb).toFixed(2));

  // Registro del día actual (Hoy)
  const todayDay = dias[dias.length - 1] || {
    downloadGb: 0,
    uploadGb: 0,
    totalGb: 0,
    dayName: dayNames[now.getDay()],
  };

  const consumoHoy = {
    totalGb: todayDay.totalGb,
    downloadGb: todayDay.downloadGb,
    uploadGb: todayDay.uploadGb,
    diaLabel: todayDay.dayName,
  };

  return {
    totalGb,
    totalDownloadGb,
    totalUploadGb,
    consumoHoy,
    fechaInstalacion: rawFechaInst || null,
    fechaInstalacionLabel,
    diasActivo,
    esServicioNuevo: diasActivo <= 1 && totalGb === 0,
    mensajeEstado: undefined,
    sesionEnVivo: {
      descarga: `${todayDay.downloadGb.toFixed(1)} GB`,
      subida: `${todayDay.uploadGb.toFixed(1)} GB`,
    },
    dias,
  };
}

/**
 * Transforma un cliente crudo de WispHub al modelo ClientProfile utilizado en el frontend
 */
export function mapWisphubClientToProfile(
  raw: WisphubClientItem,
  invoices: Invoice[] = [],
  directBalance?: number | null,
  trafficData?: any
): ClientProfile {
  const idStr = String(raw.id_servicio || raw.id || "0");
  const cedulaStr = String(raw.cedula || "").trim();

  // Nombre completo
  const fullName =
    extractSafeString(raw.nombre_completo) ||
    [extractSafeString(raw.nombre), extractSafeString(raw.apellidos)].filter(Boolean).join(" ").trim() ||
    extractSafeString(raw.nombre) ||
    extractSafeString(raw.usuario_rb) ||
    extractSafeString(raw.alias) ||
    `Cliente Cédula ${cedulaStr}`;

  // Estado del servicio
  const rawEstado = String(raw.estado ?? "activo").toLowerCase().trim();
  let estadoServicio: ServiceStatus = "activo";
  let estadoServicioLabel = "Activo";

  if (rawEstado.includes("prueba") || rawEstado === "4") {
    estadoServicio = "en_pruebas";
    estadoServicioLabel = "En Pruebas";
  } else if (
    rawEstado === "2" ||
    rawEstado.includes("cort") ||
    rawEstado.includes("mora") ||
    rawEstado.includes("cancel") ||
    rawEstado.includes("desactiv")
  ) {
    estadoServicio = "cortado";
    estadoServicioLabel = "Cortado por Mora";
  } else if (rawEstado.includes("susp") || rawEstado === "3") {
    estadoServicio = "suspendido";
    estadoServicioLabel = "Suspendido";
  } else {
    estadoServicio = "activo";
    estadoServicioLabel = "Activo";
  }

  // Plan contratado
  let planNombre = "Plan Internet Banda Ancha";
  let bajada = "50 Mbps";
  let subida = "50 Mbps";
  let precioMensual = 0;

  if (raw.plan_internet && typeof raw.plan_internet === "object") {
    planNombre = extractSafeString(raw.plan_internet.nombre, planNombre);
    bajada = extractSafeString(raw.plan_internet.bajada, bajada);
    subida = extractSafeString(raw.plan_internet.subida, subida);
    precioMensual = parseFloat(String(raw.plan_internet.precio || 0)) || 0;
  } else if (typeof raw.plan_internet === "string") {
    planNombre = extractSafeString(raw.plan_internet, planNombre);
  } else if (raw.plan_nombre || raw.plan) {
    planNombre = extractSafeString(raw.plan_nombre || raw.plan, planNombre);
  }

  if (precioMensual === 0) {
    precioMensual =
      parseFloat(String(raw.precio_plan || raw.costo_servicio || raw.total || 0)) || 60000;
  }

  if (bajada === "50 Mbps" && planNombre) {
    const speedMatch = planNombre.match(/(\d+)\s*(?:Mbs|Mbps|\/Mbs)/i);
    if (speedMatch) {
      bajada = `${speedMatch[1]} Mbps`;
      subida = `${speedMatch[1]} Mbps`;
    }
  }

  // Extracción dinámica y precisa del día de corte desde WispHub
  let diaCorte = 23;
  if (raw.dia_corte !== undefined && raw.dia_corte !== null && String(raw.dia_corte).trim() !== "") {
    const parsed = parseInt(String(raw.dia_corte), 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 31) diaCorte = parsed;
  } else if (raw.dia_pago !== undefined && raw.dia_pago !== null && String(raw.dia_pago).trim() !== "") {
    const parsed = parseInt(String(raw.dia_pago), 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 31) diaCorte = parsed;
  } else {
    const fechaCorteStr = String(raw.fecha_corte || "").trim();
    if (fechaCorteStr.includes("/")) {
      const parts = fechaCorteStr.split("/");
      const day = parseInt(parts[0], 10);
      if (!isNaN(day) && day > 0 && day <= 31) diaCorte = day;
    } else if (fechaCorteStr.includes("-")) {
      const parts = fechaCorteStr.split("-");
      const day = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(day) && day > 0 && day <= 31) diaCorte = day;
    }
  }

  const today = new Date();
  const curYear = today.getFullYear();
  const curMonth = (today.getMonth() + 1).toString().padStart(2, "0");

  const defaultCorte = `${curYear}-${curMonth}-${diaCorte.toString().padStart(2, "0")}`;
  const fechaCorte = extractSafeString(raw.fecha_corte, defaultCorte);

  // Fecha límite de pago:
  // Si hay factura pendiente, toma su fecha_vencimiento / fecha_limite.
  // Si está al día, toma la próxima fecha según el ciclo de facturación de WispHub (fechaCorte).
  let fechaLimitePago = "";
  const pendingInvoice = invoices.find((i) => i.estado !== "pagada");
  if (pendingInvoice && (pendingInvoice.fechaVencimiento || pendingInvoice.fechaEmision)) {
    fechaLimitePago = pendingInvoice.fechaVencimiento || pendingInvoice.fechaEmision;
  } else if (raw.fecha_limite) {
    fechaLimitePago = String(raw.fecha_limite).trim();
  } else {
    fechaLimitePago = fechaCorte;
  }

  // Cálculo de saldo total pendiente (monto exacto sin deducciones de IVA)
  let saldoTotal = 0;
  if (directBalance !== undefined && directBalance !== null) {
    saldoTotal = directBalance;
  } else {
    const invoicesPendingSum = invoices
      .filter((i) => i.estado !== "pagada")
      .reduce((acc, curr) => acc + curr.saldoPendiente, 0);

    if (invoicesPendingSum > 0) {
      saldoTotal = invoicesPendingSum;
    } else if (raw.saldo !== undefined && raw.saldo !== null) {
      saldoTotal = parseFloat(String(raw.saldo)) || 0;
    } else if (raw.saldo_pendiente !== undefined && raw.saldo_pendiente !== null) {
      saldoTotal = parseFloat(String(raw.saldo_pendiente)) || 0;
    }
  }

  const facturasPendientesCount = invoices.filter((i) => i.estado !== "pagada").length;

  // Datos de infraestructura y red leídos directamente de WispHub
  const ipExtraida = extractSafeString(raw.ip || raw.ip_local, "100.64.0.1");

  const macExtraida =
    extractSafeString(raw.mac) ||
    extractSafeString(raw.mac_router_wifi) ||
    extractSafeString(raw.mac_cpe) ||
    extractSafeString(raw.mac_address) ||
    extractSafeString(raw.cpe_mac) ||
    extractSafeString(raw.mac_router) ||
    extractSafeString(raw.mac_antena) ||
    "";

  const nodoExtraido =
    extractSafeString(raw.sectorial) ||
    extractSafeString(raw.nodo) ||
    extractSafeString(raw.router) ||
    extractSafeString(raw.zona) ||
    extractSafeString(raw.olt) ||
    "Nodo Principal Fibra";

  const routerOntExtraido =
    extractSafeString(raw.modelo_router_wifi) ||
    extractSafeString(raw.modelo_router) ||
    extractSafeString(raw.modelo_antena) ||
    extractSafeString(raw.router) ||
    extractSafeString(raw.cpe) ||
    "Router ONT Dual Band 5G";

  const mikrotikExtraido =
    extractSafeString(raw.servidor) ||
    extractSafeString(raw.servidor_mikrotik) ||
    extractSafeString(raw.mikrotik) ||
    extractSafeString(raw.nombre_router) ||
    "";

  const sectorialExtraido =
    extractSafeString(raw.sectorial) ||
    extractSafeString(raw.ap) ||
    extractSafeString(raw.punto_acceso) ||
    "";

  const cajaNapExtraida =
    extractSafeString(raw.caja_nap) ||
    extractSafeString(raw.nap) ||
    extractSafeString(raw.caja) ||
    extractSafeString(raw.puerto_nap) ||
    "";

  // Datos personales y ubicación limpios
  const telefonoExtraido = extractSafeString(raw.telefono || raw.celular || raw.telefono_referencia, "");
  const celularExtraido = extractSafeString(raw.celular || raw.telefono_movil || raw.telefono || "");
  const rawDir = extractSafeString(raw.direccion || raw.direccion_completa, "Dirección Urbana Registrada");
  const direccionExtraida = rawDir.replace(/\r\n|\r|\n/g, " - ").replace(/\s{2,}/g, " ").trim();
  const barrioExtraido = extractSafeString(raw.barrio || raw.localidad || raw.sector, "");
  const ciudadExtraida = extractSafeString(raw.ciudad || raw.municipio || raw.localidad, "Colombia");

  // Fechas de activación y consumo
  const fechaInstalacionRaw = extractSafeString(
    (raw as any).fecha_instalacion || (raw as any).fecha_creacion || (raw as any).fecha_ingreso || ""
  );
  const fechaRegistroRaw = extractSafeString(
    (raw as any).fecha_registro || (raw as any).date_joined || (raw as any).created_at || ""
  );
  const consumoRed = calculateServiceUsage({
    ...raw,
    trafico_real: trafficData,
  });

  return {
    id: idStr,
    cedula: cedulaStr,
    usuario: extractSafeString(raw.usuario) || undefined,
    nombreCompleto: fullName,
    email: extractSafeString(raw.email || raw.correo, `cliente.${cedulaStr}@internetaponteplus.com`),
    telefono: telefonoExtraido,
    celular: celularExtraido,
    direccion: direccionExtraida,
    barrio: barrioExtraido,
    ciudad: ciudadExtraida,
    estadoServicio,
    estadoServicioLabel,
    plan: {
      nombre: planNombre,
      velocidadBajada: bajada,
      velocidadSubida: subida,
      precioMensual,
      tecnologia: "Fibra Óptica FTTH",
    },
    servicio: {
      idServicio: idStr,
      ip: ipExtraida,
      mac: macExtraida,
      nodo: nodoExtraido,
      routerOnt: routerOntExtraido,
      mikrotik: mikrotikExtraido,
      sectorial: sectorialExtraido,
      cajaNap: cajaNapExtraida,
      fechaCorte,
      fechaLimitePago,
      diaPago: diaCorte,
      diaCorte,
    },
    fechaInstalacion: fechaInstalacionRaw || undefined,
    fechaRegistro: fechaRegistroRaw || undefined,
    saldoTotalPendiente: saldoTotal,
    facturasPendientesCount,
    consumoRed,
  };
}

/**
 * Consulta el consumo de red real de un servicio desde WispHub dinámicamente
 */
export async function getWisphubServiceUsage(
  idServicio?: string | number,
  cedula?: string
): Promise<NetworkUsageData> {
  let clientRaw: any = null;
  const cleanCedula = String(cedula || "").trim();
  const cleanServiceId = String(idServicio || "").trim();

  if (cleanCedula) {
    try {
      clientRaw = await searchWisphubClient(cleanCedula);
    } catch {}
  }
  if (!clientRaw && cleanServiceId) {
    try {
      clientRaw = await getWisphubClientDetail(cleanServiceId);
    } catch {}
  }

  const resolvedServiceId = cleanServiceId || clientRaw?.id_servicio || clientRaw?.id || "";
  const resolvedCedula = cleanCedula || clientRaw?.cedula || "";

  // Consultar historial de tráfico real mediante web scraping del panel de WispHub
  let trafficPayload: any = null;
  if (resolvedServiceId) {
    try {
      const scraped = await scrapeTrafficWeek(resolvedServiceId);
      if (scraped.success && scraped.dias.length > 0) {
        trafficPayload = scraped.dias.map((d) => ({
          fecha: d.fecha,
          download_mib: d.downloadGb * 1024,
          upload_mib: d.uploadGb * 1024,
        }));
      }
    } catch (err: any) {
      console.warn(`[WispHub] Error en scraping de tráfico para servicio ${resolvedServiceId}:`, err.message);
    }
  }

  const rawObj = {
    ...(clientRaw || {}),
    id_servicio: resolvedServiceId,
    cedula: resolvedCedula,
    trafico_real: trafficPayload,
  };

  return calculateServiceUsage(rawObj);
}

/**
 * Consulta un abonado en WispHub por su documento de identidad y/o id_servicio.
 * Si tiene 2 o más servicios asociados y no se especificó id_servicio, devuelve la lista
 * de servicios para activar el modal de selección.
 */
export async function getClientByDocument(
  documento: string,
  targetServiceId?: string | null
): Promise<{
  success: boolean;
  cliente?: ClientProfile;
  facturas?: Invoice[];
  multipleServices?: boolean;
  servicios?: WisphubServiceSummary[];
  nombre?: string;
  error?: string;
  statusCode?: number;
}> {
  const cleanDoc = documento ? documento.trim() : "";
  const cleanServiceId = targetServiceId ? String(targetServiceId).trim() : null;

  if (!cleanDoc && !cleanServiceId) {
    return {
      success: false,
      error: "El número de documento es obligatorio.",
      statusCode: 400,
    };
  }

  try {
    // 0. Si no viene targetServiceId, verificar cuántos servicios/líneas tiene el abonado
    const services = cleanDoc ? await searchWisphubServicesByDocument(cleanDoc) : [];

    // Si la API retorna 2 o más servicios/contratos asociados a esa misma cédula:
    // No cargues el primero por defecto. Activa un modal de selección.
    if (!cleanServiceId && services.length >= 2) {
      let titularNombre = "";
      if (cleanDoc) {
        try {
          const titularClient = await searchWisphubClient(cleanDoc);
          if (titularClient && (titularClient.nombre_completo || titularClient.nombre)) {
            titularNombre = titularClient.nombre_completo || titularClient.nombre || "";
          }
        } catch {}
      }
      if (!titularNombre) {
        titularNombre = services.find((s) => s.nombre || s.nombre_completo)?.nombre || "";
      }
      return {
        success: true,
        multipleServices: true,
        servicios: services,
        nombre: titularNombre,
      };
    }

    // 1. Buscar cliente en WispHub por id_servicio específico o por cédula
    let basicClient: WisphubClientItem | null = null;
    let titularClient: WisphubClientItem | null = null;
    const matchedService = cleanServiceId
      ? services.find((s) => String(s.idServicio || s.id_servicio || s.id) === cleanServiceId)
      : null;

    if (cleanDoc) {
      try {
        titularClient = await searchWisphubClient(cleanDoc);
      } catch {}
    }

    if (cleanServiceId) {
      basicClient = await getWisphubClientDetail(cleanServiceId);
      if (basicClient && matchedService) {
        basicClient = {
          ...basicClient,
          usuario: matchedService.usuario || basicClient.usuario,
          nombre: matchedService.nombre || basicClient.usuario_rb || basicClient.nombre,
          nombre_completo: matchedService.nombre_completo || matchedService.nombre || basicClient.usuario_rb,
          direccion: matchedService.direccion || basicClient.direccion,
          alias: matchedService.alias || basicClient.alias,
          plan_nombre: matchedService.planNombre || basicClient.plan_nombre,
        };
      } else if (basicClient && basicClient.usuario_rb && !basicClient.nombre) {
        basicClient.nombre = basicClient.usuario_rb;
        basicClient.nombre_completo = basicClient.usuario_rb;
      }
    }
    if (!basicClient && titularClient) {
      basicClient = titularClient;
    }

    // Si el servicio secundario no contiene el nombre del titular o cedula, enriquecerlo sin sobreescribir su nombre de línea
    if (basicClient) {
      if ((!basicClient.cedula || String(basicClient.cedula).trim() === "") && cleanDoc) {
        basicClient.cedula = cleanDoc;
      }
      if (titularClient) {
        if (!basicClient.cedula && titularClient.cedula) basicClient.cedula = titularClient.cedula;
        if (!basicClient.telefono && titularClient.telefono) basicClient.telefono = titularClient.telefono;
        if (!basicClient.celular && titularClient.celular) basicClient.celular = titularClient.celular;
        if (!basicClient.email && titularClient.email) basicClient.email = titularClient.email;
        if (!basicClient.correo && titularClient.correo) basicClient.correo = titularClient.correo;
        
        const realTitular = titularClient.nombre_completo || titularClient.nombre;
        if (realTitular && !basicClient.nombre && !basicClient.nombre_completo) {
          basicClient.nombre = realTitular;
          basicClient.nombre_completo = realTitular;
        }
      } else {
        const servicioTitular = services.find((s) => s.nombre || s.nombre_completo);
        if (servicioTitular && (servicioTitular.nombre || servicioTitular.nombre_completo)) {
          basicClient.nombre = basicClient.nombre || servicioTitular.nombre || servicioTitular.nombre_completo;
        }
      }
    }

    if (!basicClient) {
      return {
        success: false,
        error: "Cliente no encontrado. Por favor verifica el número de documento e intenta de nuevo.",
        statusCode: 404,
      };
    }

    const serviceId = cleanServiceId || basicClient.id_servicio || basicClient.id;

    // 2. Obtener detalle exhaustivo del cliente si tiene ID y no lo habíamos consultado
    let fullClient = basicClient;
    const detailId = cleanServiceId || basicClient.id;
    if (detailId && !cleanServiceId) {
      try {
        const detailed = await getWisphubClientDetail(detailId);
        if (detailed) {
          fullClient = { ...basicClient, ...detailed };
        }
      } catch (err: any) {
        console.warn(`[WispHub] No se pudo obtener detalle extendido para cliente ${detailId}:`, err.message);
      }
    }

    // Asegurar que fullClient mantenga cédula, dirección y datos de contacto de la línea específica
    if ((!fullClient.cedula || String(fullClient.cedula).trim() === "") && cleanDoc) {
      fullClient.cedula = cleanDoc;
    }
    if (matchedService) {
      if (!fullClient.usuario && matchedService.usuario) fullClient.usuario = matchedService.usuario;
      if (!fullClient.direccion && matchedService.direccion) fullClient.direccion = matchedService.direccion;
      if (!fullClient.nombre && matchedService.nombre) fullClient.nombre = matchedService.nombre;
      if (!fullClient.nombre_completo && (matchedService.nombre_completo || matchedService.nombre)) {
        fullClient.nombre_completo = matchedService.nombre_completo || matchedService.nombre;
      }
    }
    if (titularClient) {
      if (!fullClient.telefono && titularClient.telefono) fullClient.telefono = titularClient.telefono;
      if (!fullClient.celular && titularClient.celular) fullClient.celular = titularClient.celular;
      const realTitular = titularClient.nombre_completo || titularClient.nombre;
      if (realTitular && !fullClient.nombre && !fullClient.nombre_completo) {
        fullClient.nombre = realTitular;
        fullClient.nombre_completo = realTitular;
      }
    }

    // 3. Consultar saldo directo si hay id_servicio
    let directBalance: number | null = null;
    if (serviceId) {
      directBalance = await getWisphubClientBalance(serviceId);
    }

    // 4. Consultar facturas asociadas EXCLUSIVAMENTE a este cliente y servicio
    let invoices: Invoice[] = [];
    const targetUser = fullClient.usuario || matchedService?.usuario || basicClient.usuario;
    if (serviceId || basicClient.id || targetUser) {
      invoices = await getWisphubInvoices(serviceId, basicClient.id, cleanDoc, targetUser);
    }

    // 4.5. Consultar historial de tráfico real mediante web scraping del panel de WispHub
    let trafficData: any = null;
    if (serviceId) {
      try {
        const scraped = await scrapeTrafficWeek(serviceId);
        if (scraped.success && scraped.dias.length > 0) {
          trafficData = scraped.dias.map((d) => ({
            fecha: d.fecha,
            download_mib: d.downloadGb * 1024,
            upload_mib: d.uploadGb * 1024,
          }));
        }
      } catch (err: any) {
        console.warn(`[WispHub] Error en scraping de tráfico para servicio ${serviceId}:`, err.message);
      }
    }

    // 5. Mapear a ClientProfile estandarizado
    const profile = mapWisphubClientToProfile(fullClient, invoices, directBalance, trafficData);

    if ((!profile.cedula || profile.cedula.trim() === "") && cleanDoc) {
      profile.cedula = cleanDoc;
    }
    if (matchedService?.direccion && (!profile.direccion || profile.direccion === "Dirección Urbana Registrada")) {
      profile.direccion = matchedService.direccion;
    }
    if (matchedService?.nombre && (!profile.nombreCompleto || profile.nombreCompleto.toLowerCase().includes("cédula") || profile.nombreCompleto.toLowerCase().includes("cedula"))) {
      profile.nombreCompleto = matchedService.nombre;
    }
    if (titularClient) {
      if (!profile.telefono && titularClient.telefono) profile.telefono = String(titularClient.telefono).trim();
      if (!profile.celular && titularClient.celular) profile.celular = String(titularClient.celular).trim();
      const realTitular = titularClient.nombre_completo || titularClient.nombre;
      if (realTitular && (!profile.nombreCompleto || profile.nombreCompleto.toLowerCase().includes("cédula") || profile.nombreCompleto.toLowerCase().includes("cedula"))) {
        profile.nombreCompleto = realTitular;
      }
    }

    return {
      success: true,
      cliente: profile,
      facturas: invoices,
      multipleServices: false,
      servicios: services.length > 0 ? services : undefined,
    };
  } catch (err: any) {
    console.error("[WispHub API Error in getClientByDocument]:", err);
    return {
      success: false,
      error: err.message || "Error de sincronización con WispHub.",
      statusCode: err.status || 502,
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

  const apiKey = process.env.WISPHUB_API_KEY;
  if (apiKey && apiKey.trim() !== "") {
    try {
      await fetchWisphub("/api/pagos/reportar/", {
        method: "POST",
        body: JSON.stringify({
          id_cliente: payload.idCliente,
          id_factura: payload.idFactura,
          referencia: payload.referencia,
          monto: payload.monto,
          metodo_pago: payload.metodoPago,
          fecha_transferencia: payload.fechaHoraTransferencia,
          radicado,
          observaciones: payload.observaciones,
        }),
      });
    } catch (apiErr) {
      console.warn("[WispHub Report Forwarding Warning]:", apiErr);
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
