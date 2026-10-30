import {
  ACTIVITY_CATEGORY,
  BAGGAGE_CATEGORY,
  BOOKING_STATUS,
  CHECKLIST_PRIORITY,
  CHECKLIST_STATUS,
  FLIGHT_DIRECTION,
  LODGING_TYPE,
  RESTAURANT_STATUS,
  TRANSPORT_TYPE,
  TRIP_STATUS,
  options,
} from "./labels";

/**
 * Definición declarativa de los formularios. La misma definición se usa para pintar
 * el formulario (cliente) y para validar y convertir los datos (servidor).
 */

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "integer"
  | "money"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "checkbox"
  | "currency"
  | "timezone"
  | "destination"
  | "rating"
  | "location";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  /** Ocupa toda la fila. */
  wide?: boolean;
  /** Se muestra dentro de "Más detalles". */
  advanced?: boolean;
  /** Para importes: campo que contiene la moneda. */
  currencyField?: string;
  /** Para ubicaciones: columnas de lat/lng y campos usados para buscar la dirección. */
  latName?: string;
  lngName?: string;
  queryFields?: string[];
  /** Dato sensible: se enmascara al mostrarlo. */
  sensitive?: boolean;
  /** Valor inicial al crear. */
  defaultValue?: string | boolean;
};

export type EntityName =
  | "trip"
  | "traveler"
  | "destination"
  | "flight"
  | "baggage"
  | "lodging"
  | "transport"
  | "activity"
  | "restaurant"
  | "exchangeRate"
  | "task"
  | "packingItem";

export type EntityDef = {
  label: string;
  fields: FieldDef[];
};

const bookingStatusField: FieldDef = {
  name: "bookingStatus",
  label: "Estado de la reserva",
  type: "select",
  options: options(BOOKING_STATUS),
  defaultValue: "idea",
  help: "Márcala como confirmada solo cuando tengas la confirmación.",
};
const currencyField: FieldDef = { name: "currency", label: "Moneda", type: "currency" };
const notesField: FieldDef = { name: "notes", label: "Notas", type: "textarea", wide: true, advanced: true };

export const ENTITIES: Record<EntityName, EntityDef> = {
  trip: {
    label: "viaje",
    fields: [
      { name: "name", label: "Nombre del viaje", type: "text", required: true, wide: true, placeholder: "Ej.: Europa verano 2027" },
      { name: "startDate", label: "Fecha de inicio", type: "date", required: true },
      { name: "endDate", label: "Fecha de término", type: "date", required: true },
      { name: "baseCurrency", label: "Moneda principal", type: "currency", required: true, defaultValue: "CLP" },
      { name: "budgetMinor", label: "Presupuesto disponible", type: "money", currencyField: "baseCurrency" },
      { name: "status", label: "Estado", type: "select", options: options(TRIP_STATUS), defaultValue: "planificando" },
      { name: "description", label: "Objetivo o descripción", type: "textarea", wide: true },
      {
        name: "coverImage",
        label: "Imagen de portada (URL)",
        type: "url",
        wide: true,
        advanced: true,
        placeholder: "https://…",
      },
      notesField,
    ],
  },
  traveler: {
    label: "viajero",
    fields: [{ name: "name", label: "Nombre", type: "text", required: true, wide: true }],
  },
  destination: {
    label: "destino",
    fields: [
      { name: "city", label: "Ciudad", type: "text", required: true },
      { name: "country", label: "País", type: "text" },
      { name: "arrivalDate", label: "Llegada", type: "date" },
      { name: "departureDate", label: "Salida", type: "date" },
      {
        name: "location",
        label: "Ubicación en el mapa",
        type: "location",
        latName: "lat",
        lngName: "lng",
        queryFields: ["city", "country"],
        wide: true,
      },
      { name: "timezone", label: "Zona horaria", type: "timezone", advanced: true, placeholder: "Europe/Madrid" },
      notesField,
    ],
  },
  flight: {
    label: "vuelo",
    fields: [
      { name: "airline", label: "Aerolínea", type: "text" },
      { name: "flightNumber", label: "Número de vuelo", type: "text", placeholder: "IB 6830" },
      { name: "direction", label: "Tipo", type: "select", options: options(FLIGHT_DIRECTION), defaultValue: "ida" },
      bookingStatusField,
      { name: "originCode", label: "Origen (código IATA)", type: "text", placeholder: "SCL" },
      { name: "originName", label: "Aeropuerto de origen", type: "text" },
      { name: "destinationCode", label: "Destino (código IATA)", type: "text", placeholder: "MAD" },
      { name: "destinationName", label: "Aeropuerto de destino", type: "text" },
      { name: "departureLocal", label: "Salida (hora local)", type: "datetime" },
      { name: "departureTz", label: "Zona horaria de salida", type: "timezone", placeholder: "America/Santiago" },
      { name: "arrivalLocal", label: "Llegada (hora local)", type: "datetime" },
      { name: "arrivalTz", label: "Zona horaria de llegada", type: "timezone", placeholder: "Europe/Madrid" },
      { name: "bookingCode", label: "Código de reserva (PNR)", type: "text", sensitive: true },
      { name: "priceMinor", label: "Precio", type: "money", currencyField: "currency" },
      currencyField,
      { name: "seats", label: "Asientos", type: "text", advanced: true },
      { name: "cabinClass", label: "Clase", type: "text", advanced: true, placeholder: "Económica" },
      { name: "terminalOrigin", label: "Terminal de salida", type: "text", advanced: true },
      { name: "terminalDestination", label: "Terminal de llegada", type: "text", advanced: true },
      {
        name: "originLocation",
        label: "Ubicación del aeropuerto de origen",
        type: "location",
        latName: "originLat",
        lngName: "originLng",
        queryFields: ["originName", "originCode"],
        wide: true,
        advanced: true,
      },
      {
        name: "destinationLocation",
        label: "Ubicación del aeropuerto de destino",
        type: "location",
        latName: "destinationLat",
        lngName: "destinationLng",
        queryFields: ["destinationName", "destinationCode"],
        wide: true,
        advanced: true,
      },
      notesField,
    ],
  },
  baggage: {
    label: "franquicia de equipaje",
    fields: [
      { name: "category", label: "Tipo", type: "select", options: options(BAGGAGE_CATEGORY), required: true, defaultValue: "cabina" },
      { name: "quantity", label: "Cantidad permitida", type: "integer" },
      { name: "maxWeightKg", label: "Peso máximo (kg)", type: "number" },
      { name: "maxDimensions", label: "Dimensiones máximas", type: "text", placeholder: "55 × 40 × 20 cm" },
      { name: "extraCostMinor", label: "Costo por pieza adicional", type: "money", currencyField: "currency" },
      currencyField,
      { name: "restrictions", label: "Restricciones y objetos prohibidos", type: "textarea", wide: true },
    ],
  },
  lodging: {
    label: "alojamiento",
    fields: [
      { name: "name", label: "Nombre", type: "text", required: true, wide: true },
      { name: "type", label: "Tipo", type: "select", options: options(LODGING_TYPE), defaultValue: "hotel" },
      { name: "platform", label: "Plataforma de reserva", type: "text", placeholder: "Booking.com, Airbnb…" },
      { name: "destinationId", label: "Destino", type: "destination" },
      bookingStatusField,
      { name: "checkInDate", label: "Check-in", type: "date" },
      { name: "checkOutDate", label: "Check-out", type: "date" },
      { name: "checkInTime", label: "Hora de entrada", type: "time" },
      { name: "checkOutTime", label: "Hora de salida", type: "time" },
      { name: "address", label: "Dirección", type: "text", wide: true },
      { name: "city", label: "Ciudad", type: "text" },
      { name: "country", label: "País", type: "text" },
      {
        name: "location",
        label: "Ubicación en el mapa",
        type: "location",
        latName: "lat",
        lngName: "lng",
        queryFields: ["address", "city", "country"],
        wide: true,
      },
      { name: "priceMinor", label: "Precio total", type: "money", currencyField: "currency" },
      currencyField,
      { name: "taxesMinor", label: "Impuestos y tasas", type: "money", currencyField: "currency", advanced: true },
      { name: "bookingCode", label: "Código de reserva", type: "text", sensitive: true },
      { name: "holderName", label: "Titular", type: "text", advanced: true },
      { name: "guests", label: "Huéspedes", type: "integer", advanced: true },
      { name: "bookingUrl", label: "Enlace a la reserva", type: "url", wide: true, advanced: true },
      { name: "cancellationPolicy", label: "Política de cancelación", type: "textarea", wide: true, advanced: true },
      { name: "amenities", label: "Servicios incluidos", type: "textarea", wide: true, advanced: true },
      { name: "accessInfo", label: "Información de acceso", type: "textarea", wide: true, advanced: true, sensitive: true },
      { name: "hostContact", label: "Contacto del anfitrión", type: "text", wide: true, advanced: true },
      notesField,
    ],
  },
  transport: {
    label: "transporte",
    fields: [
      { name: "type", label: "Tipo", type: "select", options: options(TRANSPORT_TYPE), defaultValue: "tren" },
      { name: "operator", label: "Empresa operadora", type: "text", placeholder: "Renfe, Trenitalia…" },
      { name: "serviceNumber", label: "Número de servicio", type: "text" },
      bookingStatusField,
      { name: "origin", label: "Origen (estación / lugar)", type: "text" },
      { name: "destination", label: "Destino (estación / lugar)", type: "text" },
      { name: "departureLocal", label: "Salida (hora local)", type: "datetime" },
      { name: "arrivalLocal", label: "Llegada (hora local)", type: "datetime" },
      { name: "timezone", label: "Zona horaria", type: "timezone", placeholder: "Europe/Madrid" },
      { name: "bookingCode", label: "Código de reserva", type: "text", sensitive: true },
      { name: "priceMinor", label: "Precio", type: "money", currencyField: "currency" },
      currencyField,
      { name: "seat", label: "Asiento", type: "text", advanced: true },
      { name: "travelClass", label: "Clase", type: "text", advanced: true },
      { name: "baggageInfo", label: "Equipaje permitido", type: "text", wide: true, advanced: true },
      {
        name: "directionsInfo",
        label: "Cómo llegar (desde/hacia el alojamiento)",
        type: "textarea",
        wide: true,
        advanced: true,
      },
      {
        name: "originLocation",
        label: "Ubicación del origen",
        type: "location",
        latName: "originLat",
        lngName: "originLng",
        queryFields: ["origin"],
        wide: true,
        advanced: true,
      },
      {
        name: "destinationLocation",
        label: "Ubicación del destino",
        type: "location",
        latName: "destinationLat",
        lngName: "destinationLng",
        queryFields: ["destination"],
        wide: true,
        advanced: true,
      },
      notesField,
    ],
  },
  activity: {
    label: "actividad",
    fields: [
      { name: "name", label: "Nombre", type: "text", required: true, wide: true },
      { name: "category", label: "Categoría", type: "select", options: options(ACTIVITY_CATEGORY), defaultValue: "turismo" },
      { name: "destinationId", label: "Destino", type: "destination" },
      { name: "date", label: "Fecha", type: "date" },
      { name: "startTime", label: "Hora de inicio", type: "time" },
      { name: "endTime", label: "Hora de término", type: "time" },
      { name: "requiresBooking", label: "Requiere reserva previa", type: "checkbox" },
      bookingStatusField,
      { name: "address", label: "Dirección", type: "text", wide: true },
      { name: "city", label: "Ciudad", type: "text" },
      {
        name: "location",
        label: "Ubicación en el mapa",
        type: "location",
        latName: "lat",
        lngName: "lng",
        queryFields: ["name", "address", "city"],
        wide: true,
      },
      { name: "priceMinor", label: "Precio", type: "money", currencyField: "currency" },
      currencyField,
      { name: "bookingUrl", label: "Enlace de compra o reserva", type: "url", wide: true, advanced: true },
      { name: "bookingCode", label: "Código de reserva", type: "text", advanced: true, sensitive: true },
      { name: "description", label: "Descripción", type: "textarea", wide: true, advanced: true },
      notesField,
    ],
  },
  restaurant: {
    label: "restaurante",
    fields: [
      { name: "name", label: "Nombre", type: "text", required: true, wide: true },
      { name: "listStatus", label: "Lista", type: "select", options: options(RESTAURANT_STATUS), defaultValue: "por_visitar" },
      { name: "destinationId", label: "Destino", type: "destination" },
      { name: "cuisine", label: "Tipo de gastronomía", type: "text" },
      { name: "priceRange", label: "Precio estimado", type: "text", placeholder: "€€ / 30 € por persona" },
      { name: "address", label: "Dirección", type: "text", wide: true },
      { name: "city", label: "Ciudad", type: "text" },
      {
        name: "location",
        label: "Ubicación en el mapa",
        type: "location",
        latName: "lat",
        lngName: "lng",
        queryFields: ["name", "address", "city"],
        wide: true,
      },
      { name: "requiresBooking", label: "Necesita reserva", type: "checkbox" },
      { name: "reservedAt", label: "Reserva (fecha y hora)", type: "datetime" },
      { name: "rating", label: "Calificación personal", type: "rating" },
      { name: "openingHours", label: "Horarios", type: "text", advanced: true },
      { name: "mapsUrl", label: "Enlace a Google Maps", type: "url", wide: true, advanced: true },
      { name: "website", label: "Sitio web", type: "url", wide: true, advanced: true },
      notesField,
    ],
  },
  task: {
    label: "tarea",
    fields: [
      { name: "title", label: "Tarea", type: "text", required: true, wide: true },
      { name: "dueDate", label: "Fecha límite", type: "date" },
      { name: "priority", label: "Prioridad", type: "select", options: options(CHECKLIST_PRIORITY), defaultValue: "media" },
      { name: "status", label: "Estado", type: "select", options: options(CHECKLIST_STATUS), defaultValue: "pendiente" },
      { name: "groupName", label: "Lista", type: "text", placeholder: "Documentos, Reservas…" },
      notesField,
    ],
  },
  packingItem: {
    label: "objeto",
    fields: [
      { name: "title", label: "Objeto", type: "text", required: true, wide: true },
      { name: "bag", label: "Va en", type: "select", options: options(BAGGAGE_CATEGORY) },
      { name: "groupName", label: "Categoría", type: "text", placeholder: "Ropa, Aseo, Electrónica…" },
      { name: "quantity", label: "Cantidad", type: "integer", placeholder: "1" },
      { name: "weightKg", label: "Peso por unidad (kg)", type: "number", help: "Opcional. Con el peso se comprueba el límite de tus vuelos." },
      { name: "status", label: "Estado", type: "select", options: options(CHECKLIST_STATUS), defaultValue: "pendiente" },
      notesField,
    ],
  },
  exchangeRate: {
    label: "tipo de cambio",
    fields: [
      { name: "fromCurrency", label: "1 unidad de", type: "currency", required: true, defaultValue: "EUR" },
      { name: "toCurrency", label: "Equivale en", type: "currency", required: true, defaultValue: "CLP" },
      { name: "rate", label: "Tipo de cambio", type: "number", required: true, placeholder: "1050" },
      { name: "date", label: "Fecha", type: "date", required: true },
    ],
  },
};

/** Columnas que se rellenan a partir de los campos (los de ubicación generan dos). */
export function columnNames(def: EntityDef): string[] {
  return def.fields.flatMap((f) => (f.type === "location" ? [f.latName!, f.lngName!] : [f.name]));
}
