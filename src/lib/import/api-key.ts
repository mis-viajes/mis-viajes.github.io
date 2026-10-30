/** Clave de la API de Anthropic del usuario. Se guarda solo en este navegador. */
const KEY_STORAGE = "tm_anthropic_api_key";

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Almacenamiento no disponible (modo privado estricto): la clave no se recuerda.
  }
}
