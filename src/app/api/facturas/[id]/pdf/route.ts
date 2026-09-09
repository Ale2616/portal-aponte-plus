import { NextRequest, NextResponse } from "next/server";
import { branding } from "@/config/branding";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Datos de factura a tarifa plana (exenta de IVA)
  const folio = `FAC-${id.toUpperCase().replace(/[^A-Z0-9]/g, "-")}`;
  const total = 50000;
  const fechaEmision = "2026-03-01";
  const fechaVencimiento = "2026-03-18";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura Electrónica ${folio} - ${branding.companyName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #1e293b;
      background: #f8fafc;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      padding: 40px;
      border: 1px solid #e2e8f0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 25px;
      margin-bottom: 25px;
    }
    .company-title {
      font-size: 24px;
      font-weight: 800;
      color: #4f46e5;
      margin: 0 0 5px 0;
    }
    .company-sub {
      font-size: 13px;
      color: #64748b;
      line-height: 1.4;
      margin: 0;
    }
    .invoice-badge {
      text-align: right;
    }
    .invoice-num {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 5px 0;
    }
    .badge-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: #fef3c7;
      color: #92400e;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
    }
    .meta-box h4 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .meta-box p {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #f1f5f9;
      padding: 12px 16px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    td {
      padding: 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
      color: #334155;
    }
    .totals {
      width: 320px;
      margin-left: auto;
      margin-bottom: 35px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      color: #64748b;
    }
    .total-row.grand {
      border-top: 2px solid #e2e8f0;
      padding-top: 12px;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .actions {
      display: flex;
      gap: 15px;
      justify-content: flex-end;
      border-top: 1px solid #e2e8f0;
      padding-top: 25px;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
    }
    .btn-primary {
      background: #4f46e5;
      color: white;
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
    }
    @media print {
      body { background: white; padding: 0; }
      .invoice-card { box-shadow: none; border: none; padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <img src="/logo.jpg" alt="${branding.companyName}" style="height: 100px; width: auto; margin-bottom: 12px; display: block; object-fit: contain;">
        <h1 class="company-title">${branding.companyName}</h1>
        <p class="company-sub">
          ${branding.legalName}<br>
          NIT: ${branding.nit}<br>
          ${branding.address} - ${branding.city}<br>
          Contacto: ${branding.supportPhoneFormatted}
        </p>
      </div>
      <div class="invoice-badge">
        <h2 class="invoice-num">${folio}</h2>
        <span class="badge-status">Factura Oficial ISP</span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Detalles de Facturación</h4>
        <p>
          <strong>Fecha de Emisión:</strong> ${formatDate(fechaEmision)}<br>
          <strong>Fecha de Vencimiento:</strong> ${formatDate(fechaVencimiento)}<br>
          <strong>Periodo Facturado:</strong> Mes en Curso
        </p>
      </div>
      <div class="meta-box">
        <h4>Canales de Pago Habilitados</h4>
          Nequi: ${branding.paymentMethods[0]?.accountNumber || ""}<br>
          Bancolombia (Ahorros): ${branding.paymentMethods[1]?.accountNumber || "84758122483"}<br>
          Bre-B: ${branding.paymentMethods[2]?.accountNumber || ""}<br>
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descripción del Servicio</th>
          <th style="text-align: center;">Cantidad</th>
          <th style="text-align: right;">Precio Unitario</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Servicio de Internet Banda Ancha FTTH</strong><br>
            <span style="font-size: 12px; color: #64748b;">Plan Fibra Óptica Residencial de Alta Velocidad (Tarifa Plana Exenta de IVA)</span>
          </td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">${formatCurrency(total)}</td>
          <td style="text-align: right; font-weight: bold;">${formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Tarifa Mensual Neta</span>
        <span>${formatCurrency(total)}</span>
      </div>
      <div class="total-row grand">
        <span>Total a Pagar</span>
        <span>${formatCurrency(total)}</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" onclick="window.close()">Cerrar</button>
      <button class="btn btn-primary" onclick="window.print()">Imprimir / Guardar en PDF</button>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
