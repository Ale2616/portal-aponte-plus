import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ServiceStatus, InvoiceStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "COP"): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  try {
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    }
    const d = new Date(dateString);
    return new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

export function sanitizeDocument(doc: string): string {
  if (!doc) return "";
  // Elimina caracteres no alfanuméricos comunes (puntos, guiones, espacios)
  return doc.replace(/[^a-zA-Z0-9]/g, "").trim();
}

export function generateRadicado(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `RAD-${year}-${randomNum}`;
}

export function getServiceStatusInfo(status: ServiceStatus) {
  switch (status) {
    case "activo":
      return {
        label: "Servicio Activo",
        shortLabel: "Activo",
        color: "text-emerald-500 dark:text-emerald-400",
        bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
        borderColor: "border-emerald-500/30",
        dotColor: "bg-emerald-500",
        gradient: "from-emerald-600/20 to-teal-900/20",
        description: "Tu conexión opera a máxima velocidad sin restricciones.",
      };
    case "cortado":
      return {
        label: "Servicio Cortado por Mora",
        shortLabel: "Cortado",
        color: "text-rose-500 dark:text-rose-400",
        bgColor: "bg-rose-500/10 dark:bg-rose-500/20",
        borderColor: "border-rose-500/30",
        dotColor: "bg-rose-500 animate-ping",
        gradient: "from-rose-600/20 to-red-900/20",
        description: "Acceso suspendido temporalmente. Reporta tu pago para reconexión inmediata.",
      };
    case "suspendido":
      return {
        label: "Servicio Suspendido",
        shortLabel: "Suspendido",
        color: "text-amber-500 dark:text-amber-400",
        bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
        borderColor: "border-amber-500/30",
        dotColor: "bg-amber-500",
        gradient: "from-amber-600/20 to-orange-900/20",
        description: "Servicio en pausa por solicitud o mantenimiento.",
      };
    default:
      return {
        label: "Estado Desconocido",
        shortLabel: "Desconocido",
        color: "text-gray-400",
        bgColor: "bg-gray-500/10",
        borderColor: "border-gray-500/30",
        dotColor: "bg-gray-400",
        gradient: "from-gray-600/20 to-gray-900/20",
        description: "Verifica con soporte técnico.",
      };
  }
}

export function getInvoiceStatusInfo(status: InvoiceStatus) {
  switch (status) {
    case "pagada":
      return {
        label: "Pagada",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      };
    case "pendiente":
      return {
        label: "Pendiente",
        color: "text-amber-400",
        bgColor: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      };
    case "vencida":
      return {
        label: "Vencida",
        color: "text-rose-400",
        bgColor: "bg-rose-500/10 border-rose-500/30 text-rose-400",
      };
  }
}

export function buildWhatsAppUrl(
  phone: string = "573185577157",
  clientName?: string,
  documentNumber?: string,
  extraContext?: string
): string {
  const cleanPhone = phone.replace(/\D/g, "") || "573185577157";
  let message = "Hola Internet Aponte Plus, necesito soporte con mi servicio";
  if (clientName && documentNumber) {
    message += ` (Abonado: ${clientName} - Cédula: ${documentNumber})`;
  }
  if (extraContext) {
    message += ` - ${extraContext}`;
  }
  message += ".";

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
