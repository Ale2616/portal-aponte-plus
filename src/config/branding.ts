export interface PaymentMethod {
  id: string;
  name: string;
  shortName: string;
  type: 'wallet' | 'bank' | 'cash' | 'gateway';
  badge: string;
  iconName: string;
  accountNumber: string;
  accountType?: string;
  accountHolder: string;
  identification?: string;
  instructions: string;
  qrCodeUrl?: string;
  allowUpload: boolean;
}

export interface BrandingConfig {
  companyName: string;
  legalName: string;
  nit: string;
  tagline: string;
  logoUrl: string;
  supportPhone: string;
  supportPhoneFormatted: string;
  supportEmail: string;
  supportHours: string;
  address: string;
  city: string;
  primaryColor: string;
  accentColor: string;
  paymentMethods: PaymentMethod[];
  faq: {
    question: string;
    answer: string;
  }[];
}

export const branding: BrandingConfig = {
  companyName: "Internet Aponte Plus",
  legalName: "Internet Aponte Plus S.A.S.",
  nit: "901.458.789-2",
  tagline: "Conectándote al Futuro • Internet de Alta Velocidad por Fibra Óptica",
  logoUrl: "/logo.jpg",
  supportPhone: "573185577157",
  supportPhoneFormatted: "318 557 7157",
  supportEmail: "soporte@internetaponteplus.com",
  supportHours: "Lunes a Sábado de 7:00 AM a 8:00 PM | Domingos 8:00 AM a 2:00 PM",
  address: "Sede Principal de Atención al Abonado",
  city: "Colombia",
  primaryColor: "#0284c7",
  accentColor: "#10b981",

  paymentMethods: [
    {
      id: "nequi",
      name: "Nequi",
      shortName: "Nequi",
      type: "wallet",
      badge: "Inmediato",
      iconName: "Smartphone",
      accountNumber: "311 276 0959",
      accountType: "Billetera Digital",
      accountHolder: "Internet Aponte Plus",
      instructions: "Transfiere al número Nequi indicado. Guarda el comprobante de transferencia con fecha y referencia.",
      allowUpload: true,
    },
    {
      id: "daviplata",
      name: "Daviplata",
      shortName: "Daviplata",
      type: "wallet",
      badge: "Inmediato",
      iconName: "Smartphone",
      accountNumber: "311 276 0959",
      accountType: "Billetera Móvil",
      accountHolder: "Internet Aponte Plus",
      instructions: "Pasa plata al número Daviplata indicado y guarda la captura con el código de autorización.",
      allowUpload: true,
    },
    {
      id: "breb",
      name: "Bre-B / Transfiya",
      shortName: "Bre-B",
      type: "bank",
      badge: "Interbancario",
      iconName: "QrCode",
      accountNumber: "311 276 0959",
      accountType: "Llave Móvil Interbancaria",
      accountHolder: "Internet Aponte Plus",
      instructions: "Envía desde cualquier entidad bancaria mediante Bre-B o Transfiya usando el número de celular como llave.",
      allowUpload: true,
    },
  ],

  faq: [
    {
      question: "¿Cuánto tarda en validarse mi comprobante de pago?",
      answer: "Los pagos reportados en horario laboral se validan en promedio en menos de 30 a 60 minutos. Si tu servicio se encuentra suspendido, la reconexión se ejecuta automáticamente tras la aprobación."
    },
    {
      question: "¿Qué pasa si mi servicio fue cortado por mora?",
      answer: "Una vez reportes tu comprobante con el monto total adeudado, nuestro sistema con WispHub levanta la suspensión en tu router/ONT sin costo de reconexión."
    },
    {
      question: "¿Dónde encuentro mi número de factura o referencia?",
      answer: "En este portal de Internet Aponte Plus puedes ver el listado completo de tus facturas pendientes y pagadas, junto con el monto exacto y la fecha límite de pago."
    },
    {
      question: "¿Puedo realizar abonos parciales?",
      answer: "Sí, puedes ingresar el monto exacto transferido al reportar tu pago. Sin embargo, para levantar una suspensión por mora es necesario saldar el total de la factura vencida."
    }
  ]
};
