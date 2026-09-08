const XLSX = require('xlsx');
const fs = require('fs');

const excelPath = fs.existsSync('data/clientes.xlsx') ? 'data/clientes.xlsx' : 'data/Lista de Clientes - Internet Aponte Plus.xlsx';
const wb = XLSX.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

console.log('Total filas:', data.length);
const sample5 = data.slice(0, 5).map(r => ({
  nombre: r['Nombre'],
  dni: r['DNI/C.I./C.C./IFE'],
  estado: r['Estado'],
  plan: r['Plan Internet'],
  precio: r['Plan Precio'],
  saldo: r['Saldo'],
  pagos: r['Pagos Pendientes'],
  corte: r['Día de Corte'],
  telefono: r['Telefono'],
  ip: r['Ip'],
  sectorial: r['Sectorial']
}));

console.log(JSON.stringify(sample5, null, 2));
