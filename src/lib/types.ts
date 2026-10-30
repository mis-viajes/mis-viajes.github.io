/**
 * Tipos de las entidades (en camelCase). En Supabase las columnas están en snake_case
 * con prefijo de tabla `tm_` (ver supabase/schema.sql); src/lib/db.ts hace la conversión.
 *
 * Convenciones:
 * - Importes en unidad mínima (entero) + código ISO 4217 (CLP: 0 decimales, EUR/USD: 2).
 * - Fechas: "YYYY-MM-DD". Fecha-hora local: "YYYY-MM-DDTHH:mm" + zona horaria IANA aparte.
 * - Todo cuelga de un viaje (tripId) y se borra en cascada: cada viaje es independiente.
 * - Estados por defecto: el menos comprometido (nunca se asume confirmado ni pagado).
 */

type Row = { id: string; createdAt: string; updatedAt: string };

export type BookingStatus = "idea" | "estimado" | "reservado" | "confirmado" | "cancelado";

export type Trip = Row & {
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  baseCurrency: string;
  budgetMinor: number | null;
  coverImage: string | null;
  /** Estado de planificación. La fase temporal (futuro / en curso / finalizado) se calcula por fechas. */
  status: "planificando" | "confirmado" | "cancelado";
  notes: string | null;
};

export type Traveler = Row & { tripId: string; name: string; color: string | null };

export type Destination = Row & {
  tripId: string;
  city: string;
  country: string | null;
  position: number;
  arrivalDate: string | null;
  departureDate: string | null;
  timezone: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

export type Flight = Row & {
  tripId: string;
  direction: "ida" | "vuelta" | "conexion" | "interno";
  airline: string | null;
  flightNumber: string | null;
  bookingCode: string | null;
  originCode: string | null;
  originName: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationCode: string | null;
  destinationName: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  departureLocal: string | null;
  departureTz: string | null;
  arrivalLocal: string | null;
  arrivalTz: string | null;
  terminalOrigin: string | null;
  terminalDestination: string | null;
  seats: string | null;
  cabinClass: string | null;
  priceMinor: number | null;
  currency: string | null;
  bookingStatus: BookingStatus;
  notes: string | null;
};

export type BaggageAllowance = Row & {
  tripId: string;
  flightId: string;
  category: "personal" | "cabina" | "facturado" | "adicional";
  quantity: number | null;
  maxWeightKg: number | null;
  maxDimensions: string | null;
  extraCostMinor: number | null;
  currency: string | null;
  restrictions: string | null;
};

export type Lodging = Row & {
  tripId: string;
  destinationId: string | null;
  name: string;
  type: "hotel" | "airbnb" | "apartamento" | "hostal" | "otro";
  platform: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  priceMinor: number | null;
  taxesMinor: number | null;
  currency: string | null;
  bookingCode: string | null;
  holderName: string | null;
  guests: number | null;
  cancellationPolicy: string | null;
  amenities: string | null;
  accessInfo: string | null;
  hostContact: string | null;
  bookingUrl: string | null;
  bookingStatus: BookingStatus;
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

export type Transport = Row & {
  tripId: string;
  type: "tren" | "bus" | "metro" | "tranvia" | "taxi" | "vtc" | "alquiler" | "traslado" | "ferry" | "otro";
  operator: string | null;
  serviceNumber: string | null;
  origin: string | null;
  originLat: number | null;
  originLng: number | null;
  destination: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  departureLocal: string | null;
  arrivalLocal: string | null;
  timezone: string | null;
  seat: string | null;
  travelClass: string | null;
  bookingCode: string | null;
  baggageInfo: string | null;
  directionsInfo: string | null;
  priceMinor: number | null;
  currency: string | null;
  bookingStatus: BookingStatus;
  notes: string | null;
};

export type Activity = Row & {
  tripId: string;
  destinationId: string | null;
  name: string;
  description: string | null;
  category: "turismo" | "museo" | "monumento" | "excursion" | "compras" | "entretenimiento" | "evento" | "gratuita" | "otro";
  city: string | null;
  address: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  priceMinor: number | null;
  currency: string | null;
  requiresBooking: boolean;
  bookingStatus: BookingStatus;
  bookingUrl: string | null;
  bookingCode: string | null;
  lat: number | null;
  lng: number | null;
  /** Orden manual dentro del día (solo decide entre actividades sin hora). */
  position?: number;
  notes: string | null;
};

export type Restaurant = Row & {
  tripId: string;
  destinationId: string | null;
  name: string;
  address: string | null;
  city: string | null;
  cuisine: string | null;
  priceRange: string | null;
  openingHours: string | null;
  rating: number | null;
  mapsUrl: string | null;
  website: string | null;
  requiresBooking: boolean;
  reservedAt: string | null;
  listStatus: "por_visitar" | "recomendado" | "reservado" | "visitado";
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

export type DocumentRow = Row & {
  tripId: string;
  title: string;
  type:
    | "pasaporte"
    | "billete_avion"
    | "tarjeta_embarque"
    | "reserva_alojamiento"
    | "billete_transporte"
    | "entrada"
    | "seguro"
    | "comprobante"
    | "otro";
  fileName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  linkedType: "flight" | "lodging" | "transport" | "activity" | "expense" | null;
  linkedId: string | null;
  notes: string | null;
};

export type ChecklistStatus = "pendiente" | "en_curso" | "hecho";

/** Tarea por hacer antes o durante el viaje, u objeto de la maleta (según `list`). */
export type ChecklistItem = Row & {
  tripId: string;
  list: "tareas" | "maleta";
  title: string;
  groupName: string | null;
  status: ChecklistStatus;
  priority: "alta" | "media" | "baja";
  dueDate: string | null;
  bag: BaggageAllowance["category"] | null;
  quantity: number | null;
  /** Peso de una unidad. */
  weightKg: number | null;
  notes: string | null;
};

export const EXPENSE_STATUSES = ["pagado", "parcial", "pendiente", "previsto"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/** Parte de un gasto que corresponde a un viajero, en moneda base del viaje. */
export type ExpenseShare = { travelerId: string; shareBaseMinor: number };

export type Expense = Row & {
  tripId: string;
  destinationId: string | null;
  description: string;
  category:
    | "vuelos"
    | "alojamiento"
    | "transporte"
    | "alimentacion"
    | "restaurantes"
    | "actividades"
    | "compras"
    | "equipaje"
    | "seguros"
    | "impuestos"
    | "otros";
  date: string | null;
  amountMinor: number;
  currency: string;
  /** Unidades de moneda base por 1 unidad de `currency`. Se congela al registrar el gasto. */
  exchangeRate: number;
  amountBaseMinor: number;
  /**
   * pagado: ya se pagó · parcial: pagado en parte (ver paidMinor) ·
   * pendiente: comprometido pero sin pagar · previsto: gasto futuro estimado, aún no comprometido.
   */
  status: ExpenseStatus;
  /** Importe ya pagado, en moneda original (solo para estado parcial). */
  paidMinor: number | null;
  paidByTravelerId: string | null;
  paymentMethod: string | null;
  splitMode: "igual" | "personalizado";
  sourceType: "flight" | "lodging" | "transport" | "activity" | null;
  sourceId: string | null;
  shares: ExpenseShare[];
  notes: string | null;
};

/** Dinero que un viajero le devuelve a otro. No es un gasto: mueve el saldo, no el total del viaje. */
export type Repayment = Row & {
  tripId: string;
  fromTravelerId: string;
  toTravelerId: string;
  amountBaseMinor: number;
  date: string;
  notes: string | null;
};

export type ExchangeRate = Row & {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
  source: string;
};
