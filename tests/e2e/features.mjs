/**
 * Prueba E2E de checklist, calendario, PDF, búsqueda, documentos y modo sin conexión.
 * Requisitos: los mismos que smoke.mjs. Con ESQUEMA_ANTIGUO=1 solo comprueba que la app sigue
 * funcionando cuando la tabla de la checklist todavía no existe en Supabase.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const load = createRequire(import.meta.url);
const { chromium } = load("playwright");

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const BASE = `${ORIGIN}#`;
const API = process.env.API_URL ?? "http://127.0.0.1:54321";
const TOKEN = process.env.VITE_TEST_ACCESS_TOKEN;
const OLD_SCHEMA = process.env.ESQUEMA_ANTIGUO === "1";

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

const rest = async (table, method, body, query = "") => {
  const res = await fetch(`${API}/rest/v1/${table}${query}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
};

async function seed() {
  const [trip] = await rest("tm_trips", "POST", { name: "Viaje E2E", start_date: "2027-03-01", end_date: "2027-03-05", base_currency: "CLP" });
  const trip_id = trip.id;
  const [flight] = await rest("tm_flights", "POST", {
    trip_id, airline: "Aerolínea Ficticia", flight_number: "FX1", origin_code: "SCL", destination_code: "MAD",
    departure_local: "2027-03-01T10:00", departure_tz: "America/Santiago", arrival_local: "2027-03-02T05:00", arrival_tz: "Europe/Madrid",
    booking_status: "confirmado", booking_code: "PNRSECRETO",
  });
  await rest("tm_baggage_allowances", "POST", { trip_id, flight_id: flight.id, category: "facturado", quantity: 1, max_weight_kg: 10 });
  await rest("tm_transports", "POST", { trip_id, type: "tren", origin: "Madrid", destination: "Sevilla", booking_status: "idea" });
  const activities = await rest("tm_activities", "POST", [
    { trip_id, name: "Museo A", date: "2027-03-02", category: "museo" },
    { trip_id, name: "Paseo B", date: "2027-03-02", category: "turismo" },
    { trip_id, name: "Sin fecha C", category: "otro" },
  ]);
  await rest("tm_restaurants", "POST", [
    { trip_id, name: "Tasca", city: "Madrid", cuisine: "Española" },
    { trip_id, name: "Trattoria", city: "Roma", cuisine: "Italiana" },
  ]);
  return { tripId: trip_id, activities };
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await context.route(/tile\.openstreetmap\.org|wikimedia|wikipedia/, (r) => r.fulfill({ status: 204, body: "" }));

  try {
    const { tripId, activities } = await seed();
    const trip = `${BASE}/trips/${tripId}`;
    await page.goto(trip);
    await page.waitForSelector("text=Viaje E2E");
    check("el resumen del viaje carga", !(await page.innerText("main")).includes("Falta preparar la base de datos"));
    await page.click("main a:has-text('Noches con alojamiento')");
    await page.waitForURL(/\/lodging$/);
    await page.goBack();
    await page.click("main a:has-text('Pagado')");
    await page.waitForURL(/\/finance$/);
    await page.goBack();
    await page.click("main a:has-text('Vuelos'):has-text('destinos')");
    await page.waitForURL(/\/flights$/);
    await page.goBack();
    await page.click("main button:has-text('Reservas confirmadas')");
    await page.waitForFunction(() => { const r = document.getElementById("reservas")?.getBoundingClientRect(); return r && r.top < innerHeight; });
    check("las tarjetas del resumen llevan a su sección", true);

    if (OLD_SCHEMA) {
      await page.goto(`${trip}/checklist`);
      await page.waitForSelector("text=Falta actualizar la base de datos");
      check("checklist explica cómo activarse", true);
      await page.goto(`${BASE}/`);
      await page.waitForSelector("text=Próximos viajes");
      check("dashboard funciona sin la tabla nueva", true);
      await page.goto(`${trip}/flights`);
      await page.waitForSelector("text=¿Qué equipaje puedo llevar");
      check("vuelos y resumen de equipaje funcionan", true);
      await page.goto(`${BASE}/ajustes`);
      await page.click("text=Exportar mis datos");
      check("exportar funciona", true);
      await rest("tm_trips", "DELETE", undefined, `?id=eq.${tripId}`);
    } else {
      // Checklist
      await page.goto(`${trip}/checklist`);
      await page.click("button:has-text('Sugerencias')");
      await page.waitForSelector("dialog[open] >> text=Comprar billete Madrid → Sevilla");
      check("sugiere lo que falta reservar", true);
      await page.click("dialog[open] button:has-text('Añadir')");
      await page.waitForSelector("role=checkbox[name='Comprar billete Madrid → Sevilla']");
      await page.click("role=checkbox[name='Comprar billete Madrid → Sevilla']");
      await page.waitForFunction(() => document.querySelector("[role=checkbox][aria-checked=true]"));
      check("marcar tarea como hecha", (await page.innerText("main")).includes("1 de"));
      const rows = await rest("tm_checklist_items", "GET", undefined, `?trip_id=eq.${tripId}&status=eq.hecho`);
      check("la tarea queda guardada en la base de datos", rows.length === 1);

      await page.goto(`${trip}/checklist?lista=maleta`);
      await page.click("button[aria-label='Agregar objeto']");
      await page.fill("dialog[open] #f-title", "Botas pesadas");
      await page.selectOption("dialog[open] #f-bag", "facturado");
      await page.fill("dialog[open] #f-quantity", "3");
      await page.fill("dialog[open] #f-weightKg", "4");
      await page.click("dialog[open] button[type=submit]");
      await page.waitForSelector("text=pesa 12 kg y el límite es 10 kg");
      check("la maleta se compara con el límite del vuelo", true);
      await page.goto(trip);
      await page.waitForSelector("text=pesa 12 kg y el límite es 10 kg");
      check("alerta de maleta en el resumen", true);

      // Calendario
      await page.goto(`${trip}/calendar`);
      await page.waitForSelector("[data-date='2027-03-02'] >> text=Museo A");
      check("calendario mensual muestra actividades y vuelos", (await page.innerText("[data-date='2027-03-01']")).includes("SCL"));
      await page.dragAndDrop("[data-date='2027-03-02'] >> text=Museo A", "[data-date='2027-03-04']");
      await page.waitForSelector("[data-date='2027-03-04'] >> text=Museo A");
      const [moved] = await rest("tm_activities", "GET", undefined, `?id=eq.${activities[0].id}`);
      check("arrastrar cambia el día", moved.date === "2027-03-04");
      await page.dragAndDrop("text=Sin fecha C", "[data-date='2027-03-03']");
      await page.waitForSelector("[data-date='2027-03-03'] >> text=Sin fecha C");
      check("arrastrar asigna fecha a una actividad sin fecha", true);
      await page.click("[aria-label='Ver el 4 de marzo']");
      await page.waitForSelector("main >> text=/jueves 4 de marzo/i");
      check("clic en un día abre la vista de día", (await page.innerText("main")).includes("Museo A"));
      await page.goto(`${trip}/calendar?vista=semana`);
      await page.waitForSelector("[data-date='2027-03-04'] >> text=Museo A");
      check("vista semanal", true);

      // Orden manual
      await rest("tm_activities", "PATCH", { date: "2027-03-02" }, `?trip_id=eq.${tripId}`);
      await page.goto(`${trip}/activities`);
      await page.waitForSelector("h3:has-text('Paseo B')");
      await page.dragAndDrop("h3:has-text('Sin fecha C')", "h3:has-text('Museo A')");
      await page.waitForFunction(() => {
        const names = [...document.querySelectorAll("main h3")].map((h) => h.textContent);
        return names.indexOf("Sin fecha C") < names.indexOf("Museo A");
      });
      check("arrastrar reordena dentro del día", true);

      // Restaurantes
      await page.goto(`${trip}/restaurants`);
      await page.click("a:has-text('Italiana')");
      await page.waitForSelector("h3:has-text('Trattoria')");
      await page.waitForSelector("h3:has-text('Tasca')", { state: "detached" });
      check("filtro por gastronomía", true);
      await page.click("a:has-text('Madrid')");
      await page.waitForSelector("text=Ningún restaurante coincide");
      check("filtros combinados", true);

      // Búsqueda
      await page.goto(`${BASE}/`);
      await page.waitForSelector("text=Próximos viajes");
      await page.keyboard.press("Control+k");
      await page.fill("input[type=search]", "sevilla");
      await page.waitForSelector("main >> text=Madrid → Sevilla");
      check("búsqueda global con Ctrl+K", true);
      await page.fill("input[type=search]", "PNRSECRETO");
      await page.waitForSelector("text=Sin resultados");
      check("la búsqueda no expone códigos de reserva", true);

      // PDF
      await page.goto(`${trip}/print`);
      await page.waitForSelector("text=Guardar como PDF");
      const before = await page.innerText("main");
      check("el itinerario oculta el código por defecto", !before.includes("PNRSECRETO"));
      await page.check("input[type=checkbox]");
      check("el código se incluye al pedirlo", (await page.innerText("main")).includes("PNRSECRETO"));
      await page.uncheck("input[type=checkbox]");
      await page.emulateMedia({ media: "print", colorScheme: "dark" });
      check("al imprimir se ocultan los controles", !(await page.isVisible("text=Guardar como PDF")));
      await page.pdf({ path: `${SHOTS}/itinerario.pdf`, format: "A4" });
      await page.emulateMedia({ media: "screen" });
      check("se genera el PDF", fs.statSync(`${SHOTS}/itinerario.pdf`).size > 5000);

      // Pagos entre viajeros
      const [v1, v2] = await rest("tm_travelers", "POST", [{ trip_id: tripId, name: "Viajero Uno" }, { trip_id: tripId, name: "Viajero Dos" }]);
      await rest("tm_expenses", "POST", {
        trip_id: tripId, description: "Cena de prueba", category: "otros", amount_minor: 1000, currency: "CLP", exchange_rate: 1, amount_base_minor: 1000,
        status: "pagado", paid_by_traveler_id: v1.id, shares: [{ travelerId: v1.id, shareBaseMinor: 500 }, { travelerId: v2.id, shareBaseMinor: 500 }],
      });
      await page.goto(`${trip}/finance`);
      await page.reload();
      await page.click("button:has-text('Registrar pago')");
      await page.waitForSelector("text=Las cuentas están equilibradas");
      check("registrar un pago salda las cuentas", (await page.innerText("main")).includes("Pagos entre viajeros"));
      check("el pago no cambia el total del viaje", (await page.innerText("main")).includes("$1.000"));

      // Documentos: el bug de «Abrir» y copia sin conexión
      await page.goto(`${trip}/documents`);
      await page.click("button:has-text('Subir'), button:has-text('Agregar')");
      await page.setInputFiles("dialog[open] input[type=file]", { name: "billete.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prueba") });
      await page.click("dialog[open] button[type=submit]");
      await page.waitForSelector("main >> text=billete.pdf");
      // Chromium sin interfaz no tiene visor de PDF: descarga el archivo, por eso se mira la petición.
      const [signed] = await Promise.all([context.waitForEvent("request", (r) => /\/object\/sign\/.*token=/.test(r.url()) && r.method() === "GET"), page.click("button:has-text('Abrir')")]);
      const served = await signed.response();
      check("«Abrir» pide el archivo con un enlace firmado", served?.status() === 200, `HTTP ${served?.status()} ${signed.url().split("?")[0].slice(-30)}`);
      for (const p of context.pages()) if (p !== page) await p.close();
      await page.click("button:has-text('Guardar para usar sin conexión')");
      await page.waitForSelector("text=Todos disponibles sin conexión");
      check("guardar documentos sin conexión", true);

      // Instalable
      const manifest = await page.evaluate(async () => {
        const href = document.querySelector("link[rel=manifest]").href;
        const m = await (await fetch(href)).json();
        const icons = await Promise.all(m.icons.map(async (i) => (await fetch(new URL(i.src, href))).status));
        return { ...m, iconStatus: icons };
      });
      check("manifest instalable", manifest.display === "standalone" && manifest.icons.some((i) => i.sizes === "512x512") && manifest.iconStatus.every((s) => s === 200));
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      check("service worker activo", true);

      // Sin conexión: se recorren las pantallas ya abiertas.
      await page.goto(trip);
      await page.waitForSelector("text=Viaje E2E");
      await page.goto(`${trip}/checklist`);
      await page.waitForSelector("text=Checklist");
      await page.waitForTimeout(800);
      await context.setOffline(true);
      await page.reload();
      await page.waitForSelector("text=Sin conexión: ves la última copia");
      await page.waitForSelector("role=checkbox[name='Comprar billete Madrid → Sevilla']");
      check("sin conexión la app abre y muestra la copia local", true);
      await page.click("role=checkbox[name='Comprar billete Madrid → Sevilla']");
      await page.waitForSelector("text=Sin conexión la checklist es de solo lectura");
      check("sin conexión avisa que no puede guardar", true);
      await page.goto(`${trip}/calendar`);
      await page.waitForSelector("[data-date='2027-03-02'] >> text=Museo A");
      check("calendario disponible sin conexión", true);
      await page.goto(`${trip}/documents`);
      await page.waitForSelector("main >> text=billete.pdf");
      const [download] = await Promise.all([page.waitForEvent("download"), page.click("button:has-text('Abrir')")]);
      check("documento guardado se abre sin conexión", (await download.suggestedFilename()) === "billete.pdf");
      await context.setOffline(false);
      await page.waitForSelector("text=Sin conexión: ves la última copia", { state: "detached" });
      check("al volver la conexión desaparece el aviso", true);

      await rest("tm_trips", "DELETE", undefined, `?id=eq.${tripId}`);
    }
  } catch (e) {
    check("ejecución", false, e.message.split("\n")[0]);
    await page.screenshot({ path: `${SHOTS}/error-features.png`, fullPage: true });
  }
  console.log(results.join("\n"));
  console.log(errors.length ? `\nErrores del navegador:\n${[...new Set(errors)].join("\n")}` : "\nSin errores de JavaScript.");
  await browser.close();
})();
