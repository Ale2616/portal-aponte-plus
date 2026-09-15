"use client";

import { useEffect } from "react";
import { Invoice, ClientProfile } from "@/lib/types";
import { branding } from "@/config/branding";
import { formatCurrency, formatDate, formatInvoiceMonth } from "@/lib/utils";
import { useConfig } from "@/context/ConfigContext";
import { X, Printer } from "lucide-react";

interface InvoicePdfModalProps {
  invoice: Invoice | null;
  client: ClientProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onPayClick?: (invoice: Invoice) => void;
}

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
  s = s.replace(/megasmegas/gi, " Megas");
  // Si dice sólo "50Mbs", convertir a "50 Mbps"
  s = s.replace(/(\d+)\s*mbs\b/gi, "$1 Mbps");
  // Limpiar guiones o separadores al final
  s = s.replace(/[-/|:]+\s*$/g, "");
  // Limpiar espacios dobles
  return s.replace(/\s+/g, " ").trim();
}

export function InvoicePdfModal({
  invoice,
  client,
  isOpen,
  onClose,
}: InvoicePdfModalProps) {
  const { config, globalSettings } = useConfig();

  useEffect(() => {
    // Bloquear scroll de la página de fondo
    document.body.style.overflow = 'hidden';
    
    // Restaurar scroll al cerrar el modal o desmontar el componente
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!isOpen || !invoice) return null;

  const rawFp =
    (invoice as any).formaPago ||
    (invoice as any).metodoPago ||
    (invoice as any).forma_pago ||
    (invoice as any).metodo_pago;
  const metodoPagoClean = cleanPaymentMethod(rawFp);

  const estadoStr = String(invoice.estado || "").toLowerCase().trim();
  const isPaid =
    estadoStr === "pagada" ||
    estadoStr === "pago" ||
    estadoStr === "pagado" ||
    estadoStr === "1" ||
    estadoStr === "cobrada" ||
    estadoStr === "cancelada" ||
    (invoice.saldoPendiente === 0 && invoice.total > 0);

  const folioNumber = invoice.folio
    ? invoice.folio.replace(/^FAC-+/i, "")
    : invoice.id.toString().replace(/^FAC-+/i, "");

  const conceptoReal = invoice.concepto && invoice.concepto.trim()
    ? invoice.concepto.trim()
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

  const rawPlanName =
    client?.plan?.nombre ||
    (client as any)?.servicio?.plan ||
    (invoice as any)?.plan ||
    "";
  const planLimpio = cleanPlanName(rawPlanName);

  // Obtener el mes de la factura garantizado (ej. "Septiembre 2026")
  const mesFactura = formatInvoiceMonth(
    invoice.periodo,
    invoice.fechaEmision,
    invoice.fechaVencimiento
  );

  const nequiNumber =
    globalSettings?.canalesPago?.nequi ||
    config.companyInfo.nequiNumber ||
    "311 276 0959";
  const bancolombiaNumber =
    globalSettings?.canalesPago?.bancolombia || "84758122483";
  const brebNumber =
    globalSettings?.canalesPago?.breB || "311 276 0959";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden overscroll-none animate-in fade-in duration-200 print:static print:p-0 print:bg-transparent print:backdrop-blur-none print:block"
    >
      {/* ─── AISLAMIENTO ESTRICTO DE IMPRESIÓN (1 SOLA PÁGINA) ─── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
      `,
        }}
      />

      {/* Contenedor Modal */}
      <div
        className="relative w-full max-w-[820px] max-h-[95vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden print:static print:max-w-none print:max-h-none print:bg-transparent print:border-none print:shadow-none print:overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar (Oculto en Impresión) */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 no-print print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Comprobante Oficial de Pago
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Invoice Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto print:p-0 print:overflow-visible">
          {/* ─── ESTRUCTURA LIMPIA Y DIRECTA (#comprobante-oficial) ─── */}
          <div
            id="comprobante-oficial"
            className="bg-white border border-slate-300 rounded-xl p-5 text-slate-800 text-xs w-full max-w-[740px] mx-auto shadow-sm"
          >
            {/* Encabezado Simplificado y Compacto */}
            <div className="flex justify-between items-start border-b border-slate-200 pt-0 pb-1.5 mb-2">
              {/* Izquierda: Logo y datos limpios */}
              <div className="flex items-center gap-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.logoUrl || "/logo.jpg"}
                  alt="Internet Aponte Plus"
                  className="h-12 w-auto object-contain flex-shrink-0"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-slate-900 leading-tight">
                    Internet Aponte Plus
                  </span>
                  <span className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                    NIT: 901.458.789-2 • Curillo, Caquetá
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    WhatsApp: 318 557 7157
                  </span>
                </div>
              </div>

              {/* Derecha: Folio y Badge minimalistas */}
              <div className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-right flex flex-col items-end flex-shrink-0">
                <span className="text-base font-black text-slate-900 font-sans tracking-tight">
                  No. FAC-{folioNumber}
                </span>
                <div className="mt-0.5">
                  {isPaid ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full px-2.5 py-0.5 font-bold text-[10px] inline-flex items-center gap-1">
                      ✓ CANCELADA / PAGADA
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-700 border border-amber-300 rounded-full px-2.5 py-0.5 font-bold text-[10px] inline-flex items-center gap-1">
                      PENDIENTE DE PAGO
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Cajas de Información en 2 Columnas Compactas (Arrancan inmediatamente debajo del membrete) */}
            <div className="grid grid-cols-2 gap-4 mt-0 mb-2 text-xs leading-relaxed">
              {/* Caja 1: ADQUIRENTE / CLIENTE */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1 pb-0.5 border-b border-slate-200">
                  ADQUIRENTE / CLIENTE
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Nombre: </span>
                  <span className="text-slate-900 font-medium">{client?.nombreCompleto || "Abonado Registrado"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Cédula / NIT: </span>
                  <span className="font-sans tabular-nums font-bold text-slate-900 tracking-tight">{client?.cedula || "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Dirección: </span>
                  <span className="text-slate-800">{client?.direccion || "Curillo, Caquetá"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Municipio: </span>
                  <span className="text-slate-800">Curillo - Caquetá</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Teléfono: </span>
                  <span className="font-sans tabular-nums font-bold text-slate-900 tracking-tight">{client?.celular || client?.telefono || "318 557 7157"}</span>
                </div>
                {/* Mostrar plan ÚNICAMENTE si no es factura de equipos/cámaras y existe nombre de plan */}
                {!isEquipmentOrCustom && planLimpio && (
                  <div>
                    <span className="font-semibold text-slate-700">Plan Contratado: </span>
                    <span className="text-slate-900 font-semibold">{planLimpio}</span>
                  </div>
                )}
              </div>

              {/* Caja 2: DATOS DE LA OPERACIÓN */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1 pb-0.5 border-b border-slate-200">
                  DATOS DE LA OPERACIÓN
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Periodo Facturado: </span>
                  <span className="text-slate-900 font-medium">{mesFactura}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Forma de Pago: </span>
                  <span className="text-slate-900 font-medium">{metodoPagoClean}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Estado: </span>
                  <span className={isPaid ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                    {isPaid ? "CANCELADA / PAGADA" : "PENDIENTE DE PAGO"}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabla de Cobro Directa */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mt-2 mb-2">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-700 py-1.5 px-3 border-b border-slate-300">
                  <tr>
                    <th className="py-1.5 px-2 text-center w-[8%]">ÍTEM</th>
                    <th className="py-1.5 px-3 border-l border-slate-300 w-[52%]">DESCRIPCIÓN DEL SERVICIO O PRODUCTO</th>
                    <th className="py-1.5 px-2 text-center border-l border-slate-300 w-[8%]">CANT.</th>
                    <th className="py-1.5 px-3 text-right border-l border-slate-300 w-[16%]">VR. UNITARIO</th>
                    <th className="py-1.5 px-3 text-right border-l border-slate-300 w-[16%]">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2.5 px-2 text-center text-xs font-sans tabular-nums font-bold text-slate-900 tracking-tight">
                      1
                    </td>
                    <td className="py-2.5 px-3 border-l border-slate-200 break-words whitespace-normal leading-relaxed text-xs text-slate-800">
                      <span className="font-semibold text-slate-900">
                        {conceptoReal}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center border-l border-slate-200 text-xs font-sans tabular-nums font-bold text-slate-900 tracking-tight">
                      1
                    </td>
                    <td className="py-2.5 px-3 text-right border-l border-slate-200 text-xs font-sans tabular-nums font-bold text-slate-900 tracking-tight">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="py-2.5 px-3 text-right border-l border-slate-200 text-xs font-sans tabular-nums font-bold text-slate-900 tracking-tight">
                      {formatCurrency(invoice.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Zona Inferior: Canales de Pago a la Izquierda y Total Directo a la Derecha */}
            <div className="flex justify-between items-center gap-4 my-2.5 pt-1">
              {/* Izquierda: Canales de Pago con Iconos (Bre-B debajo de Nequi) */}
              <div className="flex items-start gap-2 text-[11px] text-slate-700">
                <span className="font-bold pt-0.5 flex-shrink-0">Canales de Pago:</span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/nequi-icon.png"
                        alt="Nequi"
                        className="w-3.5 h-3.5 object-contain inline-block rounded-sm flex-shrink-0"
                      />
                      <span>Nequi: <strong className="font-sans tabular-nums font-bold text-slate-900 tracking-tight">{nequiNumber}</strong></span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/bancolombia-icon.png"
                        alt="Bancolombia"
                        className="w-3.5 h-3.5 object-contain inline-block rounded-sm flex-shrink-0"
                      />
                      <span>Bancolombia: <strong className="font-sans tabular-nums font-bold text-slate-900 tracking-tight">{bancolombiaNumber}</strong></span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/breb-icon.png"
                        alt="Bre-B"
                        className="w-3.5 h-3.5 object-contain inline-block rounded-sm flex-shrink-0"
                      />
                      <span>Bre-B: <strong className="font-sans tabular-nums font-bold text-slate-900 tracking-tight">{brebNumber}</strong></span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Derecha: Recuadro simple con TOTAL */}
              <div className="bg-slate-100 border border-slate-300 rounded-lg px-4 py-2 flex items-center gap-2.5 flex-shrink-0">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  {isPaid ? "TOTAL PAGADO:" : "TOTAL A PAGAR:"}
                </span>
                <span className="font-sans tabular-nums font-black text-slate-900 tracking-tight text-base sm:text-lg">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Oculto en Impresión) */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 no-print print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white shadow-md transition-all cursor-pointer active:scale-[0.98]"
            title="Imprimir comprobante en 1 sola hoja"
          >
            <Printer className="w-4 h-4" />
            Imprimir Comprobante
          </button>
        </div>
      </div>
    </div>
  );
}
