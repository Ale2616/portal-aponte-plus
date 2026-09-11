"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";

interface HomeAdCarouselProps {
  images: string[];
  titulo?: string;
  descripcion?: string;
  botonTexto?: string;
  whatsappUrl?: string;
  autoPlayInterval?: number; // default 4500ms
}

export function HomeAdCarousel({
  images,
  titulo,
  descripcion,
  botonTexto = "📲 Preguntar por WhatsApp",
  whatsappUrl,
  autoPlayInterval = 4500,
}: HomeAdCarouselProps) {
  // Si no hay imágenes válidas o el arreglo está vacío, retornar null (sin dejar espacios en blanco ni marcos vacíos)
  const validImages = Array.isArray(images) ? images.filter(Boolean) : [];
  if (validImages.length === 0) {
    return null;
  }
  const totalSlides = validImages.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

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

  // AutoPlay continuo cada 4.5 segundos
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [nextSlide, totalSlides, isPaused, autoPlayInterval]);

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
      // Swipe izquierda -> Siguiente
      nextSlide();
    } else if (diff < -minSwipeDistance) {
      // Swipe derecha -> Anterior
      prevSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
    setIsPaused(false);
  };

  return (
    <div
      className="w-full max-w-md mx-auto overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/25 bg-slate-900/90 shadow-xl shadow-cyan-950/30 transition-all select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ─── CONTENEDOR DEL SLIDER DE IMÁGENES (16:9 max-h-[220px] sm:max-h-[300px]) ───── */}
      <div className="relative w-full max-w-md aspect-[16/9] max-h-[220px] sm:max-h-[300px] rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
        
        {/* Pista de diapositivas deslizante */}
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {validImages.map((imgSrc, idx) => (
            <div
              key={`${imgSrc}-${idx}`}
              className="min-w-full h-full flex items-center justify-center bg-slate-950/90 flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={`Banner promocional ${idx + 1}`}
                className="w-full h-full object-contain pointer-events-none select-none"
                loading={idx === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>

        {/* Indicador numérico de diapositiva (ej. 1 / 3) si hay más de 1 */}
        {totalSlides > 1 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold text-white/90 shadow-md">
            {currentIndex + 1} / {totalSlides}
          </div>
        )}

        {/* Botones de navegación Anterior / Siguiente (visibles en hover o móviles) */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/60 hover:bg-slate-900 border border-white/15 text-white/80 hover:text-white transition-all backdrop-blur-xs cursor-pointer active:scale-90"
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/60 hover:bg-slate-900 border border-white/15 text-white/80 hover:text-white transition-all backdrop-blur-xs cursor-pointer active:scale-90"
              aria-label="Siguiente imagen"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Indicadores de puntos (Dots) interactivos en la parte inferior de la imagen */}
        {totalSlides > 1 && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-auto">
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
                    ? "w-6 h-2 bg-gradient-to-r from-amber-400 to-orange-400 shadow-sm shadow-amber-500/50"
                    : "w-2 h-2 bg-white/40 hover:bg-white/70"
                }`}
                aria-label={`Ir a la diapositiva ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── TEXTOS Y BOTÓN DE ACCIÓN WHATSAPP ────────────────────────────── */}
      <div className="p-4 sm:p-5 bg-slate-900 border-t border-cyan-500/15 space-y-3">
        {(titulo || descripcion) && (
          <div className="space-y-1">
            {titulo && (
              <h4 className="text-sm sm:text-base font-bold text-white leading-snug tracking-tight">
                {titulo}
              </h4>
            )}
            {descripcion && (
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
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
            className="w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{botonTexto}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export const BannerCarousel = HomeAdCarousel;
export default HomeAdCarousel;
