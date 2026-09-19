import XLSX from "xlsx";

const wb = XLSX.readFile("data/clientes.xlsx");
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);
console.log("Total rows:", rows.length);
if (rows.length > 0) {
  console.log("Columns:", Object.keys(rows[0]));
  // Buscar a Orlinda
  const orlinda = rows.find(r => JSON.stringify(r).includes("Orlinda") || JSON.stringify(r).includes("904") || JSON.stringify(r).includes("40621900"));
  console.log("Orlinda in Excel:", orlinda);
}
