"use client";

import { useEffect } from "react";

/**
 * Hook reutilizable para bloquear de forma estricta el scroll del fondo (body scroll-lock)
 * mientras cualquier modal o ventana emergente esté abierta.
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (isOpen) {
      // Guarda el overflow original y bloquea el fondo
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      return () => {
        // Restaura el scroll al cerrar el modal
        document.body.style.overflow = originalBodyOverflow || "unset";
        document.documentElement.style.overflow = originalHtmlOverflow || "";
      };
    }
  }, [isOpen]);
}

export default useBodyScrollLock;
