import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitPaymentReport } from "@/lib/wisphub";
import path from "path";
import fs from "fs/promises";

const ReportarPagoSchema = z.object({
  id_factura: z.string().min(1, "Debe seleccionar una factura válida"),
  id_cliente: z.string().min(1, "Identificador de cliente no válido"),
  referencia: z.string().min(3, "El número de comprobante/referencia debe tener al menos 3 caracteres").max(50),
  metodo_pago: z.string().min(2, "Selecciona el método de pago utilizado"),
  monto: z.coerce.number().positive("El monto debe ser un valor positivo mayor a cero"),
  fecha_pago: z.string().min(1, "La fecha de pago es requerida"),
  observaciones: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const rawFields = {
      id_factura: formData.get("id_factura")?.toString() || "",
      id_cliente: formData.get("id_cliente")?.toString() || "",
      referencia: formData.get("referencia")?.toString() || "",
      metodo_pago: formData.get("metodo_pago")?.toString() || "",
      monto: formData.get("monto")?.toString() || "",
      fecha_pago: formData.get("fecha_pago")?.toString() || "",
      observaciones: formData.get("observaciones")?.toString() || "",
    };

    const parsed = ReportarPagoSchema.safeParse(rawFields);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "Datos del comprobante inválidos";
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const file = formData.get("comprobante") as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Es obligatorio adjuntar la imagen o PDF del comprobante de pago." },
        { status: 400 }
      );
    }

    // Validación de peso máximo: 5MB
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "El archivo excede el tamaño máximo permitido de 5 MB." },
        { status: 400 }
      );
    }

    // Validación de tipo MIME
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Formato no permitido. Solo se aceptan imágenes (JPG, PNG, WebP) o PDF." },
        { status: 400 }
      );
    }

    // Convertir a buffer y almacenar comprobante en carpeta local pública
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let savedFileName = "";
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });
      const extension = file.name.split(".").pop() || "jpg";
      savedFileName = `comprobante_${parsed.data.id_factura}_${Date.now()}.${extension}`;
      const filePath = path.join(uploadsDir, savedFileName);
      await fs.writeFile(filePath, buffer);
    } catch (fsErr) {
      console.warn("[Upload Storage Warning]: Could not write file to public directory:", fsErr);
    }

    const result = await submitPaymentReport(
      {
        idFactura: parsed.data.id_factura,
        idCliente: parsed.data.id_cliente,
        referencia: parsed.data.referencia,
        metodoPago: parsed.data.metodo_pago,
        monto: parsed.data.monto,
        fechaHoraTransferencia: parsed.data.fecha_pago,
        observaciones: parsed.data.observaciones,
        nombreArchivo: savedFileName || file.name,
      },
      buffer
    );

    return NextResponse.json({
      ...result,
      archivoGuardado: savedFileName ? `/uploads/${savedFileName}` : undefined,
    });
  } catch (err: any) {
    console.error("[API /facturas/reportar-pago Error]:", err);
    return NextResponse.json(
      { success: false, error: "Ocurrió un error al procesar el reporte de pago. Por favor intenta nuevamente." },
      { status: 500 }
    );
  }
}
