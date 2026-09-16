"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Home, Radio, ArrowRight, ShieldCheck, CheckCircle2, X } from "lucide-react";

export interface ServiceOption {
  idServicio?: string;
  id_servicio?: string | number;
  id?: string | number;
  idCliente?: string;
  nombre?: string;
  nombre_completo?: string;
  direccion?: string;
  alias?: string;
  planNombre?: string;
  plan_internet?: string | any;
  plan?: string;
  estado?: string;
  ip?: string;
  nodo?: string;
  [key: string]: any;
}

interface MultiLineSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: string;
  servicios: ServiceOption[];
  onSelectService: (service: ServiceOption) => void;
  isLoading?: boolean;
}

const limpiarTexto = (texto: any): string => {
  if (!texto) return "";
  const str = typeof texto === "object" ? (texto.nombre || texto.name || texto.descripcion || "") : String(texto);
  return str
    .replace(/<[^>]*>?/gm, "") // Borra etiquetas <p>, <div>, etc.
    .replace(/&nbsp;/g, " ")   // Borra espacios HTML
    .trim();
};

export function MultiLineSelectorModal({
  isOpen,
  onClose,
  documento,
  servicios,
  onSelectService,
  isLoading = false,
}: MultiLineSelectorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloqueo estricto del scroll del fondo (body scroll-lock)
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow || "unset";
        document.documentElement.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleCardClick = (service: ServiceOption) => {
    if (isLoading) return;
    const sId = String(service.id_servicio || service.idServicio || service.id || "");
    setSelectedId(sId);
    onSelectService(service);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl transition-colors duration-200 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow sutil superior */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 dark:via-blue-500/50 to-transparent pointer-events-none" />

        {/* ─── HEADER DEL MODAL ─────────────────────────────────────────── */}
        <div className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                  <Radio className="w-5 h-5" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">
                  Líneas asociadas a tu documento
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed pt-1">
                Hemos detectado varios servicios activos a tu nombre. Selecciona cuál deseas consultar:
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {documento && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 text-xs font-semibold shadow-sm transition-colors">
              <span>Cédula:</span>
              <span className="text-slate-900 dark:text-white font-bold tracking-tight tabular-nums font-sans">
                {limpiarTexto(documento)}
              </span>
              <span className="text-blue-400 dark:text-blue-400/80 font-normal">•</span>
              <span className="text-blue-800 dark:text-blue-200 font-medium tracking-tight tabular-nums font-sans">
                {servicios.length} {servicios.length === 1 ? "Servicio" : "Servicios"}
              </span>
            </div>
          )}
        </div>

        {/* ─── LISTA DE TARJETAS INTERACTIVAS (CLICKEABLES) ─────────────── */}
        <div className="p-5 sm:p-6 space-y-3 max-h-[60vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] dark:[scrollbar-color:#334155_transparent]">
          {servicios.map((servicio, idx) => {
            const idServicio = String(servicio.id_servicio || servicio.idServicio || servicio.id || "");
            const isSelected = selectedId === idServicio;

            // 1. Título Principal (Arriba, destacado en negrita): Nombre del cliente / servicio
            const rawNombre = servicio.nombre || servicio.nombre_completo || `Servicio #${idServicio}`;
            const nombreServicio = limpiarTexto(rawNombre);

            // 2. Subtítulo / Dirección (Abajo del nombre): Dirección del predio COMPLETA sin recortar
            const rawDireccion = servicio.direccion || servicio.alias || "";
            const direccionServicio = limpiarTexto(rawDireccion);

            // 3. Plan Contratado
            const planContratado = limpiarTexto(servicio.plan_internet || servicio.plan || servicio.planNombre || "Fibra Óptica");

            // 4. Estado y Badge: "Activo" (verde) o "Suspendido" (amarillo/naranja)
            const rawEstado = String(servicio.estado ?? "Activo").toLowerCase();
            const isActivo = rawEstado === "activo" || rawEstado === "1" || rawEstado.includes("act");
            const estadoTexto = isActivo ? "Activo" : "Suspendido";

            // Icono de casa / antena
            const searchContext = (nombreServicio + " " + direccionServicio).toLowerCase();
            const isHouse =
              searchContext.includes("casa") ||
              searchContext.includes("hogar") ||
              searchContext.includes("apto") ||
              searchContext.includes("barrio") ||
              idx % 2 === 0;

            return (
              <button
                key={idServicio || idx}
                type="button"
                disabled={isLoading}
                onClick={() => handleCardClick(servicio)}
                className={`w-full text-left p-4 rounded-2xl cursor-pointer transition-all duration-200 border group flex items-center justify-between gap-4 ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/90 dark:bg-blue-950/50 ring-2 ring-blue-400/40 shadow-sm"
                    : "bg-slate-50 hover:bg-blue-50/70 border-slate-200 hover:border-blue-400 dark:bg-slate-900/70 dark:hover:bg-blue-950/40 dark:border-slate-800 dark:hover:border-blue-500"
                } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Icono de Casa / Antena */}
                  <div
                    className={`p-2.5 rounded-xl flex-shrink-0 transition-colors mt-0.5 ${
                      isSelected
                        ? "bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/70"
                    }`}
                  >
                    {isHouse ? (
                      <Home className="w-5 h-5" strokeWidth={2} />
                    ) : (
                      <Radio className="w-5 h-5" strokeWidth={2} />
                    )}
                  </div>

                  {/* Datos del Servicio */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Título Principal: Nombre del cliente/servicio asignado */}
                    <h4 className="text-slate-900 dark:text-white font-bold text-sm leading-snug break-words group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                      {nombreServicio}
                    </h4>

                    {/* Subtítulo / Dirección: Dirección del predio COMPLETA sin recortar (CERO TRUNCATE) */}
                    {direccionServicio && (
                      <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5 break-words whitespace-normal leading-relaxed">
                        {direccionServicio}
                      </p>
                    )}

                    {/* Fila de datos técnicos: Pastillas de ID y Plan */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 text-[11px] font-medium rounded-lg px-2.5 py-0.5 font-sans tracking-tight tabular-nums">
                        ID: {idServicio}
                      </span>
                      <span className="bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 text-[11px] font-medium rounded-lg px-2.5 py-0.5 font-sans">
                        Plan: {planContratado}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Badge de estado a la derecha y flecha */}
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isActivo
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800"
                    }`}
                  >
                    {estadoTexto}
                  </span>
                  <div className="p-1 rounded-lg text-slate-400 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all">
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ─── FOOTER ───────────────────────────────────────────────────── */}
        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between text-xs transition-colors">
          <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            🛡️ Conexión oficial y cifrada • Internet Aponte Plus
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs font-medium cursor-pointer transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
