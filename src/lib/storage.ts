import { insertRow, selectAll } from "./db";
import { notifyDataChanged } from "./hooks";
import { DOCS_BUCKET, isTestMode, supabase } from "./supabase";
import type { DocumentRow } from "./types";

/**
 * Archivos adjuntos en Supabase Storage (bucket privado `tm-documentos`).
 * Ruta: <user_id>/<trip_id>/<uuid>-<nombre>. Las políticas de Storage solo permiten
 * al usuario leer y escribir dentro de su propia carpeta.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain"]);

export async function currentUserId(): Promise<string> {
  if (isTestMode) {
    const token = import.meta.env.VITE_TEST_ACCESS_TOKEN as string;
    return JSON.parse(atob(token.split(".")[1])).sub;
  }
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sesión no iniciada");
  return id;
}

export function validateFile(file: File): string | null {
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_UPLOAD_BYTES) return "El archivo supera los 20 MB.";
  if (!ALLOWED_MIME.has(file.type)) return "Formato no soportado. Usa PDF, PNG, JPG, WEBP, GIF o TXT.";
  return null;
}

async function uploadFile(tripId: string, file: File): Promise<string> {
  const uid = await currentUserId();
  const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || "archivo";
  const key = `${uid}/${tripId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(key, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
  return key;
}

/** Sube un archivo y crea su ficha en Documentos. */
export async function uploadDocument(
  tripId: string,
  file: File,
  meta: { title?: string; type?: DocumentRow["type"]; linkedType?: DocumentRow["linkedType"]; linkedId?: string | null },
): Promise<DocumentRow> {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);
  const storageKey = await uploadFile(tripId, file);
  const doc = await insertRow<DocumentRow>("document", {
    tripId,
    title: meta.title?.trim() || file.name,
    type: meta.type ?? "otro",
    fileName: file.name,
    storageKey,
    mimeType: file.type,
    size: file.size,
    linkedType: meta.linkedType ?? null,
    linkedId: meta.linkedType ? (meta.linkedId ?? null) : null,
  });
  notifyDataChanged();
  return doc;
}

/** Enlace temporal (10 min) para abrir un archivo privado. */
export async function documentUrl(key: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(key, 600);
  if (error || !data) throw new Error("No se pudo abrir el archivo.");
  return data.signedUrl;
}

export async function downloadDocument(key: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).download(key);
  if (error || !data) throw new Error("No se pudo descargar el archivo.");
  return data;
}

export async function deleteFile(key: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCS_BUCKET).remove([key]);
  if (error) throw error;
}

export async function deleteTripFiles(tripId: string): Promise<void> {
  if (isTestMode) return;
  try {
    // Por las fichas y no por carpeta: en un viaje compartido cada cuenta sube a la suya.
    const docs = await selectAll<DocumentRow>("document", { tripId });
    if (docs.length) await supabase.storage.from(DOCS_BUCKET).remove(docs.map((d) => d.storageKey));
  } catch (e) {
    console.warn("No se pudieron borrar los archivos del viaje", e);
  }
}
