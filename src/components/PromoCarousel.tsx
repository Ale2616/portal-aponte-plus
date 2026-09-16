"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { branding } from "@/config/branding";
import { useConfig, PromotionItem } from "@/context/ConfigContext";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  Sparkles,
  ArrowRight,
  MessageCircle,
} from "lucide-react";

export function PromoCarousel() {
  const { config } = useConfig();
  const promotions = (config.promotions || []).filter((p) => p.activo === true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const total = promotions.length;

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (isPaused || total <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 5500);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide, total]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) {
      nextSlide();
    } else if (diff < -50) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleActionClick = (promo: PromotionItem) => {
    const rawPhone = config.companyInfo.supportPhone || branding.supportPhone;
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const fullPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(promo.whatsappMensaje)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "Zap":
        return <Zap className="w-5 h-5 text-amber-300" strokeWidth={2} />;
      case "Users":
        return <Users className="w-5 h-5 text-emerald-300" strokeWidth={2} />;
      case "Sparkles":
        return <Sparkles className="w-5 h-5 text-yellow-300" strokeWidth={2} />;
      default:
        return <Zap className="w-5 h-5 text-white" strokeWidth={2} />;
    }
  };

  if (total === 0) {
    return null;
  }

  const safeIndex = currentIndex % total;
  const currentPromo = promotions[safeIndex];

  return (
    <div
      className="w-full relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Banner Card */}
      <div
        className={`relative overflow-hidden rounded-3xl text-white shadow-xl transition-all duration-500 bg-gradient-to-r ${currentPromo.gradiente} border border-white/15`}
      >
        {/* Foto de la promoción si existe, separada del texto */}
        {currentPromo.imagenUrl && (
          <div className="w-full h-[380px] sm:h-[480px] md:h-[540px] bg-black/15 dark:bg-black/25 backdrop-blur-xs flex items-center justify-center overflow-hidden rounded-t-3xl relative p-1 sm:p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPromo.imagenUrl}
              alt={currentPromo.titulo}
              className="max-h-full max-w-full object-contain mx-auto pointer-events-none select-none"
            />
          </div>
        )}

        {/* Glow Effects de fondo */}
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-black/15 blur-2xl pointer-events-none" />

        <div className="p-5 sm:p-7 pb-4 sm:pb-5 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-xl">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-black/25 backdrop-blur-md border border-white/20 text-white/90 shadow-sm">
              {renderIcon(currentPromo.icono)}
              <span>{currentPromo.tag}</span>
            </div>

            {/* Titulo */}
            <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight text-white leading-tight drop-shadow-sm">
              {currentPromo.titulo}
            </h3>

            {/* Descripción */}
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
              {currentPromo.descripcion}
            </p>
          </div>

          {/* Botón de Acción */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <button
              onClick={() => handleActionClick(currentPromo)}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/20 cursor-pointer flex-shrink-0"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" strokeWidth={2} />
              <span>{currentPromo.botonTexto}</span>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Indicadores de Páginas (Dots) y Flechas con padding horizontal y vertical equilibrado */}
        <div className="relative z-10 flex items-center justify-between px-5 sm:px-7 pb-4 sm:pb-5 pt-3.5 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            {promotions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Ir a promoción ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  safeIndex === idx
                    ? "w-7 bg-white shadow-sm"
                    : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={prevSlide}
              aria-label="Promoción anterior"
              className="p-1.5 sm:p-2 rounded-xl bg-black/25 hover:bg-black/40 active:scale-95 backdrop-blur-sm text-white/90 hover:text-white transition-all cursor-pointer shadow-sm border border-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Promoción siguiente"
              className="p-1.5 sm:p-2 rounded-xl bg-black/25 hover:bg-black/40 active:scale-95 backdrop-blur-sm text-white/90 hover:text-white transition-all cursor-pointer shadow-sm border border-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
