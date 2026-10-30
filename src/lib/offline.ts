/**
 * Copia local (IndexedDB) de lo último leído de Supabase, para consultar el viaje sin internet.
 * Contiene datos personales: se borra al cerrar sesión. Sin conexión la app es de solo lectura.
 *
 * Se usa IndexedDB y no localStorage porque el origen diego94diaz-oss.github.io lo comparten
 * todas las apps y localStorage tiene un cupo común de unos 5 MB.
 */

const DB_NAME = "travel-manager";
type Store = "data" | "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("data");
      req.result.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readCached<T>(key: string): Promise<T | undefined> {
  try {
    return await run<T | undefined>("data", "readonly", (s) => s.get(key));
  } catch {
    return undefined;
  }
}

/** Guardar la copia nunca debe romper la lectura normal (p. ej. en navegación privada). */
export async function writeCached(key: string, value: unknown): Promise<void> {
  await run("data", "readwrite", (s) => s.put(value, key)).catch((e) => console.warn("No se pudo guardar la copia local", e));
}

export const saveFile = (key: string, file: Blob) => run("files", "readwrite", (s) => s.put(file, key));
export const readFile = (key: string) => run<Blob | undefined>("files", "readonly", (s) => s.get(key));
export const removeFile = (key: string) => run("files", "readwrite", (s) => s.delete(key));
export const savedFileKeys = () => run("files", "readonly", (s) => s.getAllKeys()).then((keys) => new Set(keys.map(String)));

export async function clearOfflineData(): Promise<void> {
  await Promise.all((["data", "files"] as const).map((store) => run(store, "readwrite", (s) => s.clear()))).catch((e) =>
    console.warn("No se pudo borrar la copia local", e),
  );
}

/** Fallo de red (no de permisos ni de datos): tiene sentido recurrir a la copia local. */
export function isNetworkError(e: unknown): boolean {
  if (!navigator.onLine) return true;
  return e instanceof Error && /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(e.message);
}

// Estado «mostrando copia local», para el aviso de la app.
let usingCopy = false;
const listeners = new Set<() => void>();

export function setUsingCopy(value: boolean) {
  if (usingCopy === value) return;
  usingCopy = value;
  listeners.forEach((l) => l());
}

export const getUsingCopy = () => usingCopy;

export function subscribeUsingCopy(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
