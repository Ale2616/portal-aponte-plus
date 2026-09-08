export type ServiceStatus = 'activo' | 'cortado' | 'suspendido';

export type InvoiceStatus = 'pagada' | 'pendiente' | 'vencida';

export interface ClientProfile {
  id: string; // WispHub Client ID
  cedula: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  estadoServicio: ServiceStatus;
  plan: {
    nombre: string;
    velocidadBajada: string;
    velocidadSubida: string;
    precioMensual: number;
    tecnologia: 'Fibra Óptica FTTH' | 'Inalámbrico 5GHz' | 'GigaFibra';
  };
  servicio: {
    ip: string;
    nodo: string;
    routerOnt: string;
    fechaCorte: string; // Formato YYYY-MM-DD
    fechaLimitePago: string; // Formato YYYY-MM-DD
    diaPago: number;
  };
  saldoTotalPendiente: number;
  facturasPendientesCount: number;
}

export interface Invoice {
  id: string;
  folio: string; // Ej: "FAC-2026-0891"
  periodo: string; // Ej: "Marzo 2026"
  fechaEmision: string;
  fechaVencimiento: string;
  subtotal: number;
  impuestos: number;
  total: number;
  saldoPendiente: number;
  estado: InvoiceStatus;
  concepto: string;
  pdfUrl?: string;
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
