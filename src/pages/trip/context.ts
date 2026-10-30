import { useOutletContext } from "react-router";
import type { TripBundle } from "@/lib/domain/types";

export type TripContext = {
  tripId: string;
  b: TripBundle;
  rates: Record<string, { rate: number; date: string }>;
};

/** Datos del viaje cargados por TripLayout, disponibles en todas sus secciones. */
export const useTrip = () => useOutletContext<TripContext>();
