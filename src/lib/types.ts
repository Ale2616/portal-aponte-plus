export type ServiceStatus = 'activo' | 'cortado' | 'suspendido' | 'en_pruebas';

export type InvoiceStatus = 'pagada' | 'pendiente' | 'vencida';

export interface ClientProfile {
  id: string; // WispHub Client ID o ID de Servicio
  cedula: string;
  usuario?: string; // WispHub username (ej. orlindaperez@aponteplus)
  nombreCompleto: string;
  email: string;
  telefono: string;
  celular?: string;
  direccion: string;
  barrio?: string;
  ciudad: string;
  estadoServicio: ServiceStatus;
  estadoServicioLabel?: string;
  plan: {
    nombre: string;
    velocidadBajada: string;
    velocidadSubida: string;
    precioMensual: number;
    tecnologia: 'Fibra Óptica FTTH' | 'Inalámbrico 5GHz' | 'GigaFibra';
  };
  servicio: {
    idServicio?: number | string;
    ip: string;
    mac?: string;
    nodo: string;
    routerOnt: string;
    mikrotik?: string;
    sectorial?: string;
    cajaNap?: string;
    fechaCorte: string; // Formato YYYY-MM-DD o DD/MM/YYYY
    fechaLimitePago: string; // Formato YYYY-MM-DD o DD/MM/YYYY
    diaPago: number;
    diaCorte?: number;
  };
  fechaInstalacion?: string;
  fechaRegistro?: string;
  saldoTotalPendiente: number;
  facturasPendientesCount: number;
  consumoRed?: NetworkUsageData;
}

export interface DayUsage {
  fecha: string; // YYYY-MM-DD
  dayName: string; // "Lunes", "Martes"
  dayShort: string; // "Lun", "Mar"
  downloadGb: number;
  uploadGb: number;
  totalGb: number;
  activo: boolean; // Si el servicio ya estaba instalado ese día
  label?: string; // "Día 1 (Instalación)", "Día 2 (Hoy)", "Sin servicio previo"
  peakHour?: string;
}

export interface NetworkUsageData {
  totalGb: number;
  totalDownloadGb: number;
  totalUploadGb: number;
  consumoHoy?: {
    totalGb: number;
    downloadGb: number;
    uploadGb: number;
    diaLabel: string;
  };
  fechaInstalacion: string | null;
  fechaInstalacionLabel: string;
  diasActivo: number;
  esServicioNuevo: boolean;
  mensajeEstado?: string;
  sesionEnVivo?: {
    descarga: string;
    subida: string;
  };
  dias: DayUsage[];
}

export interface Invoice {
  id: string;
  folio: string; // Ej: "FAC-2026-0891"
  periodo: string; // Ej: "Marzo 2026"
  fechaEmision: string;
  fechaVencimiento: string;
  subtotal?: number; // Para compatibilidad (igual al total neto)
  impuestos?: number; // 0 en tarifa plana
  total: number; // Monto neto directo sin IVA
  saldoPendiente: number;
  estado: InvoiceStatus;
  concepto: string;
  pdfUrl?: string;
  pdfFactura?: string;
  fechaPago?: string;
  tieneReportePendiente?: boolean;
}

export interface PaymentReportSubmission {
  idFactura: string;
  idCliente: string;
  referencia: string;
  metodoPago: string;
  monto: number;
  fechaHoraTransferencia: string;
  observaciones?: string;
  nombreArchivo?: string;
}

export interface PaymentReportResult {
  success: boolean;
  radicado: string; // Ej: "RAD-2026-94812"
  mensaje: string;
  idReporte: string;
  fechaRecepcion: string;
  facturaFolio: string;
  monto: number;
  metodoPago: string;
  referencia: string;
}
