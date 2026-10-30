import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router";
import { AppShell } from "@/components/app-shell";
import { SidebarTrips } from "@/components/sidebar-trips";
import { AuthGate } from "./auth";
import { LoadingSkeleton } from "./pages/status";
import NotFound from "./pages/not-found";
import TripLayout from "./pages/trip/layout";

// Cada página se descarga al visitarla por primera vez.
const AppSettings = lazy(() => import("./pages/app-settings"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const NewTrip = lazy(() => import("./pages/new-trip"));
const Trips = lazy(() => import("./pages/trips"));
const Activities = lazy(() => import("./pages/trip/activities"));
const Destinations = lazy(() => import("./pages/trip/destinations"));
const Documents = lazy(() => import("./pages/trip/documents"));
const Finance = lazy(() => import("./pages/trip/finance"));
const Flights = lazy(() => import("./pages/trip/flights"));
const ImportPage = lazy(() => import("./pages/trip/import"));
const Lodging = lazy(() => import("./pages/trip/lodging"));
const MapPage = lazy(() => import("./pages/trip/map"));
const Overview = lazy(() => import("./pages/trip/overview"));
const Restaurants = lazy(() => import("./pages/trip/restaurants"));
const TripSettings = lazy(() => import("./pages/trip/settings"));
const Transport = lazy(() => import("./pages/trip/transport"));

// HashRouter: GitHub Pages solo sirve archivos estáticos, así las rutas funcionan al recargar.
export default function App() {
  return (
    <AuthGate>
      <HashRouter>
        <AppShell trips={<SidebarTrips />}>
          <Suspense fallback={<LoadingSkeleton />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="trips" element={<Trips />} />
              <Route path="trips/new" element={<NewTrip />} />
              <Route path="trips/:tripId" element={<TripLayout />}>
                <Route index element={<Overview />} />
                <Route path="destinations" element={<Destinations />} />
                <Route path="flights" element={<Flights />} />
                <Route path="lodging" element={<Lodging />} />
                <Route path="transport" element={<Transport />} />
                <Route path="activities" element={<Activities />} />
                <Route path="restaurants" element={<Restaurants />} />
                <Route path="finance" element={<Finance />} />
                <Route path="map" element={<MapPage />} />
                <Route path="documents" element={<Documents />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="settings" element={<TripSettings />} />
              </Route>
              <Route path="ajustes" element={<AppSettings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
      </HashRouter>
    </AuthGate>
  );
}
