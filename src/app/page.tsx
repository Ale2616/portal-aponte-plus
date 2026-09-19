"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { GlobalAlertBanner } from "@/components/GlobalAlertBanner";
import { SearchScreen } from "@/components/SearchScreen";
import { StatusCard } from "@/components/StatusCard";
import { InvoiceList } from "@/components/InvoiceList";
import { PaymentModal } from "@/components/PaymentModal";
import { BankAccountsModal } from "@/components/BankAccountsModal";
import { InvoicePdfModal } from "@/components/InvoicePdfModal";
import { FaqModal } from "@/components/FaqModal";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { ClientProfile, Invoice, PaymentReportResult } from "@/lib/types";
import { branding } from "@/config/branding";
import { toast } from "sonner";
import { DirectPaymentCard } from "@/components/DirectPaymentCard";
import { PromoCarousel } from "@/components/PromoCarousel";
import { NetworkUsageCard } from "@/components/NetworkUsageCard";
import { SecretPinModal } from "@/components/SecretPinModal";
import { AdminControlModal } from "@/components/AdminControlModal";
import { SpeedTestModal } from "@/components/SpeedTestModal";
import { MultiLineSelectorModal, ServiceOption } from "@/components/MultiLineSelectorModal";
import { PushNotificationCard } from "@/components/PushNotificationCard";
import { Loader2, CheckCircle2, Radio } from "lucide-react";
import { useConfig } from "@/context/ConfigContext";
import { useAutoSyncInvoices } from "@/hooks/useAutoSyncInvoices";

// Función para extraer y capitalizar únicamente el primer nombre
const obtenerPrimerNombre = (nombreCompleto?: string): string => {
  if (!nombreCompleto) return "Cliente";
  const limpio = nombreCompleto.replace(/<[^>]*>?/gm, "").trim();
  const partes = limpio.split(/\s+/);
  const primer = partes[0] || "";
  if (primer.toLowerCase() === "abonado") return "Cliente";
  return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase();
};

function PortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshConfig } = useConfig();

  // Consulta de configuración pública en tiempo real y sin caché al cargar el portal
  useEffect(() => {
    fetch(`/api/config?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && refreshConfig) {
          refreshConfig();
        }
      })
      .catch((err) => console.warn("[Portal Config Fetch Error]:", err));
  }, [refreshConfig]);

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [originalClient, setOriginalClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasResetConsultation, setHasResetConsultation] = useState(false);

  // Selector multi-línea para clientes con múltiples contratos en WispHub
  const [multipleServices, setMultipleServices] = useState<ServiceOption[]>([]);
  const [isMultiLineModalOpen, setIsMultiLineModalOpen] = useState(false);
  const [pendingDocument, setPendingDocument] = useState<string>("");

  // Overlay bloqueante de cambio de línea de servicio
  const [cambiandoServicio, setCambiandoServicio] = useState(false);

  // Modals state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentInitialInvoiceId, setPaymentInitialInvoiceId] = useState<string | undefined>(undefined);
  const [isBankAccountsOpen, setIsBankAccountsOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isSpeedTestOpen, setIsSpeedTestOpen] = useState(false);
  const [selectedInvoiceForPdf, setSelectedInvoiceForPdf] = useState<Invoice | null>(null);
  const [paymentReportSuccessData, setPaymentReportSuccessData] = useState<PaymentReportResult | null>(null);

  // Puerta Secreta: Modal de PIN y Panel Administrativo
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [showAdminControlModal, setShowAdminControlModal] = useState(false);

  useEffect(() => {
    const handleOpenSecret = () => setShowAdminPinModal(true);
    window.addEventListener("open-admin-secret-pin", handleOpenSecret);
    return () => window.removeEventListener("open-admin-secret-pin", handleOpenSecret);
  }, []);

  const hasAutoLoggedRef = useRef(false);

  // Revalidación automática en segundo plano (Tab Focus / Polling cada 12s / Detección de pago silenciosa)
  const { isSyncingSilently, lastSyncTime } = useAutoSyncInvoices({
    client,
    invoices,
    setClient,
    setInvoices,
    hasResetConsultation,
    pendingDocument,
    pollingIntervalMs: 12000,
  });

  // Buscar cliente por documento de identidad y opcionalmente id_servicio
  const handleSearch = useCallback(
    async (documento: string, selectedServiceId?: string, preservedNombre?: string) => {
      const cleanDoc = documento ? documento.toString().trim() : "";
      if (!cleanDoc) return;

      setIsLoading(true);
      setError(null);
      setHasResetConsultation(false);

      try {
        const payload: { documento: string; id_servicio?: string } = { documento: cleanDoc };
        if (selectedServiceId) {
          payload.id_servicio = selectedServiceId;
        }

        const res = await fetch("/api/cliente/consultar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Cliente no encontrado. Verifica el número de documento.");
        }

        // Caso Multi-línea: Si la API retorna 2 o más servicios/contratos asociados a esa misma cédula
        // No cargues el primero por defecto. Activa un modal de selección.
        if (data.multipleServices === true && Array.isArray(data.servicios) && data.servicios.length >= 2) {
          setMultipleServices(data.servicios);
          setPendingDocument(cleanDoc);
          const firstNombre =
            data.nombre ||
            data.nombreTitular ||
            data.nombre_completo ||
            data.servicios.find((s: any) => s.nombre || s.nombre_completo)?.nombre ||
            preservedNombre ||
            "";
          if (firstNombre) {
            setOriginalClient((prev: any) => ({
              ...(prev || {}),
              nombre: firstNombre,
              nombre_completo: firstNombre,
              nombreCompleto: firstNombre,
              cedula: cleanDoc,
            }));
          }
          setIsMultiLineModalOpen(true);
          setIsLoading(false);
          return;
        }

        // Si la respuesta incluye lista de servicios, mantenerla para permitir cambiar de línea
        if (Array.isArray(data.servicios) && data.servicios.length > 0) {
          setMultipleServices(data.servicios);
        }

        // 2. Guardado en consulta exitosa: guarda en localStorage tanto la cédula como el 'id_servicio' seleccionado
        const effectiveServiceId =
          selectedServiceId ||
          data.id_servicio ||
          data.cliente?.id_servicio ||
          data.cliente?.servicio?.idServicio ||
          data.cliente?.id;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("cliente_cedula", cleanDoc);
            if (effectiveServiceId) {
              localStorage.setItem("cliente_id_servicio", String(effectiveServiceId));
            }
          } catch (e) {
            console.warn("[localStorage error]:", e);
          }
        }

        // Obtener el nombre específico de la línea o servicio seleccionado
        const nombreFinal =
          preservedNombre ||
          data.cliente?.nombreCompleto ||
          data.nombre ||
          data.nombreTitular ||
          originalClient?.nombreCompleto ||
          "Cliente Registrado";

        // Si data o data.servicios contiene el servicio o cliente activo original de WispHub:
        const servicioActivo = Array.isArray(data.servicios)
          ? data.servicios.find((s: any) => String(s.idServicio || s.id_servicio || s.id) === String(effectiveServiceId)) || data.servicios[0]
          : data.cliente?.servicio;

        if (servicioActivo) {
          if (!servicioActivo.fecha_instalacion && data.fecha_instalacion) {
            servicioActivo.fecha_instalacion = data.fecha_instalacion;
          }
          if (!servicioActivo.barrio && (data.barrio || data.cliente?.barrio)) {
            servicioActivo.barrio = data.barrio || data.cliente?.barrio;
          }
          if (!servicioActivo.ciudad || servicioActivo.ciudad.toLowerCase() === "colombia") {
            servicioActivo.ciudad = data.ciudad || data.cliente?.ciudad || "Curillo";
          }
          if (!servicioActivo.departamento || servicioActivo.departamento.toLowerCase() === "colombia") {
            servicioActivo.departamento = data.departamento || data.cliente?.departamento || "Caquetá";
          }
          if (!servicioActivo.modelo_router && (data.cliente?.servicio?.modelo_router || data.cliente?.servicio?.routerOnt)) {
            servicioActivo.modelo_router = data.cliente?.servicio?.modelo_router || data.cliente?.servicio?.routerOnt;
          }
          if (!servicioActivo.equipo && (data.cliente?.servicio?.equipo || servicioActivo.modelo_router)) {
            servicioActivo.equipo = data.cliente?.servicio?.equipo || servicioActivo.modelo_router;
          }
          if (!servicioActivo.mac && data.cliente?.servicio?.mac) {
            servicioActivo.mac = data.cliente?.servicio?.mac;
          }
        }

        const rawBarrioFinal = data.barrio || data.cliente?.barrio || servicioActivo?.barrio || originalClient?.barrio || "";
        const rawCiudadFinal = data.ciudad || data.cliente?.ciudad || servicioActivo?.ciudad || "Curillo";
        const rawDeptoFinal = data.departamento || data.cliente?.departamento || servicioActivo?.departamento || "Caquetá";

        const clienteActivo: ClientProfile = {
          ...data.cliente,
          cedula: cleanDoc || data.cliente?.cedula || data.cedula || originalClient?.cedula || "",
          telefono: data.cliente?.telefono || originalClient?.telefono || "",
          celular: data.cliente?.celular || originalClient?.celular || "",
          nombreCompleto: nombreFinal,
          barrio: rawBarrioFinal,
          ciudad: (!rawCiudadFinal || rawCiudadFinal.toLowerCase() === "colombia") ? "Curillo" : rawCiudadFinal,
          departamento: (!rawDeptoFinal || rawDeptoFinal.toLowerCase() === "colombia") ? "Caquetá" : rawDeptoFinal,
          fecha_instalacion: data.fecha_instalacion || data.cliente?.fecha_instalacion || servicioActivo?.fecha_instalacion,
          fecha_alta: data.fecha_alta || data.cliente?.fecha_alta || servicioActivo?.fecha_alta,
          fecha_ingreso: data.fecha_ingreso || data.cliente?.fecha_ingreso || servicioActivo?.fecha_ingreso,
          created_at: data.created_at || data.cliente?.created_at || servicioActivo?.created_at,
          servicioActivo: servicioActivo || data.cliente?.servicio,
          clienteActivo: data.cliente,
        };
        (clienteActivo as any).nombre = clienteActivo.nombreCompleto;
        (clienteActivo as any).id_servicio = effectiveServiceId;
        (clienteActivo as any).barrio = clienteActivo.barrio;
        (clienteActivo as any).ciudad = clienteActivo.ciudad;
        (clienteActivo as any).departamento = clienteActivo.departamento;
        (clienteActivo as any).servicioActivo = servicioActivo || data.cliente?.servicio;
        (clienteActivo as any).clienteActivo = data.cliente;
        (clienteActivo as any).fecha_instalacion = clienteActivo.fecha_instalacion;
        (clienteActivo as any).fecha_alta = clienteActivo.fecha_alta;
        (clienteActivo as any).fecha_ingreso = clienteActivo.fecha_ingreso;
        (clienteActivo as any).created_at = clienteActivo.created_at;

        setOriginalClient(clienteActivo);

        setClient(clienteActivo);
        let clientInvoices = data.facturas || [];

        // Sincronización proactiva con /api/facturas para garantizar la extracción total de facturas históricas
        try {
          const serviceId = effectiveServiceId || data.cliente?.servicio?.idServicio || "";
          const usuario = data.cliente?.usuario || data.usuario || "";
          const fParams = new URLSearchParams();
          if (serviceId) fParams.set("id_servicio", String(serviceId));
          if (cleanDoc) fParams.set("cedula", cleanDoc);
          if (usuario) fParams.set("usuario", usuario);

          const fRes = await fetch(`/api/facturas?${fParams.toString()}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            if (fData.success && Array.isArray(fData.facturas) && fData.facturas.length > 0) {
              clientInvoices = fData.facturas;
            }
          }
        } catch (fErr) {
          console.warn("[Facturas Sync Warning]:", fErr);
        }

        setInvoices(clientInvoices);

        // Actualizar URL con query params para permitir recargar o compartir
        if (typeof window !== "undefined") {
          const newUrl = new URL(window.location.href);
          newUrl.pathname = "/";
          newUrl.searchParams.set("cedula", cleanDoc);
          if (effectiveServiceId) {
            newUrl.searchParams.set("id_servicio", String(effectiveServiceId));
          }
          window.history.replaceState({}, "", newUrl.toString());
        }

        toast.success(`¡Bienvenid@, ${obtenerPrimerNombre(clienteActivo.nombreCompleto)}!`, {
          description: "Datos de tu servicio y facturación cargados correctamente.",
        });
      } catch (err: any) {
        console.error(err);
        setClient(null);
        setInvoices([]);
        setError(err.message || "Cliente no encontrado.");

        // Limpiar URL y localStorage si la cédula falló para no quedarse en bucle
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("cliente_cedula");
            localStorage.removeItem("cliente_id_servicio");
          } catch (e) {
            console.warn("[localStorage error]:", e);
          }
          window.history.replaceState({}, "", "/");
        }

        toast.error("Cliente no encontrado", {
          description: err.message || "El número ingresado no coincide con ningún cliente registrado.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [originalClient]
  );

  // Consulta en tiempo real de facturas vinculada al id_servicio activo y a la cédula
  const cargarFacturasPorServicio = useCallback(async (idServicio: string, cedula: string) => {
    if (!idServicio && !cedula) return;
    setIsLoadingInvoices(true);
    try {
      const fParams = new URLSearchParams();
      if (idServicio) fParams.set("id_servicio", String(idServicio));
      if (cedula) fParams.set("cedula", String(cedula));
      fParams.set("_t", Date.now().toString());

      const res = await fetch(`/api/facturas?${fParams.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) {
        console.warn(`[cargarFacturasPorServicio] Error HTTP ${res.status}`);
        return;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.facturas)) {
        const facturas: Invoice[] = data.facturas;
        setInvoices(facturas);

        // Actualizar el saldo pendiente exacto de esta línea seleccionada
        const facturasPendientes = facturas.filter((i: Invoice) => {
          const est = String(i.estado || "").toLowerCase().trim();
          const isPaid =
            est === "pagada" ||
            est === "pago" ||
            est === "pagado" ||
            est === "cancelada" ||
            est === "cobrada" ||
            (i.saldoPendiente === 0 && i.total > 0);
          return !isPaid && (i.saldoPendiente > 0 || est === "pendiente" || est === "vencida");
        });

        const nuevoSaldo = facturasPendientes.reduce(
          (acc: number, inv: Invoice) => acc + (inv.saldoPendiente || inv.total || 0),
          0
        );

        setClient((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            saldoTotalPendiente: nuevoSaldo,
            facturasPendientesCount: facturasPendientes.length,
          };
        });
      }
    } catch (err) {
      console.warn("[cargarFacturasPorServicio Warning]:", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, []);

  // Sincronización inicial de facturas vinculada al id_servicio activo además de la cédula
  const activeServiceId = String((client as any)?.id_servicio || client?.servicio?.idServicio || client?.id || "");
  const activeDocument = String(client?.cedula || pendingDocument || "");

  useEffect(() => {
    if (activeServiceId && activeDocument) {
      cargarFacturasPorServicio(activeServiceId, activeDocument);
    }
  }, [activeServiceId, activeDocument, cargarFacturasPorServicio]);

  // 2. Cambio de Línea Multi-Servicio: Overlay bloqueante + nombre de la línea seleccionada + ciclo completo
  const handleSelectService = useCallback(
    async (servicioSeleccionado: ServiceOption) => {
      // 1. Cerrar modal y activar overlay bloqueante
      setIsMultiLineModalOpen(false);
      setCambiandoServicio(true);

      // 2. Limpieza inmediata de estados anteriores para no mostrar datos cruzados
      setInvoices([]);
      setIsLoadingInvoices(true);
      setPaymentReportSuccessData(null);

      const targetDoc =
        pendingDocument ||
        client?.cedula ||
        (typeof window !== "undefined" ? localStorage.getItem("cliente_cedula") || "" : "");
      const selectedServiceId = String(
        servicioSeleccionado.id_servicio || servicioSeleccionado.idServicio || servicioSeleccionado.id || ""
      );

      // 3. NOMBRE ESPECÍFICO DE LA LÍNEA SELECCIONADA (prioridad: nombre de la tarjeta, no del titular original)
      const nombreLineaSeleccionada =
        servicioSeleccionado.nombre ||
        servicioSeleccionado.nombre_completo ||
        (servicioSeleccionado as any).alias ||
        originalClient?.nombre ||
        originalClient?.nombreCompleto ||
        client?.nombreCompleto ||
        "Cliente Registrado";

      // 4. Establecer el nuevo clienteActivo con datos exactos del contrato seleccionado
      const baseClient = originalClient || client;
      if (baseClient) {
        const updatedClient: ClientProfile = {
          ...baseClient,
          ...servicioSeleccionado,
          id: selectedServiceId || baseClient.id,
          cedula: targetDoc || baseClient.cedula,
          telefono: baseClient.telefono || "",
          celular: baseClient.celular || "",
          nombreCompleto: nombreLineaSeleccionada,
          direccion: servicioSeleccionado.direccion || baseClient.direccion,
          saldoTotalPendiente: 0,
          facturasPendientesCount: 0,
          plan: {
            ...(baseClient.plan || {}),
            nombre:
              servicioSeleccionado.planNombre ||
              servicioSeleccionado.plan ||
              servicioSeleccionado.plan_internet ||
              baseClient.plan?.nombre ||
              "Fibra Óptica",
            velocidadBajada: baseClient.plan?.velocidadBajada || "50 Mbps",
            velocidadSubida: baseClient.plan?.velocidadSubida || "50 Mbps",
            precioMensual: baseClient.plan?.precioMensual || 0,
            tecnologia: baseClient.plan?.tecnologia || "Fibra Óptica FTTH",
          },
          servicio: {
            ...(baseClient.servicio || {}),
            idServicio: selectedServiceId || baseClient.servicio?.idServicio,
            ip: servicioSeleccionado.ip || baseClient.servicio?.ip || "",
            nodo: servicioSeleccionado.nodo || baseClient.servicio?.nodo || "",
            routerOnt: servicioSeleccionado.equipo || servicioSeleccionado.modelo_router || baseClient.servicio?.routerOnt || "Router ONT Dual Band 5G",
            mac: servicioSeleccionado.mac || baseClient.servicio?.mac,
            modelo_router: servicioSeleccionado.modelo_router || (baseClient.servicio as any)?.modelo_router,
            equipo: servicioSeleccionado.equipo || (baseClient.servicio as any)?.equipo,
            barrio: servicioSeleccionado.barrio || baseClient.barrio,
            ciudad: servicioSeleccionado.ciudad || baseClient.ciudad,
            municipio: servicioSeleccionado.municipio || (baseClient.servicio as any)?.municipio,
            departamento: servicioSeleccionado.departamento || (baseClient.servicio as any)?.departamento,
            estado_provincia: servicioSeleccionado.estado_provincia || (baseClient.servicio as any)?.estado_provincia,
            fecha_instalacion: servicioSeleccionado.fecha_instalacion || (baseClient.servicio as any)?.fecha_instalacion,
            fecha_alta: servicioSeleccionado.fecha_alta || (baseClient.servicio as any)?.fecha_alta,
            fecha_ingreso: servicioSeleccionado.fecha_ingreso || (baseClient.servicio as any)?.fecha_ingreso,
            created_at: servicioSeleccionado.created_at || (baseClient.servicio as any)?.created_at,
            fechaCorte: baseClient.servicio?.fechaCorte || "",
            fechaLimitePago: baseClient.servicio?.fechaLimitePago || "",
            diaPago: baseClient.servicio?.diaPago || 1,
          },
        };
        (updatedClient as any).nombre = nombreLineaSeleccionada;
        (updatedClient as any).id_servicio = selectedServiceId;
        (updatedClient as any).direccion = servicioSeleccionado.direccion;
        (updatedClient as any).alias = (servicioSeleccionado as any).alias;
        (updatedClient as any).servicioActivo = servicioSeleccionado;
        (updatedClient as any).clienteActivo = baseClient;
        (updatedClient as any).fecha_instalacion = servicioSeleccionado.fecha_instalacion || (baseClient as any)?.fecha_instalacion;
        (updatedClient as any).fecha_alta = servicioSeleccionado.fecha_alta || (baseClient as any)?.fecha_alta;
        (updatedClient as any).fecha_ingreso = servicioSeleccionado.fecha_ingreso || (baseClient as any)?.fecha_ingreso;
        (updatedClient as any).created_at = servicioSeleccionado.created_at || (baseClient as any)?.created_at;
        setClient(updatedClient);
      }

      // 5. Persistir en localStorage y actualizar URL sin recargar
      if (typeof window !== "undefined") {
        try {
          if (targetDoc) localStorage.setItem("cliente_cedula", targetDoc);
          if (selectedServiceId) localStorage.setItem("cliente_id_servicio", selectedServiceId);
        } catch (e) {
          console.warn("[localStorage error]:", e);
        }
        const newUrl = new URL(window.location.href);
        newUrl.pathname = "/";
        newUrl.searchParams.set("cedula", targetDoc);
        if (selectedServiceId) newUrl.searchParams.set("id_servicio", selectedServiceId);
        window.history.replaceState({}, "", newUrl.toString());
      }

      // 6. Ejecutar consultas en paralelo: facturas + datos completos del servicio
      try {
        await Promise.all([
          cargarFacturasPorServicio(selectedServiceId, targetDoc),
          handleSearch(targetDoc, selectedServiceId, nombreLineaSeleccionada),
        ]);
      } catch (err) {
        console.warn("[handleSelectService] Error en sincronización:", err);
      } finally {
        // 7. Desactivar overlay bloqueante
        setCambiandoServicio(false);
      }
    },
    [pendingDocument, client, originalClient, cargarFacturasPorServicio, handleSearch]
  );

  // 1. Carga automática al abrir el portal (Auto-Login por URL ?cedula= o por localStorage)
  useEffect(() => {
    if (hasResetConsultation || hasAutoLoggedRef.current) return;

    // Primero, revisar si viene el parámetro 'cedula' o 'doc' en la URL
    const urlCedula = (searchParams.get("cedula") || searchParams.get("doc") || "").trim();
    const urlServiceId = (searchParams.get("id_servicio") || searchParams.get("servicio") || "").trim();
    if (urlCedula) {
      hasAutoLoggedRef.current = true;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("cliente_cedula", urlCedula);
          if (urlServiceId) localStorage.setItem("cliente_id_servicio", urlServiceId);
        } catch (e) {
          console.warn("[localStorage error]:", e);
        }
      }
      handleSearch(urlCedula, urlServiceId || undefined);
      return;
    }

    // Si no viene en la URL, buscar si existe 'cliente_cedula' y 'cliente_id_servicio' en localStorage
    if (typeof window !== "undefined") {
      try {
        const savedCedula = (localStorage.getItem("cliente_cedula") || "").trim();
        const savedServiceId = (localStorage.getItem("cliente_id_servicio") || "").trim();
        if (savedCedula && !client && !isLoading) {
          hasAutoLoggedRef.current = true;
          handleSearch(savedCedula, savedServiceId || undefined);
        }
      } catch (e) {
        console.warn("[localStorage error]:", e);
      }
    }
  }, [searchParams, client, isLoading, hasResetConsultation, handleSearch]);

  // 3. Botón "Nueva Consulta" (Cerrar sesión / Limpiar estado)
  const handleResetConsultation = useCallback(() => {
    setClient(null);
    setOriginalClient(null);
    setInvoices([]);
    setError(null);
    setMultipleServices([]);
    setPendingDocument("");
    setPaymentReportSuccessData(null);
    setHasResetConsultation(true);
    hasAutoLoggedRef.current = true;

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("cliente_cedula");
        localStorage.removeItem("cliente_id_servicio");
      } catch (e) {
        console.warn("[localStorage error]:", e);
      }
      window.history.replaceState({}, "", "/");
    }
    router.replace("/");
    toast.info("Consulta finalizada", {
      duration: 3000,
      description: "Puedes ingresar otro número de documento para consultar su servicio.",
    });
  }, [router]);

  // Filtro robusto de facturas con saldo pendiente (soporte multi-factura)
  const isPaidInvoice = (i: Invoice) => {
    const est = String(i.estado || "").toLowerCase().trim();
    return (
      est === "pagada" ||
      est === "pago" ||
      est === "pagado" ||
      est === "cancelada" ||
      est === "cobrada" ||
      (i.saldoPendiente === 0 && i.total > 0)
    );
  };

  const pendingInvoices = invoices.filter(
    (i) => !isPaidInvoice(i) && (i.saldoPendiente > 0 || i.estado === "pendiente" || i.estado === "vencida")
  );

  // Abrir modal de reporte de pago
  const handleOpenPayment = (invoice?: Invoice) => {
    if (invoice) {
      setPaymentInitialInvoiceId(invoice.id);
    } else {
      const firstPending = pendingInvoices[0] || invoices[0];
      setPaymentInitialInvoiceId(firstPending?.id);
    }
    setIsPaymentModalOpen(true);
  };

  // Actualizar factura tras reporte exitoso y activar mensaje de confirmación
  const handleSuccessReport = (result: PaymentReportResult) => {
    setPaymentReportSuccessData(result);
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === result.facturaFolio || inv.folio === result.facturaFolio
          ? { ...inv, tieneReportePendiente: true }
          : inv
      )
    );
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden flex flex-col justify-between bg-gradient-to-b from-slate-50 via-sky-50/20 to-slate-100 dark:from-[#060913] dark:via-[#081020] dark:to-[#05070f] text-slate-900 dark:text-slate-100 transition-colors relative">
      {/* Overlay bloqueante de cambio de línea de servicio */}
      {cambiandoServicio && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center select-none cursor-wait">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <div className="absolute w-8 h-8 border-4 border-cyan-400/20 border-b-cyan-400 rounded-full animate-spin [animation-direction:reverse]" />
          </div>
          <h3 className="mt-4 text-white font-bold text-base tracking-wide">Cargando línea de servicio...</h3>
          <p className="text-slate-400 text-xs mt-1">Sincronizando facturación, consumos y estado de red</p>
        </div>
      )}

      {/* Esferas de iluminación ambiental difusa (Dark tech / Telecomunicaciones fibra óptica) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Esfera superior izquierda: Azul eléctrico (#0284c7) */}
        <div className="absolute -top-36 -left-36 w-96 h-96 sm:w-[560px] sm:h-[560px] rounded-full bg-[#0284c7]/18 dark:bg-[#0284c7]/15 blur-[120px] animate-pulse" />
        {/* Esfera central derecha: Cian vibrante (#06b6d4) */}
        <div className="absolute top-1/4 -right-36 w-80 h-80 sm:w-[500px] sm:h-[500px] rounded-full bg-cyan-500/18 dark:bg-cyan-500/12 blur-[100px]" />
        {/* Esfera inferior: Verde esmeralda suave (#10b981) */}
        <div className="absolute -bottom-28 left-1/3 w-80 h-80 sm:w-[520px] sm:h-[520px] rounded-full bg-emerald-500/12 dark:bg-emerald-500/8 blur-[120px]" />
      </div>

      {/* Aviso Global de Mantenimiento (Controlado desde Panel Admin) */}
      <div className="relative z-10">
        <GlobalAlertBanner />
      </div>

      {/* Cabecera con botón Cambiar */}
      <div className="relative z-10">
        <Header
          client={client}
          onLogout={handleResetConsultation}
          onOpenBankAccounts={() => setIsBankAccountsOpen(true)}
          onOpenFaq={() => setIsFaqOpen(true)}
          onOpenAdminPin={() => setShowAdminPinModal(true)}
        />
      </div>

      {/* Contenido Principal */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 md:py-10 pb-24 sm:pb-12 flex flex-col items-center justify-start">
        {!client ? (
          <SearchScreen
            onSearch={handleSearch}
            isLoading={isLoading}
            error={error}
            onOpenAdminPin={() => setShowAdminPinModal(true)}
            onOpenSpeedTest={() => setIsSpeedTestOpen(true)}
          />
        ) : (
          <div className="w-full space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {/* Mensaje de Confirmación de Pago Exitoso */}
            {paymentReportSuccessData && (
              <div className="rounded-3xl p-5 sm:p-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/20 backdrop-blur-xl animate-in zoom-in-95 duration-250 ease-[cubic-bezier(0.165,0.84,0.44,1)]">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      ¡Comprobante enviado con éxito!
                    </h4>
                    <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                      Su pago será verificado en el sistema en un transcurso de 30 a 60 minutos. Radicado asignado:{" "}
                      <strong className="font-sans font-bold tracking-tight tabular-nums">{paymentReportSuccessData.radicado}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentReportSuccessData(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] hover:scale-[1.01] text-white shadow-md shadow-emerald-600/30 transition-all duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)] self-start sm:self-auto cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            )}

            {/* 1. Carrusel de Publicidad y Promociones */}
            <PromoCarousel />

            {/* Barra Informativa de Servicios Múltiples Asociados */}
            {multipleServices.length > 1 && (
              <div className="rounded-2xl p-3 sm:p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md transition-colors">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-sky-200">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-600 dark:bg-sky-400" />
                  </span>
                  <span className="leading-snug font-medium">
                    Tienes{" "}
                    <strong className="font-bold text-sky-950 dark:text-white tabular-nums">
                      {multipleServices.length} servicios
                    </strong>{" "}
                    registrados con tu documento.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDocument(client.cedula);
                    setIsMultiLineModalOpen(true);
                  }}
                  className="self-end sm:self-auto px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white dark:bg-sky-400 dark:hover:bg-sky-300 dark:text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Cambiar servicio</span>
                </button>
              </div>
            )}

            {/* Tarjeta Principal de Saldo con botón Cambiar */}
            <StatusCard
              client={client}
              onOpenPayment={() => handleOpenPayment()}
              onOpenBankAccounts={() => setIsBankAccountsOpen(true)}
              onChangeUser={handleResetConsultation}
            />

            {/* 3. Tarjeta de Métricas y Tráfico de Red */}
            <NetworkUsageCard client={client} invoices={invoices} />

            {/* Banner de Notificaciones Push Web para Confirmación de Pagos */}
            <PushNotificationCard
              cedula={client.cedula}
              idServicio={client.id_servicio || client.servicio?.idServicio?.toString()}
            />

            {/* 4. Canales de Pago Directo (Estilo Fintech) */}
            <DirectPaymentCard onOpenReport={() => handleOpenPayment()} />

            {/* 5. Historial Completo de Facturas con Pestañas y Revalidación en Segundo Plano */}
            <div className="space-y-2.5">
              {/* Indicador discreto de sincronización automática en vivo */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 text-xs font-sans shadow-xs transition-colors">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full ${
                        isSyncingSilently ? "animate-ping bg-sky-400 opacity-75" : "bg-emerald-400 opacity-40"
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isSyncingSilently ? "bg-sky-500" : "bg-emerald-500"
                      }`}
                    />
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">
                    {isSyncingSilently
                      ? "Verificando pagos en tiempo real..."
                      : "Sincronización en vivo activa (actualiza automáticamente al pagar)"}
                  </span>
                </div>
                {lastSyncTime && (
                  <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 tabular-nums font-medium">
                    Actualizado: {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
              </div>

              <InvoiceList
                invoices={invoices}
                isLoading={isLoadingInvoices}
                onViewPdf={(invoice) => setSelectedInvoiceForPdf(invoice)}
                onPayInvoice={(invoice) => handleOpenPayment(invoice)}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/60 dark:border-slate-800/70 bg-white/50 dark:bg-[#060913]/60 backdrop-blur-md py-6 text-center text-xs text-slate-500 dark:text-slate-400 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            © {new Date().getFullYear()} {branding.companyName} ({branding.legalName}). NIT: {branding.nit}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Plataforma oficial • Internet Aponte Plus</span>
            <span>•</span>
            <button
              onClick={() => setIsFaqOpen(true)}
              className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-medium"
            >
              Centro de Ayuda
            </button>
          </p>
        </div>
      </footer>

      {/* Modal de Reporte de Pago */}
      {client && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          client={client}
          pendingInvoices={pendingInvoices}
          initialInvoiceId={paymentInitialInvoiceId}
          onSuccessReport={handleSuccessReport}
        />
      )}

      {/* Modal de Cuentas Bancarias */}
      <BankAccountsModal
        isOpen={isBankAccountsOpen}
        onClose={() => setIsBankAccountsOpen(false)}
      />

      {/* Modal de Factura PDF */}
      {selectedInvoiceForPdf && (
        <InvoicePdfModal
          invoice={selectedInvoiceForPdf}
          client={client}
          isOpen={Boolean(selectedInvoiceForPdf)}
          onClose={() => setSelectedInvoiceForPdf(null)}
          onPayClick={(inv) => handleOpenPayment(inv)}
        />
      )}

      {/* Modal de FAQs */}
      <FaqModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
        clientName={client?.nombreCompleto}
        cedula={client?.cedula}
      />

      {/* Puerta Secreta: Modal de PIN Administrativo (PIN 1130) */}
      <SecretPinModal
        isOpen={showAdminPinModal}
        onClose={() => setShowAdminPinModal(false)}
        onSuccess={() => {
          setShowAdminPinModal(false);
          setShowAdminControlModal(true);
        }}
      />

      {/* Modal de Panel de Control Interno */}
      <AdminControlModal
        isOpen={showAdminControlModal}
        onClose={() => setShowAdminControlModal(false)}
      />

      {/* Modal Interactivo de Test de Velocidad (Red Azteca / Aponte Plus) */}
      <SpeedTestModal
        isOpen={isSpeedTestOpen}
        onClose={() => setIsSpeedTestOpen(false)}
      />

      {/* Modal Selector para clientes con múltiples líneas */}
      <MultiLineSelectorModal
        isOpen={isMultiLineModalOpen}
        onClose={() => setIsMultiLineModalOpen(false)}
        documento={pendingDocument}
        servicios={multipleServices}
        onSelectService={handleSelectService}
        isLoading={isLoading}
      />

      {/* Botón Flotante Persistente de WhatsApp */}
      <WhatsAppFloat client={client} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090d16] text-slate-600 dark:text-slate-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Cargando portal de autogestión...</p>
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
