import { NextRequest, NextResponse } from "next/server";
import { submitPaymentReport } from "@/lib/wisphub";
import path from "path";
import fs from "fs/promises";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // 1. Extraer el archivo real enviado por el cliente (sin URLs de banner ni imágenes por defecto)
    const file = (formData.get("comprobante") || formData.get("archivo")) as File | null;
    const nombre = (formData.get("nombre") || formData.get("nombre_cliente") || "Cliente Aponte Plus").toString().replace(/^Abonado\b/i, "Cliente").trim();
    const cedula = (formData.get("cedula") || formData.get("cedula_cliente") || formData.get("id_cliente") || "").toString().trim();
    const plan = (formData.get("plan") || formData.get("plan_cliente") || "Plan Fibra Óptica").toString().trim();
    const montoRaw = (formData.get("monto") || "0").toString().trim();
    // Normalizar monto: Si viene con formato de miles con puntos (ej: "50.000"), eliminar puntos para no confundir con decimales
    let montoLimpio = montoRaw;
    if (/^\d{1,3}(\.\d{3})+$/.test(montoRaw)) {
      montoLimpio = montoRaw.replace(/\./g, "");
    }
    const montoNum = parseFloat(montoLimpio.replace(/[^0-9.]/g, "")) || 0;
    const metodo_pago = (formData.get("metodo_pago") || "Transferencia Bancaria").toString().trim();
    const referenciaRaw = (formData.get("referencia") || "").toString().trim();
    const referencia = referenciaRaw || "Ver imagen adjunta";

    // Campos complementarios para registro interno y WispHub
    const idFactura = (formData.get("id_factura") || `FAC-${Date.now()}`).toString().trim();
    const idCliente = (formData.get("id_cliente") || cedula || "0").toString().trim();
    const fechaPago = (formData.get("fecha_pago") || "").toString().trim();
    const observaciones = (formData.get("observaciones") || "").toString().trim();

    // 2. Validación estricta: Si no viene archivo de comprobante, devolver error 400
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Es obligatorio adjuntar el comprobante real de pago (foto o captura de pantalla).",
        },
        { status: 400 }
      );
    }

    if (montoNum <= 0) {
      return NextResponse.json(
        { success: false, error: "El monto a reportar debe ser un valor positivo mayor a cero." },
        { status: 400 }
      );
    }

    // 3. Verificación de tamaños y formatos: Permite JPG, PNG, WEBP y JPEG de hasta 10MB
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "El archivo supera el tamaño máximo permitido de 10 MB.",
        },
        { status: 400 }
      );
    }

    const validMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    const fileName = (file.name || "").toLowerCase();
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const isValidFormat =
      validMimes.includes(file.type.toLowerCase()) ||
      validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidFormat) {
      return NextResponse.json(
        {
          success: false,
          error: "Formato no permitido. Solo se aceptan capturas en JPG, PNG, WEBP, JPEG o comprobantes en PDF.",
        },
        { status: 400 }
      );
    }

    // Formatear fecha actual de Colombia (America/Bogota)
    const fechaActual = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());

    // Formatear monto en pesos colombianos
    const montoFormateado = new Intl.NumberFormat("es-CO").format(montoNum);

    // Plantilla exacta de notificación para Telegram
    const telegramCaption = `🔔 <b>NUEVO REPORTE DE PAGO - APONTE PLUS</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Cliente:</b> ${nombre}
🆔 <b>Cédula:</b> ${cedula}
📦 <b>Plan:</b> ${plan}
💰 <b>Monto:</b> $${montoFormateado} COP
🏦 <b>Medio:</b> ${metodo_pago}
🔖 <b>Referencia:</b> ${referencia || "Ver imagen adjunta"}
📅 <b>Fecha:</b> ${fechaActual}
━━━━━━━━━━━━━━━━━━━━
<i>Verificar comprobante adjunto y aplicar en el sistema de gestión.</i>`;

    // 4. Despacho a Telegram como binario real
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramBotToken || !telegramChatId) {
      console.error("[Telegram Error]: Variables TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configuradas en el servidor.");
      return NextResponse.json(
        { success: false, error: "Servicio de notificaciones de Telegram no configurado en el servidor." },
        { status: 500 }
      );
    }

    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const telegramEndpoint = isPdf
      ? `https://api.telegram.org/bot${telegramBotToken}/sendDocument`
      : `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`;

    const telegramFormData = new FormData();
    telegramFormData.append("chat_id", telegramChatId);
    telegramFormData.append(
      isPdf ? "document" : "photo",
      file,
      file.name || (isPdf ? "comprobante.pdf" : "comprobante.jpg")
    );
    telegramFormData.append("parse_mode", "HTML");
    telegramFormData.append("caption", telegramCaption);

    let telegramRes = await fetch(telegramEndpoint, {
      method: "POST",
      body: telegramFormData,
    });

    let telegramJson = await telegramRes.json().catch(() => ({ ok: false }));

    // Si falló sendPhoto (por ejemplo, si Telegram rechaza procesar el formato de la foto), reintentar automáticamente como sendDocument
    if ((!telegramRes.ok || !telegramJson.ok) && !isPdf) {
      console.warn("[Telegram sendPhoto falló, ejecutando reintento con sendDocument]:", telegramJson);
      const fallbackFormData = new FormData();
      fallbackFormData.append("chat_id", telegramChatId);
      fallbackFormData.append("document", file, file.name || "comprobante.jpg");
      fallbackFormData.append("parse_mode", "HTML");
      fallbackFormData.append("caption", telegramCaption);

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendDocument`, {
        method: "POST",
        body: fallbackFormData,
      });
      telegramJson = await telegramRes.json().catch(() => ({ ok: false }));
    }

    if (!telegramRes.ok || !telegramJson.ok) {
      console.error("[Telegram API Error]:", telegramJson);
      return NextResponse.json(
        {
          success: false,
          error: "No fue posible despachar el comprobante al canal de recaudos de Telegram. Por favor intenta de nuevo.",
          detail: telegramJson.description || "Error de comunicación con Telegram",
        },
        { status: 502 }
      );
    }

    // 5. Guardar copia local en public/uploads para auditoría y respaldo
    let savedFileName = "";
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });
      const extension = fileName.split(".").pop() || (isPdf ? "pdf" : "jpg");
      savedFileName = `comp-${cedula || "cli"}-${Date.now()}.${extension}`;
      const filePath = path.join(uploadsDir, savedFileName);
      await fs.writeFile(filePath, fileBuffer);
    } catch (fsErr) {
      console.warn("[Upload Storage Warning]: No se pudo guardar copia local en public/uploads:", fsErr);
    }

    // 6. Registrar en el almacén de pagos para actualizar el estado del abonado
    const internalReport = await submitPaymentReport(
      {
        idFactura,
        idCliente,
        referencia,
        metodoPago: metodo_pago,
        monto: montoNum,
        fechaHoraTransferencia: fechaPago || fechaActual,
        observaciones,
        nombreArchivo: savedFileName || file.name,
      },
      fileBuffer
    );

    console.log(`[Telegram Despacho Exitoso] Comprobante de ${nombre} (${cedula}) por $${montoFormateado} COP enviado a Telegram.`);

    // 7. Retornar status 200 con mensaje de confirmación
    return NextResponse.json({
      success: true,
      radicado: internalReport.radicado,
      idReporte: internalReport.idReporte,
      mensaje: "¡Comprobante enviado con éxito! Su pago será verificado en el sistema en un transcurso de 30 a 60 minutos.",
    });
  } catch (err: any) {
    console.error("[API /facturas/reportar-pago Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Ocurrió un error inesperado al procesar el comprobante de pago.",
      },
      { status: 500 }
    );
  }
}
