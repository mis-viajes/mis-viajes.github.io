import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getApiKey } from "./api-key";
import { extractionSchema, type Extraction } from "./schema";

/**
 * Extracción de datos de reservas con la API de Claude, llamada desde el navegador
 * con la clave del propio usuario (guardada solo en este dispositivo). Los datos extraídos
 * NUNCA se guardan directamente: el usuario los revisa y confirma en la interfaz.
 */

export const IMPORT_MODEL = "claude-opus-5-5";
const SYSTEM_PROMPT = `Eres un asistente que extrae datos de confirmaciones de viaje (vuelos, alojamientos, trenes, autobuses, traslados, entradas y actividades) para una aplicación personal de planificación de viajes.

Reglas:
- Extrae únicamente lo que aparece en el documento. Si un dato no aparece, usa null. No inventes ni completes precios, horarios, códigos, direcciones ni franquicias de equipaje.
- Las horas son las locales impresas en el documento, en formato YYYY-MM-DDTHH:mm. Si el año no aparece, dedúcelo solo si el documento lo deja claro; si no, añade un aviso en "warnings".
- La zona horaria IANA puedes deducirla del aeropuerto o la ciudad cuando sea inequívoca (p. ej. MAD → Europe/Madrid). Si hay duda, usa null.
- Cada tramo de vuelo es un elemento distinto (una conexión son dos vuelos). Asigna a cada vuelo la franquicia de equipaje que el documento indique para él.
- paymentStatus: "pagado" solo si el documento dice explícitamente que está pagado; "pendiente" si dice que se paga después o en el alojamiento; si no queda claro, "desconocido".
- bookingStatus: "confirmado" solo si el documento lo confirma explícitamente.
- Los textos libres (resumen, avisos, políticas) van en español.
- Si el documento no contiene ninguna reserva de viaje, devuelve listas vacías y explícalo en "warnings".`;

export class ImportError extends Error {}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function extractBookings(
  input: { kind: "file"; file: File } | { kind: "text"; text: string },
  context: { tripName: string; startDate: string; endDate: string },
): Promise<Extraction> {
  const apiKey = getApiKey();
  if (!apiKey) throw new ImportError("Falta la clave de API de Anthropic. Añádela en Ajustes de la app.");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];

  if (input.kind === "file") {
    const { file } = input;
    if (file.type === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: await toBase64(file) } });
    } else if (file.type === "text/plain") {
      content.push({ type: "text", text: `Contenido del archivo ${file.name}:\n\n${await file.text()}` });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: await toBase64(file) },
      });
    }
  } else {
    content.push({ type: "text", text: `Texto de la confirmación:\n\n${input.text}` });
  }
  content.push({
    type: "text",
    text: `Contexto: el viaje "${context.tripName}" va del ${context.startDate} al ${context.endDate}. Extrae las reservas del documento.`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: IMPORT_MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(extractionSchema) },
      // Si el modelo rechaza la petición, la API la reintenta en el modelo de respaldo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") throw new ImportError("El modelo no pudo procesar este documento.");
    if (response.stop_reason === "max_tokens") {
      throw new ImportError("El documento es demasiado largo para procesarlo de una vez. Prueba con menos páginas.");
    }
    if (!response.parsed_output) throw new ImportError("No se pudieron interpretar los datos extraídos.");
    return response.parsed_output;
  } catch (e) {
    if (e instanceof ImportError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new ImportError("La clave de API de Anthropic no es válida.");
    if (e instanceof Anthropic.RateLimitError) throw new ImportError("Límite de uso alcanzado. Inténtalo en unos minutos.");
    if (e instanceof Anthropic.BadRequestError) throw new ImportError(`La API rechazó la petición: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new ImportError("No se pudo conectar con la API de Anthropic. Revisa tu conexión.");
    if (e instanceof Anthropic.APIError) throw new ImportError(`Error del servicio de extracción (${e.status ?? "red"}).`);
    throw e;
  }
}
