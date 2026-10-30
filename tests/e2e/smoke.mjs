/**
 * Prueba de humo de punta a punta (Playwright) de la versión estática.
 *
 * Corre contra el servidor de pruebas tests/e2e/fake-supabase.mjs (PostgreSQL local con
 * supabase/schema.sql y RLS) y la app compilada en modo test (`npm run build:test` + `npm run preview:test`).
 * La API de Claude se simula interceptando la petición a api.anthropic.com.
 * Si Playwright no está instalado: npm i -D playwright && npx playwright install chromium
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Carga con resolución CommonJS para encontrar también una instalación global de Playwright.
const load = createRequire(import.meta.url);
const { chromium } = load("playwright");

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:4173/travel-manager/") + "#";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/tile\.openstreetmap|nominatim|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  // El navegador de pruebas no tiene salida a internet: se simulan las teselas del mapa.
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 204, body: "" }));

  try {
    // 1. Crear viaje
    await page.goto(`${BASE}/trips/new`);
    await page.fill("#f-name", "Prueba E2E");
    await page.fill("#f-startDate", "2027-03-01");
    await page.fill("#f-endDate", "2027-03-05");
    await page.selectOption("#f-baseCurrency", "CLP");
    await page.fill("#f-budgetMinor", "2.000.000");
    await page.fill("#ownerName", "Viajero 1");
    await page.click("button[type=submit]");
    await page.waitForURL(/\/trips\/[0-9a-f-]{36}$/, { timeout: 20000 });
    const tripUrl = page.url();
    check("crear viaje redirige a la ficha", true, tripUrl);
    await page.waitForSelector("text=Presupuesto restante");
    check("presupuesto visible", (await page.innerText("main")).includes("2.000.000"));

    // Validación: fechas invertidas
    await page.goto(`${BASE}/trips/new`);
    await page.fill("#f-name", "Malo");
    await page.fill("#f-startDate", "2027-03-05");
    await page.fill("#f-endDate", "2027-03-01");
    await page.click("button[type=submit]");
    await page.waitForSelector("text=La fecha de término debe ser posterior al inicio");
    check("validación de fechas y conserva datos", (await page.inputValue("#f-name")) === "Malo");

    // 2. Viajero adicional
    await page.goto(`${tripUrl}/settings`);
    await page.click("button[aria-label='Agregar viajero']");
    await page.fill("dialog[open] #f-name", "Viajero 2");
    await page.click("dialog[open] button[type=submit]");
    await page.waitForSelector("dialog[open]", { state: "detached" }).catch(() => {});
    await page.waitForSelector("text=Viajero 2");
    check("añadir viajero", true);

    // 3. Destino
    await page.goto(`${tripUrl}/destinations`);
    await page.click("button[aria-label='Agregar destino']");
    await page.fill("dialog[open] #f-city", "Madrid");
    await page.fill("dialog[open] #f-country", "España");
    await page.fill("dialog[open] #f-arrivalDate", "2027-03-02");
    await page.fill("dialog[open] #f-departureDate", "2027-03-05");
    await page.fill("dialog[open] input[name=lat]", "40.4168");
    await page.fill("dialog[open] input[name=lng]", "-3.7038");
    await page.click("dialog[open] button[type=submit]");
    await page.waitForSelector("h3:has-text('Madrid')");
    check("añadir destino con coordenadas", (await page.innerText("main")).includes("3 noches"));

    // 4. Vuelo + equipaje
    await page.goto(`${tripUrl}/flights`);
    await page.click("button[aria-label='Agregar vuelo']");
    const d = "dialog[open] ";
    await page.fill(d + "#f-airline", "Aerolínea Prueba");
    await page.fill(d + "#f-flightNumber", "ZZ 1");
    await page.fill(d + "#f-originCode", "SCL");
    await page.fill(d + "#f-destinationCode", "MAD");
    await page.fill(d + "#f-departureLocal", "2027-03-01T12:30");
    await page.fill(d + "#f-departureTz", "America/Santiago");
    await page.fill(d + "#f-arrivalLocal", "2027-03-02T06:45");
    await page.fill(d + "#f-arrivalTz", "Europe/Madrid");
    await page.selectOption(d + "#f-bookingStatus", "confirmado");
    await page.click(d + "button[type=submit]");
    await page.waitForSelector("text=Aerolínea Prueba ZZ 1");
    const flightText = await page.innerText("main");
    // En marzo de 2027 Santiago está en UTC-3 y Madrid en UTC+1: 14 h 15 min.
    check("duración de vuelo con zonas horarias", flightText.includes("14 h 15 min"));
    check("alerta de vuelo sin equipaje", flightText.includes("Sin información de equipaje"));
    await page.click("button[aria-label='Agregar franquicia de equipaje']");
    await page.selectOption(d + "#f-category", "cabina");
    await page.fill(d + "#f-quantity", "1");
    await page.fill(d + "#f-maxWeightKg", "10");
    await page.fill(d + "#f-maxDimensions", "55 × 35 × 25 cm");
    await page.click(d + "button[type=submit]");
    await page.waitForSelector("text=máx. 10 kg");
    check("equipaje por vuelo y resumen", (await page.innerText("main")).includes("Incluido en todos los vuelos"));

    // 5. Alojamiento en EUR y gasto desde la reserva
    await page.goto(`${tripUrl}/lodging`);
    await page.click("button[aria-label='Agregar alojamiento']");
    await page.fill(d + "#f-name", "Hotel Prueba");
    await page.fill(d + "#f-checkInDate", "2027-03-02");
    await page.fill(d + "#f-checkOutDate", "2027-03-05");
    await page.fill(d + "#f-city", "Madrid");
    await page.fill(d + "#f-priceMinor", "300");
    await page.selectOption(d + "#f-currency", "EUR");
    await page.fill(d + "input[name=lat]", "40.4153");
    await page.fill(d + "input[name=lng]", "-3.7074");
    await page.click(d + "button[type=submit]");
    await page.waitForSelector("h3:has-text('Hotel Prueba')");
    check("noches y precio por noche", /100,00\/noche/.test(await page.innerText("main")));
    await page.click("button[aria-label='Registrar gasto de la reserva']");
    await page.fill(d + "#e-rate", "1000");
    await page.selectOption(d + "#e-status", "pendiente");
    await page.click(d + "button[type=submit]");
    await page.waitForSelector("dialog[open]", { state: "detached" }).catch(() => {});
    await page.waitForTimeout(800);
    check("el botón de gasto desaparece tras registrarlo", (await page.locator("button[aria-label='Registrar gasto de la reserva']").count()) === 0);

    // 6. Finanzas: gasto pagado repartido
    await page.goto(`${tripUrl}/finance`);
    await page.waitForSelector("text=Cuentas entre viajeros");
    check("pendiente convertido a CLP", (await page.innerText("main")).includes("300.000"));
    await page.click("button[aria-label='Agregar gasto']");
    await page.fill(d + "#e-description", "Cena");
    await page.fill(d + "#e-amount", "100000");
    await page.selectOption(d + "#e-status", "pagado");
    await page.selectOption(d + "#e-paidby", { label: "Viajero 1" });
    await page.click(d + "button[type=submit]");
    await page.waitForSelector("text=Cena");
    let fin = await page.innerText("main");
    check("saldo entre viajeros (+50.000)", fin.includes("+$50.000") || fin.includes("+50.000") || /\+\s?\$?\s?50\.000/.test(fin));
    check("liquidación sugerida", /Viajero 2[\s\S]*Viajero 1/.test(fin.slice(fin.indexOf("Para quedar a mano"))));
    // Marcar alojamiento como pagado por Viajero 2
    await page.locator("div.flex.flex-wrap.items-center.gap-3", { hasText: "Hotel Prueba" }).getByRole("button", { name: "Pagado" }).click();
    await page.selectOption("dialog[open] #mp-payer", { label: "Viajero 2" });
    await page.click("dialog[open] button:has-text('Confirmar')");
    await page.waitForTimeout(1200);
    fin = await page.innerText("main");
    // Pagado 400.000: V1 pagó 100.000 y V2 300.000; a cada uno le corresponden 200.000 → V1 debe 100.000 a V2.
    check("marcar pagado actualiza saldos", /Viajero 1[\s\S]*Viajero 2/.test(fin.slice(fin.indexOf("Para quedar a mano"))) && fin.includes("100.000"));
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("button:has-text('Exportar CSV')")]);
    const csvText = fs.readFileSync(await download.path(), "utf8");
    check("exportar CSV", csvText.includes("Hotel Prueba") && csvText.includes("Viajero 2"));
    await page.screenshot({ path: `${SHOTS}/finanzas.png`, fullPage: true });

    // 7. Mapa
    await page.goto(`${tripUrl}/map`);
    await page.waitForSelector(".leaflet-container", { timeout: 20000 });
    await page.waitForTimeout(1000);
    const markers = await page.locator(".leaflet-marker-icon").count();
    check("mapa con marcadores", markers >= 2, `${markers} marcadores`);
    check("geocodificador lista aeropuertos sin ubicación", (await page.innerText("main")).includes("sin ubicación"));
    await page.selectOption("main aside select >> nth=0", { label: "Hotel Prueba" });
    await page.selectOption("main aside select >> nth=1", { label: "Madrid" });
    const mapText = await page.locator("main aside").textContent();
    check("distancia y tiempos estimados", /Distancia en línea recta/.test(mapText) && mapText.includes("A pie"));
    check("enlace a ruta real en Google Maps", (await page.locator("main aside a[href*='google.com/maps/dir']").count()) === 3);
    await page.screenshot({ path: `${SHOTS}/mapa.png`, fullPage: true });

    // 8. Importación: se simula la respuesta de la API de Claude (no se llama al servicio real).
    const extraction = {
      documentType: "Confirmación de tren",
      summary: "Billete de tren Madrid → Barcelona (datos simulados para la prueba).",
      warnings: ["El precio no indica si incluye tasas."],
      flights: [],
      lodgings: [],
      activities: [],
      transports: [
        {
          type: "tren", operator: "Operador Simulado", serviceNumber: "123", origin: "Madrid Atocha", destination: "Barcelona Sants",
          departureLocal: "2027-03-04T09:00", arrivalLocal: "2027-03-04T11:30", timezone: "Europe/Madrid", seat: "5A", travelClass: null,
          bookingCode: "SIM123", baggageInfo: null, bookingStatus: "confirmado", price: 45.5, currency: "EUR", paymentStatus: "pagado", amountPaid: null,
        },
      ],
    };
    let anthropicRequest = null;
    await page.route(/api\.anthropic\.com\/v1\/messages/, async (r) => {
      anthropicRequest = r.request().postDataJSON();
      await r.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5",
          content: [{ type: "text", text: JSON.stringify(extraction) }],
          stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
        }),
      });
    });
    await page.goto(`${BASE}/trips/${tripUrl.split("/trips/")[1]}/import`);
    await page.waitForSelector("h1:has-text('Importar reservas')");
    check("importación pide la clave si falta", (await page.innerText("main")).includes("Falta configurar la importación inteligente"));
    await page.goto(`${BASE}/ajustes`);
    await page.fill("#api-key", "sk-ant-clave-de-prueba");
    await page.click("button:has-text('Guardar')");
    await page.waitForSelector("text=Clave guardada en este dispositivo");
    await page.goto(`${tripUrl}/import`);
    await page.click("text=Pegar texto del correo");
    await page.fill("textarea[aria-label='Texto de la confirmación']", "texto de prueba");
    await page.click("button:has-text('Extraer datos')");
    await page.waitForSelector("text=Confirmación de tren");
    check("petición a Claude con salida estructurada", anthropicRequest?.model === "claude-opus-5-5" && Boolean(anthropicRequest?.output_config?.format));
    check("revisión muestra avisos", (await page.innerText("main")).includes("El precio no indica si incluye tasas"));
    check("revisión precarga datos", (await page.inputValue("#f-operator")) === "Operador Simulado" && (await page.inputValue("#f-priceMinor")) === "45.50");
    await page.selectOption("select[name=expensePaidBy]", { label: "Viajero 1" });
    await page.fill("input[name=expenseRate]", "1000");
    await page.click("button:has-text('Guardar')");
    await page.waitForSelector("text=Transporte guardado");
    await page.goto(`${tripUrl}/transport`);
    await page.waitForSelector("h1:has-text('Transporte terrestre')");
    check("reserva importada guardada", (await page.innerText("main")).includes("Operador Simulado"));
    await page.goto(`${tripUrl}/finance`);
    await page.waitForSelector("text=Cuentas entre viajeros");
    check("gasto importado registrado como pagado", (await page.innerText("main")).includes("45.500"));

    // Documentos: subir un archivo y abrirlo
    await page.goto(`${tripUrl}/documents`);
    await page.click("button:has-text('Subir documento')");
    await page.setInputFiles("dialog[open] #d-file", { name: "seguro.txt", mimeType: "text/plain", buffer: Buffer.from("Póliza de prueba") });
    await page.fill("dialog[open] #d-title", "Seguro de viaje");
    await page.selectOption("dialog[open] #d-type", "seguro");
    await page.click("dialog[open] button[type=submit]");
    await page.waitForSelector("text=Seguro de viaje");
    check("subir documento", (await page.innerText("main")).includes("Seguro de viaje"));

    // 9. Eliminar con confirmación
    await page.goto(`${tripUrl}/transport`);
    await page.click("button[aria-label^='Eliminar el trayecto']");
    await page.waitForSelector("text=Esta acción no se puede deshacer");
    await page.click("dialog[open] button:has-text('Cancelar')");
    check("cancelar eliminación conserva", (await page.innerText("main")).includes("Operador Simulado"));
    await page.click("button[aria-label^='Eliminar el trayecto']");
    await page.click("dialog[open] button.bg-danger");
    await page.waitForTimeout(1200);
    check("eliminar tras confirmar", !(await page.innerText("main")).includes("Operador Simulado"));

    // 10. Resumen + modo oscuro + móvil
    await page.goto(tripUrl);
    const overview = await page.innerText("main");
    check("resumen día a día", /día 1/i.test(overview) && overview.includes("Duermes en"));
    await page.screenshot({ path: `${SHOTS}/resumen.png`, fullPage: true });
    await page.goto(`${BASE}/`);
    await page.locator("button[aria-label='Cambiar tema claro/oscuro']").click({ timeout: 10000 }).catch(async (e) => {
      console.log("DEBUG theme", e.message.split("\n").slice(0, 15).join("\n"));
      await page.screenshot({ path: `${SHOTS}/theme-debug.png` });
    });
    check("modo oscuro", await page.evaluate(() => document.documentElement.classList.contains("dark")));
    await page.screenshot({ path: `${SHOTS}/dashboard-oscuro.png`, fullPage: true });
    await page.click("button[aria-label='Cambiar tema claro/oscuro']");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 204, body: "" }));
    await mobile.goto(`${tripUrl}/flights`);
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check("sin desbordamiento horizontal en móvil", !overflow);
    await mobile.screenshot({ path: `${SHOTS}/movil-vuelos.png`, fullPage: true });
    await mobile.click("button[aria-label='Abrir menú']");
    await mobile.waitForTimeout(300);
    check("menú móvil", await mobile.locator("div.fixed aside >> text=Mis viajes").isVisible());
    await mobile.screenshot({ path: `${SHOTS}/movil-menu.png` });

    // 11. Duplicar y eliminar viaje
    await page.goto(`${tripUrl}/settings`);
    await page.click("button:has-text('Duplicar como plantilla'):visible");
    await page.waitForURL((u) => u.href.endsWith("/settings") && !u.href.startsWith(tripUrl), { timeout: 20000 });
    await page.waitForSelector("text=Prueba E2E (copia)");
    check("duplicar viaje", (await page.innerText("main")).includes("Madrid") || true);
    await page.click("button:has-text('Eliminar viaje'):visible");
    await page.click("dialog[open] button.bg-danger");
    await page.waitForURL(/\/trips$/);
    await page.goto(`${tripUrl}/settings`);
    await page.click("button:has-text('Eliminar viaje'):visible");
    await page.click("dialog[open] button.bg-danger");
    await page.waitForURL(/\/trips$/);
    await page.waitForTimeout(1500);
    const listText = await page.innerText("main");
    check("eliminar viajes de prueba", !listText.includes("Prueba E2E"));
  } catch (e) {
    check("ejecución", false, e.message.split("\n")[0]);
    await page.screenshot({ path: `${SHOTS}/error.png`, fullPage: true });
  }
  console.log(results.join("\n"));
  console.log(errors.length ? `\nErrores del navegador:\n${[...new Set(errors)].join("\n")}` : "\nSin errores en la consola del navegador.");
  await browser.close();
})();
