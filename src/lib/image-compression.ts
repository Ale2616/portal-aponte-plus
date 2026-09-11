/**
 * Utilidad de compresión y redimensionamiento de imágenes en el cliente (HTML5 Canvas).
 * 
 * - Redimensiona imágenes a un ancho máximo de 1080px (manteniendo relación de aspecto).
 * - Aplica compresión con calidad 0.75 en formato WebP (con fallback a JPEG).
 * - Previene errores HTTP 413 (Payload Too Large) en Vercel y garantiza que el payload
 *   pueda ser persistido de forma confiable en Upstash Redis y base de datos global.
 */

export interface CompressionOptions {
  maxWidth?: number;
  quality?: number;
}

/**
 * Lista conocida de imágenes demo o por defecto del sistema.
 */
export const DEFAULT_BANNER_IMAGES = [
  "/banner-promo-fibra.jpg",
  "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800",
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
];

/**
 * Determina si una lista de imágenes contiene únicamente los valores por defecto / demo
 * o si está vacía. Permite proteger el estado local frente a sobreescrituras no deseadas.
 */
export function isDefaultImageList(imgs?: string[] | null): boolean {
  if (!imgs || !Array.isArray(imgs) || imgs.length === 0) return true;
  
  // Caso 1: Solo la imagen local por defecto
  if (imgs.length === 1 && imgs[0] === "/banner-promo-fibra.jpg") {
    return true;
  }

  // Caso 2: Las 3 imágenes demo iniciales
  if (
    imgs.length === 3 &&
    imgs[0] === "/banner-promo-fibra.jpg" &&
    imgs[1].includes("unsplash.com") &&
    imgs[2].includes("unsplash.com")
  ) {
    return true;
  }

  // Caso 3: Todas son placeholders o imágenes demo de unsplash
  const allDemo = imgs.every(
    (src) =>
      src === "/banner-promo-fibra.jpg" ||
      src.includes("unsplash.com/photo-1544197150") ||
      src.includes("unsplash.com/photo-1558494949")
  );

  return allDemo;
}

/**
 * Comprime un archivo File o una cadena Data URL / Base64 existente utilizando HTML5 Canvas.
 * Retorna una promesa que resuelve con la cadena Data URL (Base64) optimizada.
 */
export async function compressImageToDataUrl(
  input: File | string,
  options: CompressionOptions = {}
): Promise<string> {
  const { maxWidth = 1080, quality = 0.75 } = options;

  // Verificación de entorno de navegador
  if (typeof window === "undefined" || typeof document === "undefined") {
    return typeof input === "string" ? input : "";
  }

  return new Promise((resolve, reject) => {
    let objectUrlToRevoke: string | null = null;

    const cleanup = () => {
      if (objectUrlToRevoke) {
        try {
          URL.revokeObjectURL(objectUrlToRevoke);
        } catch {}
      }
    };

    const processSrc = (src: string) => {
      const img = new Image();

      // Solo aplicar crossOrigin a URLs remotas HTTP/HTTPS para evitar errores de seguridad con blob/data
      if (src.startsWith("http://") || src.startsWith("https://")) {
        img.crossOrigin = "anonymous";
      }

      img.onload = () => {
        try {
          let { width, height } = img;

          // Si el ancho supera maxWidth (1080px), redimensionar proporcionalmente
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext("2d", { willReadFrequently: false });
          if (!ctx) {
            cleanup();
            resolve(src);
            return;
          }

          // Filtro de suavizado de alta calidad
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Dibujar en el lienzo Canvas
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Intentar codificar en image/webp con calidad 0.75
          let output = canvas.toDataURL("image/webp", quality);

          // Si el navegador no soporta codificación WebP en toDataURL (devuelve PNG por defecto),
          // forzar image/jpeg con calidad 0.75 para compresión garantizada
          if (!output.startsWith("data:image/webp")) {
            output = canvas.toDataURL("image/jpeg", quality);
          }

          cleanup();
          resolve(output);
        } catch (err) {
          console.warn("[ImageCompression] Error al procesar imagen en canvas, usando fuente original:", err);
          cleanup();
          resolve(src);
        }
      };

      img.onerror = () => {
        cleanup();
        // Si falló por CORS en imagen remota, preservar URL original sin romper flujo
        if (src.startsWith("http://") || src.startsWith("https://")) {
          resolve(src);
        } else {
          reject(new Error("No se pudo cargar o procesar la imagen seleccionada."));
        }
      };

      img.src = src;
    };

    if (typeof input === "string") {
      if (input.startsWith("data:image/") || input.startsWith("http://") || input.startsWith("https://")) {
        processSrc(input);
      } else {
        resolve(input);
      }
    } else {
      if (!input.type || !input.type.startsWith("image/")) {
        reject(new Error("El archivo seleccionado no es un formato de imagen válido."));
        return;
      }

      // Usar URL.createObjectURL para mayor rapidez y menor consumo de memoria que FileReader
      try {
        const objUrl = URL.createObjectURL(input);
        objectUrlToRevoke = objUrl;
        processSrc(objUrl);
      } catch {
        // Fallback a FileReader si createObjectURL falla
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (!result) {
            reject(new Error("No se pudo leer el archivo seleccionado."));
            return;
          }
          processSrc(result);
        };
        reader.onerror = () => reject(new Error("Error al leer el archivo de imagen."));
        reader.readAsDataURL(input);
      }
    }
  });
}
