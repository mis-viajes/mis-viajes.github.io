/** Etiquetas en español para los valores enumerados del modelo. */

export const BOOKING_STATUS: Record<string, string> = {
  idea: "Idea",
  estimado: "Estimado",
  reservado: "Reservado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

export const TRIP_STATUS: Record<string, string> = {
  planificando: "Planificando",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

export const TRIP_PHASE: Record<string, string> = {
  futuro: "Próximo",
  en_curso: "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const FLIGHT_DIRECTION: Record<string, string> = {
  ida: "Ida",
  vuelta: "Vuelta",
  conexion: "Conexión",
  interno: "Vuelo interno",
};

export const BAGGAGE_CATEGORY: Record<string, string> = {
  personal: "Artículo personal",
  cabina: "Equipaje de cabina",
  facturado: "Equipaje facturado",
  adicional: "Equipaje adicional",
};

export const LODGING_TYPE: Record<string, string> = {
  hotel: "Hotel",
  airbnb: "Airbnb",
  apartamento: "Apartamento",
  hostal: "Hostal",
  otro: "Otro",
};

export const TRANSPORT_TYPE: Record<string, string> = {
  tren: "Tren",
  bus: "Autobús",
  metro: "Metro",
  tranvia: "Tranvía",
  taxi: "Taxi",
  vtc: "Uber / VTC",
  alquiler: "Coche de alquiler",
  traslado: "Traslado",
  ferry: "Ferry",
  otro: "Otro",
};

export const ACTIVITY_CATEGORY: Record<string, string> = {
  turismo: "Turismo",
  museo: "Museo",
  monumento: "Monumento",
  excursion: "Excursión",
  compras: "Compras",
  entretenimiento: "Entretenimiento",
  evento: "Evento",
  gratuita: "Actividad gratuita",
  otro: "Otro",
};

export const RESTAURANT_STATUS: Record<string, string> = {
  por_visitar: "Por visitar",
  recomendado: "Recomendado",
  reservado: "Reservado",
  visitado: "Visitado",
};

export const EXPENSE_CATEGORY: Record<string, string> = {
  vuelos: "Vuelos",
  alojamiento: "Alojamiento",
  transporte: "Transporte",
  alimentacion: "Alimentación",
  restaurantes: "Restaurantes",
  actividades: "Actividades y entradas",
  compras: "Compras",
  equipaje: "Equipaje adicional",
  seguros: "Seguros",
  impuestos: "Impuestos y tasas",
  otros: "Otros",
};

export const EXPENSE_STATUS: Record<string, string> = {
  pagado: "Pagado",
  parcial: "Pagado en parte",
  pendiente: "Pendiente de pago",
  previsto: "Previsto (futuro)",
};

export const DOCUMENT_TYPE: Record<string, string> = {
  pasaporte: "Pasaporte / documentación",
  billete_avion: "Billete de avión",
  tarjeta_embarque: "Tarjeta de embarque",
  reserva_alojamiento: "Reserva de alojamiento",
  billete_transporte: "Billete de tren / bus",
  entrada: "Entrada",
  seguro: "Seguro de viaje",
  comprobante: "Comprobante de pago",
  otro: "Otro",
};

export function options(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}
