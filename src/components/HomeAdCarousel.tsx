"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

interface BannerItemData {
  id?: string;
  url: string;
  active?: boolean;
  activo?: boolean;
}

interface HomeAdCarouselProps {
  images?: string[];
  banners?: BannerItemData[];
  titulo?: string;
  descripcion?: string;
  botonTexto?: string;
  whatsappUrl?: string;
  autoPlayInterval?: number; // default 4500ms
}

export function HomeAdCarousel({
  images,
  banners,
  titulo,
  descripcion,
  botonTexto = "Preguntar por WhatsApp",
  whatsappUrl,
  autoPlayInterval = 4500,
}: HomeAdCarouselProps) {
  const cleanBotonTexto = (botonTexto || "Preguntar por WhatsApp")
    .replace(/📲/g, "")
    .replace(/💬/g, "")
    .trim() || "Preguntar por WhatsApp";

  // Función estricta para validar que una imagen sea válida y NO apunte a banners 404
  const isSafeImage = (src: any): boolean => {
    if (!src || typeof src !== "string") return false;
    const trimmed = src.trim();
    if (!trimmed) return false;
    if (
      trimmed.includes("banner1.webp") ||
      trimmed.includes("banner2.webp") ||
      trimmed.includes("banner3.webp")
    ) {
      return false;
    }
    return (
      trimmed.startsWith("data:image/") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/")
    );
  };

  // Aplica el filtro: muestra solo promociones con activo === true y URLs válidas
  let validImages: string[] = [];
  if (Array.isArray(banners) && banners.length > 0) {
    validImages = banners
      .filter((b) => (b.activo !== undefined ? b.activo === true : b.active === true))
      .map((b) => b.url)
      .filter(isSafeImage);
  } else if (Array.isArray(images)) {
    validImages = images.filter(isSafeImage);
  }

  const totalSlides = Math.max(1, validImages.length);

  // REGLA DE ORO DE HOOKS: Todos los hooks se declaran incondicionalmente en la parte superior
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Funciones de navegación
  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // AutoPlay continuo cada 4.5 segundos (se pausa si se abre el zoom o se pasa el mouse)
  useEffect(() => {
    if (validImages.length <= 1 || isPaused || isZoomOpen) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [nextSlide, validImages.length, isPaused, isZoomOpen, autoPlayInterval]);

  // Soporte Táctil (Swipe) para dispositivos móviles
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) {
      setIsPaused(false);
      return;
    }

    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45; // Distancia mínima en píxeles para reconocer el swipe

    if (diff > minSwipeDistance) {
      nextSlide();
    } else if (diff < -minSwipeDistance) {
      prevSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
    setIsPaused(false);
  };

  // Manejo de teclado (Escape, Flechas) y bloqueo de scroll al abrir el Lightbox
  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsZoomOpen(false);
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === "ArrowRight") {
        nextSlide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow || "unset";
      document.documentElement.style.overflow = "";
    };
  }, [isZoomOpen, prevSlide, nextSlide]);

  // FALLBACK LIMPIO EN GRADIENTE INSTITUCIONAL SI NO HAY IMÁGENES O ESTÁN VACÍAS
  if (validImages.length === 0) {
    return (
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto overflow-hidden rounded-3xl border border-blue-700/40 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white shadow-2xl shadow-blue-950/40 p-6 sm:p-7 relative select-none">
        {/* Glows ambientales sutiles */}
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          {/* Logo y Badge de Empresa */}
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="Internet Aponte Plus"
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover border border-white/20 shadow-md flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="text-left">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                100% Fibra Óptica
              </span>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
                Internet Aponte Plus
              </h3>
            </div>
          </div>

          {/* Titulo y Descripción */}
          <div className="space-y-1.5 max-w-md">
            <h4 className="text-sm sm:text-base font-bold text-cyan-100">
              {titulo || "¡Pásate a Fibra Óptica con Alta Velocidad!"}
            </h4>
            <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
              {descripcion ||
                "Disfruta de la mejor conexión con máxima estabilidad, ultra velocidad y atención personalizada en tu hogar o negocio."}
            </p>
          </div>

          {/* Botón de WhatsApp institucional */}
          <div className="pt-2 w-full sm:w-auto">
            <a
              href={
                whatsappUrl ||
                "https://wa.me/573185577157?text=Hola%2C%20vi%20la%20promoci%C3%B3n%20en%20el%20portal%20y%20deseo%20m%C3%A1s%20informaci%C3%B3n%20sobre%20el%20servicio%20de%20internet"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-lg shadow-emerald-950/30 transition-all cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/chat-bubble.png"
                alt="WhatsApp"
                className="w-4 h-4 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span>{cleanBotonTexto}</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto overflow-hidden rounded-2xl border border-slate-200/80 dark:border-cyan-500/20 bg-white dark:bg-[#0c1322] shadow-xl shadow-slate-200/50 dark:shadow-cyan-950/20 transition-all select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ─── CONTENEDOR DE LA FOTO (Fondo transparente/adaptativo sin barras negras) ───── */}
        <div
          className="w-full h-[380px] sm:h-[480px] md:h-[560px] bg-transparent flex items-center justify-center overflow-hidden rounded-t-2xl relative cursor-zoom-in group/img"
          onClick={() => setIsZoomOpen(true)}
          title="Toca para ver en pantalla completa y apreciar todos los detalles"
        >
          {/* Pista de diapositivas deslizante */}
          <div
            className="flex h-full w-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {validImages.map((imgSrc, idx) => (
              <div
                key={`${imgSrc}-${idx}`}
                className="min-w-full h-full flex items-center justify-center bg-transparent flex-shrink-0 p-1 sm:p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={`Banner promocional ${idx + 1}`}
                  className="max-h-full max-w-full object-contain mx-auto pointer-events-none select-none transition-transform duration-300 group-hover/img:scale-[1.01]"
                  loading={idx === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>

          {/* Botón Lupa / Ampliar en la esquina superior izquierda */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomOpen(true);
            }}
            className="absolute top-3 left-3 px-2.5 py-1.5 rounded-full bg-white/85 hover:bg-white dark:bg-slate-800/85 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-white/20 text-slate-700 dark:text-white backdrop-blur-md transition-all shadow-md active:scale-95 z-20 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Ver imagen en tamaño completo"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-[11px]">Ampliar</span>
          </button>

          {/* Indicador numérico de diapositiva (ej. 1 / 3) si hay más de 1 */}
          {totalSlides > 1 && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/85 dark:bg-slate-800/85 backdrop-blur-md border border-slate-200/80 dark:border-white/10 text-[10px] font-mono font-bold text-slate-700 dark:text-white/90 shadow-md pointer-events-none">
              {currentIndex + 1} / {totalSlides}
            </div>
          )}

          {/* Botones de navegación Anterior / Siguiente */}
          {totalSlides > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border border-slate-200/80 dark:border-white/15 text-slate-700 dark:text-white transition-all backdrop-blur-md cursor-pointer active:scale-90 shadow-sm"
                aria-label="Anterior imagen"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border border-slate-200/80 dark:border-white/15 text-slate-700 dark:text-white transition-all backdrop-blur-md cursor-pointer active:scale-90 shadow-sm"
                aria-label="Siguiente imagen"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Indicadores de puntos (Dots) interactivos */}
          {totalSlides > 1 && (
            <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-auto">
              {validImages.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(dotIdx);
                  }}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    dotIdx === currentIndex
                      ? "w-6 h-2 bg-gradient-to-r from-cyan-500 to-blue-600 shadow-sm shadow-cyan-500/50"
                      : "w-2 h-2 bg-slate-300 dark:bg-white/40 hover:bg-slate-400 dark:hover:bg-white/70"
                  }`}
                  aria-label={`Ir a la diapositiva ${dotIdx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── DEBAJO DE LA IMAGEN (Contenedor sin fondo negro, adaptativo y limpio) ─── */}
        <div className="p-4 space-y-2 bg-slate-50/80 dark:bg-[#0c1322]/90 border-t border-slate-200/60 dark:border-slate-800/80">
          {(titulo || descripcion) && (
            <div className="space-y-1">
              {titulo && (
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug tracking-tight">
                  {titulo}
                </h4>
              )}
              {descripcion && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {descripcion}
                </p>
              )}
            </div>
          )}

          <div className="pt-1">
            <a
              href={whatsappUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/chat-bubble.png"
                alt="Chat"
                className="w-5 h-5 flex-shrink-0 object-contain drop-shadow-xs"
              />
              <span className="truncate">{cleanBotonTexto}</span>
            </a>
          </div>
        </div>
      </div>

      {/* ─── MODAL LIGHTBOX PANTALLA COMPLETA (Para apreciar hasta el más mínimo detalle) ─── */}
      {mounted && isZoomOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 select-none overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Barra Superior */}
          <div
            className="w-full flex items-center justify-end z-10 px-2 py-1 max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsZoomOpen(false)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-white transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-semibold ml-auto"
              title="Cerrar vista ampliada"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>

          {/* Contenedor Central con la Imagen en Tamaño Completo */}
          <div
            className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-1 sm:p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={validImages[currentIndex]}
              alt={`Detalle de promoción ${currentIndex + 1}`}
              className="max-h-[82vh] max-w-[96vw] object-contain rounded-xl shadow-2xl drop-shadow-[0_0_35px_rgba(0,0,0,0.85)] select-auto pointer-events-auto"
            />

            {/* Flechas de Navegación en Pantalla Completa */}
            {totalSlides > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevSlide();
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/20 text-white transition-all shadow-xl active:scale-90 cursor-pointer"
                  aria-label="Anterior imagen"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextSlide();
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/20 text-white transition-all shadow-xl active:scale-90 cursor-pointer"
                  aria-label="Siguiente imagen"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Barra Inferior con Botón de WhatsApp */}
          <div
            className="w-full max-w-md flex items-center justify-center gap-3 pb-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98] cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/chat-bubble.png"
                  alt="Chat"
                  className="w-5 h-5 flex-shrink-0 object-contain drop-shadow-xs"
                />
                <span>{cleanBotonTexto}</span>
              </a>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export const BannerCarousel = HomeAdCarousel;
export default HomeAdCarousel;

