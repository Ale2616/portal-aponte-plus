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
import { Loader2, CheckCircle2 } from "lucide-react";

function PortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

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

  // Buscar cliente por documento de identidad
  const handleSearch = useCallback(
    async (documento: string) => {
      const cleanDoc = documento ? documento.toString().trim() : "";
      if (!cleanDoc) return;

      setIsLoading(true);
      setError(null);
      setHasLoggedOut(false);

      try {
        const res = await fetch("/api/cliente/consultar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documento: cleanDoc }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Abonado no encontrado. Verifica el número de documento.");
        }

        setClient(data.cliente);
        let clientInvoices = data.facturas || [];

        // Sincronización proactiva con /api/facturas para garantizar la extracción total de facturas históricas
        try {
          const serviceId = data.cliente?.servicio?.idServicio || "";
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

        // Actualizar URL con query param para permitir recargar o compartir
        if (typeof window !== "undefined") {
          const newUrl = new URL(window.location.href);
          newUrl.pathname = "/";
          newUrl.searchParams.set("cedula", cleanDoc);
          window.history.replaceState({}, "", newUrl.toString());
        }

        toast.success(`¡Bienvenid@, ${data.cliente.nombreCompleto.split(" ")[0]}!`, {
          description: "Datos de tu servicio y facturación cargados correctamente.",
        });
      } catch (err: any) {
        console.error(err);
        setClient(null);
        setInvoices([]);
        setError(err.message || "Abonado no encontrado.");

        // Limpiar URL si la cédula falló para no quedarse en bucle
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/");
        }

        toast.error("Abonado no encontrado", {
          description: err.message || "El número ingresado no coincide con ningún abonado registrado.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Magic Link: Detectar si la URL contiene ?cedula=... o ?doc=...
  useEffect(() => {
    if (hasLoggedOut) return;
    const magicCedula = searchParams.get("cedula") || searchParams.get("doc");
    if (magicCedula && !client && !isLoading) {
      handleSearch(magicCedula);
    }
  }, [searchParams, client, isLoading, hasLoggedOut, handleSearch]);

  // Cerrar sesión / Cambiar de usuario
  const handleLogout = useCallback(() => {
    setClient(null);
    setInvoices([]);
    setError(null);
    setPaymentReportSuccessData(null);
    setHasLoggedOut(true);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
    router.replace("/");
    toast.info("Has cerrado tu consulta de abonado.", {
      duration: 3000,
      description: "Puedes ingresar nuevamente con tu número de documento.",
    });
  }, [router]);

  // Abrir modal de reporte de pago
  const handleOpenPayment = (invoice?: Invoice) => {
    if (invoice) {
      setPaymentInitialInvoiceId(invoice.id);
    } else {
      const firstPending = invoices.find((i) => i.estado !== "pagada");
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

  const pendingInvoices = invoices.filter((i) => i.estado !== "pagada");

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden flex flex-col justify-between bg-gradient-to-b from-slate-50 via-sky-50/20 to-slate-100 dark:from-[#060913] dark:via-[#081020] dark:to-[#05070f] text-slate-900 dark:text-slate-100 transition-colors relative">
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
          onLogout={handleLogout}
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
          <div className="space-y-8 animate-in fade-in duration-300">
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

            {/* 2. Saludo y Tarjeta Principal de Saldo con botón Cambiar */}
            <StatusCard
              client={client}
              onOpenPayment={() => handleOpenPayment()}
              onOpenBankAccounts={() => setIsBankAccountsOpen(true)}
              onChangeUser={handleLogout}
            />

            {/* 3. Tarjeta de Métricas y Tráfico de Red */}
            <NetworkUsageCard client={client} />

            {/* 4. Canales de Pago Directo (Estilo Fintech) */}
            <DirectPaymentCard onOpenReport={() => handleOpenPayment()} />

            {/* 5. Historial Completo de Facturas con Pestañas */}
            <InvoiceList
              invoices={invoices}
              onViewPdf={(invoice) => setSelectedInvoiceForPdf(invoice)}
              onPayInvoice={(invoice) => handleOpenPayment(invoice)}
            />
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
            <span>Plataforma integrada con WispHub API</span>
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
      <InvoicePdfModal
        invoice={selectedInvoiceForPdf}
        client={client}
        isOpen={Boolean(selectedInvoiceForPdf)}
        onClose={() => setSelectedInvoiceForPdf(null)}
        onPayClick={(inv) => handleOpenPayment(inv)}
      />

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
