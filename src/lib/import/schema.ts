import { z } from "zod";

/**
 * Esquema de extracción de reservas. Todos los campos son obligatorios pero aceptan null:
 * el modelo debe devolver null cuando el dato no aparece en el documento.
 */

const n = <T extends z.ZodType>(t: T) => t.nullable();

const paymentStatus = z
  .enum(["pagado", "parcial", "pendiente", "desconocido"])
  .describe("Solo 'pagado' si el documento lo dice explícitamente (p. ej. 'pagado', 'cargo realizado', recibo).");
const bookingStatus = z
  .enum(["confirmado", "reservado", "desconocido"])
  .describe("'confirmado' solo si el documento indica confirmación explícita.");

const money = {
  price: n(z.number()).describe("Precio total en unidades normales (p. ej. 123.45). null si no aparece."),
  currency: n(z.string()).describe("Código ISO 4217, p. ej. EUR, USD, CLP."),
  paymentStatus,
  amountPaid: n(z.number()).describe("Importe ya pagado si el pago es parcial."),
};

export const baggageSchema = z.object({
  category: z.enum(["personal", "cabina", "facturado", "adicional"]),
  quantity: n(z.number()),
  maxWeightKg: n(z.number()),
  maxDimensions: n(z.string()),
  notes: n(z.string()),
});

export const flightSchema = z.object({
  airline: n(z.string()),
  flightNumber: n(z.string()),
  bookingCode: n(z.string()).describe("Localizador / PNR."),
  originCode: n(z.string()).describe("Código IATA de 3 letras."),
  originName: n(z.string()),
  originCity: n(z.string()),
  destinationCode: n(z.string()),
  destinationName: n(z.string()),
  destinationCity: n(z.string()),
  departureLocal: n(z.string()).describe("Hora local de salida, formato YYYY-MM-DDTHH:mm."),
  departureTimezone: n(z.string()).describe("Zona IANA del aeropuerto de salida, p. ej. America/Santiago."),
  arrivalLocal: n(z.string()).describe("Hora local de llegada, formato YYYY-MM-DDTHH:mm."),
  arrivalTimezone: n(z.string()),
  terminalOrigin: n(z.string()),
  terminalDestination: n(z.string()),
  seats: n(z.string()),
  cabinClass: n(z.string()),
  passengers: z.array(z.string()),
  baggage: z.array(baggageSchema).describe("Franquicia de equipaje indicada en el documento para este vuelo."),
  bookingStatus,
  ...money,
});

export const lodgingSchema = z.object({
  name: z.string(),
  type: z.enum(["hotel", "airbnb", "apartamento", "hostal", "otro"]),
  platform: n(z.string()).describe("Booking.com, Airbnb, Expedia, web del hotel…"),
  address: n(z.string()),
  city: n(z.string()),
  country: n(z.string()),
  checkInDate: n(z.string()).describe("YYYY-MM-DD"),
  checkOutDate: n(z.string()).describe("YYYY-MM-DD"),
  checkInTime: n(z.string()).describe("HH:mm"),
  checkOutTime: n(z.string()).describe("HH:mm"),
  taxes: n(z.number()),
  bookingCode: n(z.string()),
  holderName: n(z.string()),
  guests: n(z.number()),
  cancellationPolicy: n(z.string()),
  amenities: n(z.string()),
  accessInfo: n(z.string()),
  hostContact: n(z.string()),
  bookingUrl: n(z.string()),
  bookingStatus,
  ...money,
});

export const transportSchema = z.object({
  type: z.enum(["tren", "bus", "metro", "tranvia", "taxi", "vtc", "alquiler", "traslado", "ferry", "otro"]),
  operator: n(z.string()),
  serviceNumber: n(z.string()),
  origin: n(z.string()),
  destination: n(z.string()),
  departureLocal: n(z.string()).describe("YYYY-MM-DDTHH:mm"),
  arrivalLocal: n(z.string()).describe("YYYY-MM-DDTHH:mm"),
  timezone: n(z.string()),
  seat: n(z.string()),
  travelClass: n(z.string()),
  bookingCode: n(z.string()),
  baggageInfo: n(z.string()),
  bookingStatus,
  ...money,
});

export const activitySchema = z.object({
  name: z.string(),
  category: z.enum(["turismo", "museo", "monumento", "excursion", "compras", "entretenimiento", "evento", "gratuita", "otro"]),
  city: n(z.string()),
  address: n(z.string()),
  date: n(z.string()).describe("YYYY-MM-DD"),
  startTime: n(z.string()).describe("HH:mm"),
  endTime: n(z.string()).describe("HH:mm"),
  bookingCode: n(z.string()),
  bookingUrl: n(z.string()),
  bookingStatus,
  ...money,
});

export const extractionSchema = z.object({
  documentType: z.string().describe("Tipo de documento en español, p. ej. 'Confirmación de vuelo'."),
  summary: z.string().describe("Resumen en una frase, en español."),
  warnings: z.array(z.string()).describe("Datos ambiguos, ilegibles o que el usuario debe verificar, en español."),
  flights: z.array(flightSchema),
  lodgings: z.array(lodgingSchema),
  transports: z.array(transportSchema),
  activities: z.array(activitySchema),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedFlight = z.infer<typeof flightSchema>;
export type ExtractedLodging = z.infer<typeof lodgingSchema>;
export type ExtractedTransport = z.infer<typeof transportSchema>;
export type ExtractedActivity = z.infer<typeof activitySchema>;
export type ExtractedBaggage = z.infer<typeof baggageSchema>;
