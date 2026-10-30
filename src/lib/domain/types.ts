import type {
  Activity,
  BaggageAllowance,
  Destination,
  DocumentRow,
  Flight,
  Lodging,
  Restaurant,
  Transport,
  Traveler,
  Trip,
} from "../types";
import type { ExpenseWithShares } from "./finance";

export type FlightWithBaggage = Flight & { baggage: BaggageAllowance[] };

/** Toda la información de un viaje. Nunca se mezclan datos de viajes distintos. */
export type TripBundle = {
  trip: Trip;
  travelers: Traveler[];
  destinations: Destination[];
  flights: FlightWithBaggage[];
  lodgings: Lodging[];
  transports: Transport[];
  activities: Activity[];
  restaurants: Restaurant[];
  expenses: ExpenseWithShares[];
  documents: DocumentRow[];
};
