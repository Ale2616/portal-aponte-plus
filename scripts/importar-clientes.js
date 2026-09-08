const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function sanitizeDoc(doc) {
  if (!doc) return '';
  return String(doc).replace(/[^a-zA-Z0-9]/g, '').trim();
}

function parseMoney(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function parsePagosPendientes(val, rawSaldo) {
  let count = 0;
  let monto = parseMoney(rawSaldo);

  if (val && typeof val === 'string') {
    // Formato común WispHub: "1, $25000.00" o "2, $100000.00"
    const match = val.match(/(\d+)\s*,\s*\$?\s*([\d.]+)/);
    if (match) {
      count = parseInt(match[1], 10);
      const parsedMonto = parseFloat(match[2]);
      if (!isNaN(parsedMonto) && parsedMonto > 0) {
        monto = parsedMonto;
      }
    }
  }

  return { count, monto };
}

function parseSpeeds(planName) {
  let bajada = '50 Mbps';
  let subida = '50 Mbps';

  if (!planName) return { bajada, subida };

  // Buscar patrones como "40Mbs / 40Mbs" o "15/Mbs - 15/Mbs"
  const match = planName.match(/(\d+)\s*(?:Mbs|Mbps|\/Mbs)/i);
  if (match) {
    bajada = `${match[1]} Mbps`;
    subida = `${match[1]} Mbps`;
  }

  return { bajada, subida };
}

function parseDateCorte(corteStr) {
  let dia = 20;
  let fechaCorte = '2026-09-23';
  let fechaLimite = '2026-09-20';

  if (corteStr && typeof corteStr === 'string') {
    const parts = corteStr.split('/');
    if (parts.length >= 3) {
      dia = parseInt(parts[0], 10) || 20;
      const mes = parts[1].padStart(2, '0');
      const anio = parts[2];
      fechaCorte = `${anio}-${mes}-${parts[0].padStart(2, '0')}`;
      const limiteDia = Math.max(1, dia - 3);
      fechaLimite = `${anio}-${mes}-${limiteDia.toString().padStart(2, '0')}`;
    }
  }

  return { dia, fechaCorte, fechaLimite };
}

function runImport() {
  console.log('--- INICIANDO IMPORTACIÓN DE CLIENTES ---');

  const possiblePaths = [
    path.join(process.cwd(), 'data', 'clientes.xlsx'),
    path.join(process.cwd(), 'data', 'Lista de Clientes - Internet Aponte Plus.xlsx'),
    path.join(process.cwd(), 'data', 'clientes.csv'),
  ];

  let excelPath = possiblePaths.find(p => fs.existsSync(p));
  if (!excelPath) {
    console.error('Error: No se encontró ningún archivo de datos en la carpeta data/');
    process.exit(1);
  }

  console.log(`Leyendo archivo: ${excelPath}`);
  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

  console.log(`Filas encontradas en la hoja "${sheetName}": ${rawRows.length}`);

  const clientsList = [];
  const clientsByCedula = {};
  let skippedRows = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const rawDni = row['DNI/C.I./C.C./IFE'];
    let cedula = sanitizeDoc(rawDni);
    const rawNombre = String(row['Nombre'] || '').trim();

    // Si no tiene DNI, intentamos usar el código/ID numérico si viene en Nombre o saltamos
    if (!cedula) {
      if (rawNombre && !isNaN(rawNombre)) {
        cedula = String(rawNombre);
      } else {
        skippedRows++;
        continue;
      }
    }

    const nombreCompleto = (rawNombre && isNaN(rawNombre))
      ? rawNombre
      : `Abonado C.C. ${cedula}`;

    const rawEstado = String(row['Estado'] || 'Activo').trim().toLowerCase();
    let estadoServicio = 'activo';
    if (rawEstado.includes('suspend') || rawEstado.includes('cort')) {
      estadoServicio = 'cortado';
    } else if (rawEstado.includes('cancel')) {
      estadoServicio = 'cortado';
    }

    const planNombre = String(row['Plan Internet'] || 'Plan Fibra Óptica Residencial').trim();
    const planPrecio = parseMoney(row['Plan Precio']) || 50000;
    const { bajada, subida } = parseSpeeds(planNombre);

    const rawPagos = row['Pagos Pendientes'];
    const rawSaldo = row['Saldo'];
    const { count: pendingCount, monto: pendingSaldo } = parsePagosPendientes(rawPagos, rawSaldo);

    // Si el estado es cortado y el saldo reportado es 0, asignamos el precio del plan mensual
    let saldoTotal = pendingSaldo;
    let facturasPendientesCount = pendingCount;
    if (estadoServicio === 'cortado' && saldoTotal === 0) {
      saldoTotal = planPrecio;
      facturasPendientesCount = 1;
    }

    const { dia, fechaCorte, fechaLimite } = parseDateCorte(row['Día de Corte']);

    const telefonoRaw = String(row['Telefono'] || '').trim();
    const primaryPhone = telefonoRaw.split(/[,/-]/)[0].trim().replace(/\D/g, '');

    const emailRaw = String(row['Email'] || '').trim();
    const primaryEmail = emailRaw.split(/[,/]/)[0].trim() || `cliente.${cedula}@internetaponteplus.com`;

    const direccion = String(row['Dirección'] || '').trim() ||
      (row['Barrio/Localidad'] ? `Barrio ${row['Barrio/Localidad']}` : 'Dirección Urbana Registrada');

    const routerOnt = String(row['Modelo Router Wifi'] || row['Modelo Antena'] || 'Router ONT Dual Band 5G').trim();
    const ip = String(row['Ip'] || '172.16.20.1').trim();
    const nodo = String(row['Sectorial'] || 'Nodo Principal Fibra').trim();

    // Generar facturas realistas vinculadas al cliente
    const invoices = [];
    const subtotal = Math.round(planPrecio / 1.19);
    const impuestos = planPrecio - subtotal;

    if (saldoTotal > 0) {
      invoices.push({
        id: `inv_${cedula}_2026_09`,
        folio: `FAC-2026-${cedula.slice(-4).padStart(6, '0')}`,
        periodo: 'Septiembre 2026',
        fechaEmision: '2026-09-01',
        fechaVencimiento: fechaLimite,
        subtotal: Math.round(saldoTotal / 1.19),
        impuestos: Math.round(saldoTotal - (saldoTotal / 1.19)),
        total: saldoTotal,
        saldoPendiente: saldoTotal,
        estado: (estadoServicio === 'cortado' || new Date(fechaLimite) < new Date('2026-09-08')) ? 'vencida' : 'pendiente',
        concepto: `Servicio de Internet ${planNombre} - Periodo Septiembre 2026`,
        tieneReportePendiente: false
      });
    }

    // Factura histórica pagada del mes anterior
    invoices.push({
      id: `inv_${cedula}_2026_08`,
      folio: `FAC-2026-${(parseInt(cedula.slice(-4)) - 1 || 1000).toString().padStart(6, '0')}`,
      periodo: 'Agosto 2026',
      fechaEmision: '2026-08-01',
      fechaVencimiento: '2026-08-20',
      subtotal,
      impuestos,
      total: planPrecio,
      saldoPendiente: 0,
      estado: 'pagada',
      concepto: `Servicio de Internet ${planNombre} - Periodo Agosto 2026`,
      tieneReportePendiente: false
    });

    const clientObj = {
      id: `ap_${cedula}`,
      cedula,
      nombreCompleto,
      email: primaryEmail,
      telefono: primaryPhone || telefonoRaw,
      telefonoCompleto: telefonoRaw,
      direccion,
      barrio: String(row['Barrio/Localidad'] || '').trim(),
      ciudad: 'Colombia',
      estadoServicio,
      plan: {
        nombre: planNombre,
        velocidadBajada: bajada,
        velocidadSubida: subida,
        precioMensual: planPrecio,
        tecnologia: 'Fibra Óptica FTTH'
      },
      servicio: {
        ip,
        nodo,
        routerOnt,
        fechaCorte,
        fechaLimitePago: fechaLimite,
        diaPago: dia
      },
      saldoTotalPendiente: saldoTotal,
      facturasPendientesCount,
      invoices
    };

    clientsList.push(clientObj);
    clientsByCedula[cedula] = clientObj;
  }

  // Asegurar directorio destino
  const destDir = path.join(process.cwd(), 'src', 'data');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const destFile = path.join(destDir, 'clientes.json');
  const payload = {
    updatedAt: new Date().toISOString(),
    totalClientes: clientsList.length,
    clientes: clientsByCedula
  };

  fs.writeFileSync(destFile, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`\n========================================`);
  console.log(`¡IMPORTACIÓN COMPLETADA EXITOSAMENTE!`);
  console.log(`Archivo generado: ${destFile}`);
  console.log(`Total abonados importados: ${clientsList.length}`);
  console.log(`Filas omitidas (sin DNI/Nombre): ${skippedRows}`);
  const activos = clientsList.filter(c => c.estadoServicio === 'activo').length;
  const cortados = clientsList.filter(c => c.estadoServicio === 'cortado').length;
  const conDeuda = clientsList.filter(c => c.saldoTotalPendiente > 0).length;
  const alDia = clientsList.filter(c => c.saldoTotalPendiente === 0).length;
  console.log(`- Activos: ${activos}`);
  console.log(`- Cortados / Suspendidos: ${cortados}`);
  console.log(`- Con Saldo Pendiente: ${conDeuda}`);
  console.log(`- Al Día ($0): ${alDia}`);
  console.log(`========================================\n`);

  if (clientsList.length > 0) {
    console.log('Primer cliente importado:');
    console.log(JSON.stringify(clientsList[0], null, 2));
  }
}

runImport();
