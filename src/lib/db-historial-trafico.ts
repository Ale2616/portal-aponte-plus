import fs from "fs";
import path from "path";

export interface HistorialTraficoClienteRecord {
  id_servicio: string;
  cedula: string;
  anio: number;
  mes: number; // 1 to 12
  mes_nombre?: string; // "Ene", "Feb", ...
  descarga_gb: number;
  subida_gb: number;
  total_gb?: number;
  updated_at: string;
}

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "historial_trafico_cliente.json");

/**
 * Asegura que el directorio data/ y el archivo historial_trafico_cliente.json existan.
 */
function ensureLocalDbFile(): void {
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2), "utf8");
  }
}

/**
 * Lee todos los registros de la tabla historial_trafico_cliente local.
 */
export function getAllLocalHistorialRecords(): HistorialTraficoClienteRecord[] {
  try {
    ensureLocalDbFile();
    const content = fs.readFileSync(LOCAL_DB_PATH, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err: any) {
    console.warn("[DB Local Historial] Error leyendo historial_trafico_cliente.json:", err.message);
    return [];
  }
}

/**
 * Guarda los registros en la base de datos local JSON.
 */
function saveAllLocalHistorialRecords(records: HistorialTraficoClienteRecord[]): void {
  try {
    ensureLocalDbFile();
    const tempPath = `${LOCAL_DB_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf8");
    fs.renameSync(tempPath, LOCAL_DB_PATH);
  } catch (err: any) {
    console.error("[DB Local Historial] Error guardando registros:", err.message);
  }
}

/**
 * Sincroniza con Supabase si las credenciales están configuradas.
 */
async function upsertToSupabaseIfConfigured(records: HistorialTraficoClienteRecord[]): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || records.length === 0) {
    return false;
  }

  try {
    const url = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/historial_trafico_cliente`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(
        records.map((r) => ({
          id_servicio: r.id_servicio,
          cedula: r.cedula,
          anio: r.anio,
          mes: r.mes,
          descarga_gb: r.descarga_gb,
          subida_gb: r.subida_gb,
          updated_at: r.updated_at,
        }))
      ),
    });

    if (res.ok) {
      console.log(`[DB Supabase] Upsert exitoso de ${records.length} registros en historial_trafico_cliente`);
      return true;
    } else {
      const errText = await res.text();
      console.warn(`[DB Supabase] Upsert falló con status ${res.status}:`, errText);
      return false;
    }
  } catch (err: any) {
    console.warn("[DB Supabase] Error en petición a Supabase:", err.message);
    return false;
  }
}

/**
 * Realiza un Upsert de registros de historial de tráfico para un servicio.
 * Guarda en DB local (data/historial_trafico_cliente.json) y en Supabase si está disponible.
 */
export async function upsertHistorialTrafico(
  records: Omit<HistorialTraficoClienteRecord, "updated_at">[]
): Promise<HistorialTraficoClienteRecord[]> {
  const nowIso = new Date().toISOString();
  const existing = getAllLocalHistorialRecords();

  const prepared: HistorialTraficoClienteRecord[] = records.map((r) => ({
    id_servicio: String(r.id_servicio).trim(),
    cedula: String(r.cedula || "").trim(),
    anio: Number(r.anio),
    mes: Number(r.mes),
    mes_nombre: r.mes_nombre,
    descarga_gb: Number(Number(r.descarga_gb || 0).toFixed(2)),
    subida_gb: Number(Number(r.subida_gb || 0).toFixed(2)),
    total_gb: Number((Number(r.descarga_gb || 0) + Number(r.subida_gb || 0)).toFixed(2)),
    updated_at: nowIso,
  }));

  // Actualizar o insertar en memoria
  const map = new Map<string, HistorialTraficoClienteRecord>();
  existing.forEach((item) => {
    const key = `${item.id_servicio}-${item.anio}-${item.mes}`;
    map.set(key, item);
  });

  prepared.forEach((item) => {
    const key = `${item.id_servicio}-${item.anio}-${item.mes}`;
    map.set(key, item);
  });

  const updatedList = Array.from(map.values());
  saveAllLocalHistorialRecords(updatedList);

  // Intentar upsert en Supabase en paralelo sin bloquear
  upsertToSupabaseIfConfigured(prepared).catch(() => {});

  return prepared;
}

/**
 * Consulta el historial de tráfico de un servicio en la base de datos para un año dado.
 * Permite buscar por id_servicio o por cédula.
 */
export function getHistorialTraficoByServicio(
  idServicio: string | number,
  anio: number = new Date().getFullYear(),
  cedula?: string
): HistorialTraficoClienteRecord[] {
  const cleanId = String(idServicio || "").trim();
  const cleanCedula = String(cedula || "").trim();
  const all = getAllLocalHistorialRecords();

  return all
    .filter((r) => {
      const rId = String(r.id_servicio || "").trim();
      const rCedula = String(r.cedula || "").trim();

      const matchId = cleanId && (rId === cleanId || cleanId === `ap_${rId}` || rId === `ap_${cleanId}`);
      const matchCedula = cleanCedula && rCedula && (rCedula === cleanCedula);

      return (matchId || matchCedula) && Number(r.anio) === anio;
    })
    .sort((a, b) => a.mes - b.mes);
}
