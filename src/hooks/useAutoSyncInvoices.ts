"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ClientProfile, Invoice } from "@/lib/types";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { playPaymentSuccessChime } from "@/lib/sound";

interface UseAutoSyncInvoicesProps {
  client: ClientProfile | null;
  invoices: Invoice[];
  setClient: React.Dispatch<React.SetStateAction<ClientProfile | null>>;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  hasResetConsultation: boolean;
  pendingDocument?: string;
  pollingIntervalMs?: number;
}

/**
 * Determina si una factura tiene estado pagado/cancelado o saldo cero
 */
function isInvoicePaid(inv?: Invoice): boolean {
  if (!inv) return false;
  const est = String(inv.estado || "").toLowerCase().trim();
  const saldo = Number(inv.saldoPendiente ?? 0);
  const total = Number(inv.total || 0);

  return (
    est === "pagada" ||
    est === "pago" ||
    est === "pagado" ||
    est === "cancelada" ||
    est === "cobrada" ||
    (saldo === 0 && total > 0)
  );
}

/**
 * Hook para revalidación automática en segundo plano:
 * 1. Revalidación al recuperar el foco de la pestaña / ventana (Tab Visibility / Window Focus).
 * 2. Sondeo periódico (polling) cada 10-15s en segundo plano mientras la pestaña esté visible.
 * 3. Actualización silenciosa (silent refetch) sin pantallas de carga invasivas.
 * 4. Notificación visual ("¡Pago Registrado con Éxito! 🎉 Gracias por tu pago, tu servicio se encuentra al día.") con sonido sutil y confeti.
 * 5. Limpieza estricta de memoria (clearInterval / removeEventListener).
 */
export function useAutoSyncInvoices({
  client,
  invoices,
  setClient,
  setInvoices,
  hasResetConsultation,
  pendingDocument,
  pollingIntervalMs = 12000,
}: UseAutoSyncInvoicesProps) {
  const [isSyncingSilently, setIsSyncingSilently] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isPaymentCelebrationOpen, setIsPaymentCelebrationOpen] = useState(false);

  // Referencias para seguimiento de estado previo y control de concurrencia
  const isSyncingRef = useRef(false);
  const lastSyncCallTimeRef = useRef(0);
  const previousInvoicesRef = useRef<Invoice[]>(invoices);

  // Mantener actualizado el registro previo de facturas cuando cambien externamente
  useEffect(() => {
    if (invoices && invoices.length > 0) {
      previousInvoicesRef.current = invoices;
    }
  }, [invoices]);

  // Función principal de sincronización silenciosa
  const triggerSilentSync = useCallback(async () => {
    if (!client || hasResetConsultation) return;

    const serviceId = (client as any)?.id_servicio || client?.servicio?.idServicio || client?.id;
    const doc = client?.cedula || pendingDocument || "";
    if (!doc) return;

    // Evitar peticiones concurrentes o solapadas
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncingSilently(true);

    try {
      const fParams = new URLSearchParams();
      if (serviceId) fParams.set("id_servicio", String(serviceId));
      fParams.set("cedula", String(doc));
      fParams.set("_t", Date.now().toString());

      // Petición silenciosa a /api/facturas
      const facturasPromise = fetch(`/api/facturas?${fParams.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      // Petición paralela para comprobar estado del servicio por si fue reconectado
      const clientePromise = fetch(`/api/cliente/consultar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento: doc,
          id_servicio: serviceId ? String(serviceId) : undefined,
        }),
      }).catch(() => null);

      const [facturasRes, clienteRes] = await Promise.all([facturasPromise, clientePromise]);

      if (!facturasRes.ok) return;

      const data = await facturasRes.json();
      if (data.success && Array.isArray(data.facturas)) {
        const nuevasFacturas: Invoice[] = data.facturas;

        // Comprobación de detección de pago:
        // Buscar si alguna factura que antes estaba pendiente ahora pasó a pagada
        const facturasPrevias = previousInvoicesRef.current || [];
        let pagoDetectado = false;

        for (const prevInv of facturasPrevias) {
          const estabaPagada = isInvoicePaid(prevInv);
          if (!estabaPagada) {
            // Buscar la misma factura en la nueva lista
            const nuevaInv = nuevasFacturas.find(
              (n) => String(n.id) === String(prevInv.id) || (n.folio && n.folio === prevInv.folio)
            );

            if (nuevaInv && isInvoicePaid(nuevaInv)) {
              pagoDetectado = true;
              break;
            }
          }
        }

        // Actualizar el estado de facturas sin bloquear la pantalla
        setInvoices(nuevasFacturas);
        previousInvoicesRef.current = nuevasFacturas;

        // Recalcular saldo pendiente exacto
        const facturasPendientes = nuevasFacturas.filter((i) => !isInvoicePaid(i));
        const nuevoSaldo = facturasPendientes.reduce(
          (acc, inv) => acc + (inv.saldoPendiente || inv.total || 0),
          0
        );

        // Si la consulta de cliente retornó actualización de estado (ej: reconexión del servicio)
        let nuevoEstadoServicio: any = undefined;
        if (clienteRes && clienteRes.ok) {
          const cData = await clienteRes.json().catch(() => null);
          if (cData && cData.success && cData.cliente) {
            nuevoEstadoServicio = cData.cliente.estadoServicio || cData.cliente.estado;
          }
        }

        // Actualizar datos del cliente silenciosamente
        setClient((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            saldoTotalPendiente: nuevoSaldo,
            facturasPendientesCount: facturasPendientes.length,
            ...(nuevoEstadoServicio ? { estadoServicio: nuevoEstadoServicio } : {}),
          };
        });

        setLastSyncTime(new Date());

        // Si se detectó que una factura pasó a pagada, lanzar celebración, sonido sutil y modal emergente
        if (pagoDetectado) {
          // 1. Sonido sutil de confirmación
          playPaymentSuccessChime();

          // 2. Activar modal emergente destacado
          setIsPaymentCelebrationOpen(true);

          // 3. Confeti festivo
          try {
            confetti({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.55 },
              colors: ["#10b981", "#0284c7", "#f59e0b", "#38bdf8", "#34d399"],
            });
          } catch {
            // Manejo silencioso en caso de no soporte de canvas
          }

          // 4. Toast redundante con el texto exacto requerido
          toast.success("¡Pago Registrado con Éxito! 🎉", {
            description: "Gracias por tu pago, tu servicio se encuentra al día.",
            duration: 8000,
          });
        }
      }
    } catch (err) {
      console.warn("[useAutoSyncInvoices Warning]:", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncingSilently(false);
    }
  }, [client, hasResetConsultation, pendingDocument, setClient, setInvoices]);

  // Listener para sondeo periódico y visibilidad de pestaña / foco
  useEffect(() => {
    if (!client || hasResetConsultation) return;

    let timerId: NodeJS.Timeout | null = null;

    const handleCheckWithThrottle = () => {
      // Si la pestaña está oculta, no consultar
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      // Throttle de 3 segundos para evitar ráfagas al alternar ventanas
      const now = Date.now();
      if (now - lastSyncCallTimeRef.current < 3000) {
        return;
      }
      lastSyncCallTimeRef.current = now;

      triggerSilentSync();
    };

    // 1. Polling periódico cada X segundos (12s por defecto) mientras la ventana esté visible
    timerId = setInterval(() => {
      handleCheckWithThrottle();
    }, pollingIntervalMs);

    // 2. Revalidación inmediata al recuperar el foco de la pestaña (visibilitychange)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleCheckWithThrottle();
      }
    };

    // 3. Revalidación al enfocar la ventana (window.focus)
    const onWindowFocus = () => {
      handleCheckWithThrottle();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);

    // 4. Limpieza de memoria
    return () => {
      if (timerId) clearInterval(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [client, hasResetConsultation, pollingIntervalMs, triggerSilentSync]);

  const closePaymentCelebration = useCallback(() => {
    setIsPaymentCelebrationOpen(false);
  }, []);

  const triggerTestPaymentCelebration = useCallback(() => {
    playPaymentSuccessChime();
    setIsPaymentCelebrationOpen(true);
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#10b981", "#0284c7", "#f59e0b", "#38bdf8", "#34d399"],
      });
    } catch {}
    toast.success("¡Pago Registrado con Éxito! 🎉", {
      description: "Gracias por tu pago, tu servicio se encuentra al día.",
      duration: 8000,
    });
  }, []);

  return {
    isSyncingSilently,
    lastSyncTime,
    triggerSilentSync,
    isPaymentCelebrationOpen,
    closePaymentCelebration,
    triggerTestPaymentCelebration,
  };
}
