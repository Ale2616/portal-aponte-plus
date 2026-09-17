export interface PromotionItem {
  id: string;
  tag: string;
  titulo: string;
  descripcion: string;
  botonTexto: string;
  whatsappMensaje: string;
  gradiente: string;
  icono: string;
  imagenUrl?: string;
  activo: boolean;
}

export interface CompanyInfo {
  companyName: string;
  legalName: string;
  supportPhone: string;
  supportPhoneFormatted: string;
  nequiNumber: string;
  accountHolder: string;
}

export interface GlobalAlert {
  enabled: boolean;
  message: string;
  type: "warning" | "info";
}

export interface HomeAdBanner {
  enabled: boolean;
  imageUrl: string;
  imageUrls: string[]; // Hasta 5 imágenes para el carrusel publicitario
  titulo: string;
  descripcion: string;
  botonTexto: string;
  whatsappMensaje: string;
  linkWhatsapp?: string;
  actualizadoEn?: string;
}

export interface BannerItem {
  id: string;
  url: string;
  active: boolean;
}

export interface GlobalSettings {
  titular: string; // ej. "Andrés Aponte / Aponte Plus"
  canalesPago: {
    nequi: string;
    bancolombia: string;
    breB: string;
  };
  banners: BannerItem[];
  avisoGlobal: {
    activo: boolean;
    texto: string;
  };
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  titular: "Andrés Aponte / Aponte Plus",
  canalesPago: {
    nequi: "311 276 0959",
    bancolombia: "84758122483",
    breB: "311 276 0959",
  },
  banners: [],
  avisoGlobal: {
    activo: false,
    texto: "Aviso de mantenimiento programado.",
  },
};

export interface PortalConfig {
  companyInfo: CompanyInfo;
  promotions: PromotionItem[];
  globalAlert: GlobalAlert;
  homeAdBanner: HomeAdBanner;
  actualizadoEn?: string;
}

export const DEFAULT_CONFIG: PortalConfig = {
  companyInfo: {
    companyName: "Internet Aponte Plus",
    legalName: "Internet Aponte Plus",
    supportPhone: "3185577157",
    supportPhoneFormatted: "318 557 7157",
    nequiNumber: "311 276 0959",
    accountHolder: "Andrés Aponte / Aponte Plus",
  },
  promotions: [
    {
      id: "promo-100m",
      tag: "🔥 Plan Recomendado",
      titulo: "Pásate a 100 Megas simétricas por solo $10.000 más",
      descripcion:
        "Disfruta de máxima velocidad para streaming en 4K, teletrabajo y juegos en línea sin lag con fibra óptica dedicada.",
      botonTexto: "Pedir Upgrade",
      whatsappMensaje:
        "Hola, soy cliente de Internet Aponte Plus y me interesa la promoción para pasarme a 100 Megas simétricas por $10.000 más.",
      gradiente: "from-blue-600 via-indigo-600 to-violet-700",
      icono: "Zap",
      imagenUrl: "",
      activo: true,
    },
    {
      id: "promo-referidos",
      tag: "🎁 Plan Amigos",
      titulo: "Recomienda a un vecino y recibe 50% de descuento en tu próxima factura",
      descripcion:
        "Comparte la mejor conexión de la región. Cuando tu referido instale el servicio, ambos reciben un beneficio especial en su mensualidad.",
      botonTexto: "Referir un Vecino",
      whatsappMensaje:
        "Hola, quiero referir a un vecino en Internet Aponte Plus para aprovechar la promoción del 50% de descuento.",
      gradiente: "from-emerald-600 via-teal-600 to-cyan-700",
      icono: "Users",
      imagenUrl: "",
      activo: true,
    },
  ],
  globalAlert: {
    enabled: false,
    message:
      "Aviso de servicio: Mantenimiento preventivo en red de fibra óptica este jueves de 2:00 AM a 4:00 AM.",
    type: "warning",
  },
  homeAdBanner: {
    enabled: false,
    imageUrl: "",
    imageUrls: [],
    titulo: "¡Pásate a Fibra Óptica con Alta Velocidad!",
    descripcion:
      "Disfruta de la mejor conexión de la región con 100% fibra óptica dedicada y ultra velocidad.",
    botonTexto: "Preguntar por WhatsApp",
    whatsappMensaje:
      "Hola, vi la promoción en el portal y deseo más información sobre el servicio de internet",
    linkWhatsapp:
      "https://wa.me/573185577157?text=Hola%2C%20vi%20la%20promoci%C3%B3n%20en%20el%20portal%20y%20deseo%20m%C3%A1s%20informaci%C3%B3n%20sobre%20el%20servicio%20de%20internet",
  },
};
