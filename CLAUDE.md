# CLAUDE.md — Travel Manager

Documento central de instrucciones del proyecto. Léelo completo antes de cualquier tarea y mantenlo actualizado al cerrar cada fase o al tomar una decisión técnica relevante.

**Después de este archivo, lee `memory.md`**: contiene el estado actual, las preferencias del usuario, las preguntas abiertas, los próximos pasos y la bitácora de sesiones. Actualízalo al terminar cada sesión.

---

## 1. Qué es este proyecto

Aplicación web personal para **gestionar, organizar y planificar viajes** de principio a fin. Centraliza en un único lugar, por cada viaje: destinos, vuelos, equipaje, alojamientos, transporte terrestre, actividades, restaurantes, documentos, checklist, presupuesto y gastos. Gestiona múltiples viajes (futuros, en curso y pasados) con información independiente.

No es una lista de tareas ni un calendario básico: es un Travel Manager integral.

Al abrir un viaje, el usuario debe ver rápidamente:

1. Dónde estará cada día.
2. Cómo llegará al siguiente destino.
3. Dónde se alojará.
4. Qué actividades realizará.
5. Qué restaurantes quiere visitar.
6. Cuánto equipaje puede llevar en cada vuelo.
7. Qué reservas están confirmadas.
8. Qué gastos ha realizado.
9. Cuánto dinero falta por pagar.
10. Qué tareas tiene pendientes.

**Prioridad absoluta:** funcionalidad real, excelente UX, información centralizada, facilidad de uso.

Idioma de la interfaz: **español**. Monedas principales: **CLP, EUR, USD**.

---

## 2. Reglas permanentes (obligatorias)

1. **Inspeccionar antes de modificar.** Leer los archivos relevantes y entender la arquitectura existente antes de tocar código.
2. **No eliminar funcionalidades existentes** sin autorización explícita del usuario. No reemplazar componentes funcionales sin justificación documentada.
3. **No duplicar componentes.** Buscar primero si ya existe uno reutilizable.
4. **Consistencia visual.** Usar los componentes y tokens de diseño del proyecto; no introducir estilos ad hoc.
5. **Código limpio, modular y mantenible.** Tipado estricto, funciones pequeñas, lógica de negocio fuera de los componentes de UI.
6. **Documentar decisiones técnicas importantes** en la sección 10 de este archivo (registro de decisiones).
7. **Nunca inventar datos** de vuelos, precios, horarios, políticas de equipaje ni reservas. Los datos de ejemplo/seed deben ser claramente ficticios y marcados como tales.
8. **Separar datos estimados de datos confirmados.** Toda reserva, precio o gasto tiene un estado explícito; nunca asumir "confirmado" o "pagado" si el usuario no lo indicó.
9. **Priorizar la experiencia del usuario** sobre elementos decorativos.
10. **Sin funcionalidades ficticias.** Ningún botón, enlace o menú sin acción real. Si algo aún no existe, no se muestra.
11. **Servicios externos:** si una funcionalidad requiere una API o servicio externo, identificarlo, verificar sus capacidades y condiciones reales y avisar al usuario **antes** de implementarla. No asumir que una plataforma tiene API pública o permite modificar reservas.
12. **Una funcionalidad no está terminada hasta comprobar que funciona** (tests + verificación manual en la app). Reportar fallos tal como son.
13. **Mantener esta documentación actualizada** (estado de fases, decisiones, comandos) y registrar el avance de cada sesión en `memory.md`.
14. **Desarrollo incremental.** No construir toda la aplicación de una vez; trabajar por fases (sección 8).

---

## 3. Principios de diseño UX/UI

- Moderno, profesional, minimalista y elegante. Evitar interfaces sobrecargadas.
- Lo más importante, a pocos clics: el viaje activo/próximo debe ser accesible desde cualquier pantalla.
- Responsive real: escritorio, tablet y smartphone (mobile-first en vistas de consulta durante el viaje).
- Modo claro y oscuro.
- Sidebar de navegación (colapsable en móvil), búsqueda global, filtros por ciudad, fecha, categoría y estado.
- Formularios cortos y sencillos: campos obligatorios mínimos, el resto opcional y agrupado.
- Editar, agregar y eliminar debe ser fácil. **Confirmación obligatoria antes de eliminar.**
- Estados vacíos útiles (explican qué hacer y ofrecen la acción para empezar).
- Indicadores visuales consistentes para estados: confirmado / pendiente / estimado / cancelado; pagado / pendiente / parcial.

---

## 4. Arquitectura y stack

App **estática** publicada en GitHub Pages (`https://diego94diaz-oss.github.io/Travel-manager/`), con los datos en el **proyecto Supabase compartido** con Mi Día, Finanzas y Kratos. Mismo patrón que el resto del ecosistema del usuario: login con correo y contraseña de Supabase, Row Level Security `user_id = auth.uid()`, sin servidor propio.

| Capa | Tecnología | Notas |
|---|---|---|
| Build | **Vite + React 19 + TypeScript** | `base: "./"` (rutas relativas). Se publica con GitHub Actions (`.github/workflows/deploy.yml`), que copia `dist/` a la rama `gh-pages`. |
| Rutas | react-router con **HashRouter** (`/#/trips/…`) | GitHub Pages no reescribe rutas: con hash, recargar cualquier página funciona. |
| UI | **Tailwind CSS 4** + componentes propios (`src/components/ui.tsx`) | Tokens semánticos (`bg-surface`, `text-muted`, `text-accent`…) en `src/index.css`, con variante `.dark`. |
| Datos | **supabase-js** contra tablas `tm_*` | `src/lib/db.ts` convierte camelCase ↔ snake_case. Lecturas en `src/lib/data.ts`; mutaciones en `src/lib/api.ts`. |
| Sesión | Supabase Auth (correo + contraseña) | Todas las apps viven en `diego94diaz-oss.github.io`: comparten origen, así que la sesión de Mi Día sirve aquí. |
| Archivos | Supabase Storage, bucket privado `tm-documentos` | Ruta `<user_id>/<trip_id>/<uuid>-<nombre>`; enlaces firmados de 10 min para abrirlos. |
| Mapas | Leaflet + react-leaflet + teselas OSM | Geocodificación con Nominatim desde el navegador. |
| Importación | **API de Claude** desde el navegador (`@anthropic-ai/sdk`, `dangerouslyAllowBrowser`) | Clave del usuario guardada solo en `localStorage` del dispositivo (ver §9 bis). El SDK se carga bajo demanda. |
| Validación | Formularios declarativos (`src/lib/entities.ts`) + `parseEntityForm` (Zod para formatos) | La misma definición pinta el formulario y valida antes de escribir. |
| Tests | Vitest (`src/**/*.test.ts`) + E2E Playwright (`tests/e2e/smoke.mjs`) contra PostgreSQL real | `tests/e2e/fake-supabase.mjs` imita PostgREST/Storage aplicando RLS de verdad. |

### Flujo de datos

```
Páginas (src/pages/**) ──lectura──▶ hooks (src/lib/hooks.ts) ──▶ data.ts ──▶ supabase-js ──▶ tablas tm_* (RLS)
        └──mutación──▶ api.ts / storage.ts / import/confirm.ts ──▶ notifyDataChanged() ──▶ los hooks vuelven a leer
Lógica pura y testeada: src/lib/domain/*  (dinero, fechas, finanzas, alertas, itinerario, geo, conexiones)
```

- `pages/trip/layout.tsx` carga el viaje completo una vez y lo pasa a cada sección con `useTrip()` (Outlet context).
- Toda mutación termina en `notifyDataChanged()`; no hay caché que invalidar a mano.
- Los formularios usan `useActionState` con funciones `(prev, FormData) => FormState`, enviadas con `onSubmit` + `startTransition` para que React no los vacíe al haber errores.

### Estructura

```
├── supabase/schema.sql          # tablas tm_*, RLS, bucket y políticas (ejecutar en Supabase)
├── .github/workflows/deploy.yml # publicación en GitHub Pages
├── tests/db/                    # stubs de Supabase y prueba de RLS para PostgreSQL local
├── tests/e2e/                   # fake-supabase.mjs + smoke.mjs
└── src/
    ├── App.tsx · main.tsx · auth.tsx
    ├── pages/                   # dashboard, trips, new-trip, app-settings, trip/* (una por sección)
    ├── components/              # ui, record-form/dialog, expense-form, modal, map/, import/
    └── lib/
        ├── supabase.ts · db.ts · data.ts · hooks.ts · api.ts · storage.ts · export-csv.ts
        ├── domain/  money · dates · finance · alerts · itinerary · segments · geo · map-points (+ __tests__)
        ├── import/  schema.ts (Zod) · extract.ts (Claude) · confirm.ts · api-key.ts
        └── types.ts · entities.ts · forms.ts · labels.ts · trip-helpers.ts
```

---

## 5. Modelo de datos

**Fuente de verdad: `supabase/schema.sql`** (columnas snake_case) y `src/lib/types.ts` (camelCase). Todas las tablas llevan `user_id` (por defecto `auth.uid()`), y salvo `tm_trips` y `tm_exchange_rates`, también `trip_id` con borrado en cascada. Las políticas exigen además que la fila cuelgue de un viaje del propio usuario.

Tablas: `tm_trips`, `tm_travelers`, `tm_destinations`, `tm_flights`, `tm_baggage_allowances` (por vuelo), `tm_lodgings`, `tm_transports`, `tm_activities`, `tm_restaurants`, `tm_documents`, `tm_expenses` (con el reparto en la columna jsonb `shares`: `[{travelerId, shareBaseMinor}]`), `tm_exchange_rates` (por usuario).

Cambios de esquema: añadir SQL idempotente al final de `supabase/schema.sql` (`alter table … add column if not exists …`), actualizar `types.ts`, y pedir al usuario que lo ejecute en Supabase. Probarlo antes en el PostgreSQL local (`tests/db`).

### Reglas del modelo

- **Dinero:** guardar importes como enteros en unidad mínima (`amountMinor`) + código de moneda ISO 4217. CLP tiene 0 decimales; EUR y USD tienen 2. Nunca usar `float` para dinero.
- **Tipo de cambio congelado:** cada `Expense` guarda el `exchangeRate` y `amountBaseMinor` usados al registrarlo. Actualizar las tasas **no** modifica gastos existentes; solo se recalcula si el usuario lo pide expresamente en ese gasto.
- **Fechas y horas:** vuelos y transportes guardan hora local + zona horaria IANA de origen y destino; la duración se calcula en UTC.
- **Estados explícitos:** `bookingStatus` ∈ {idea, estimado, reservado, confirmado, cancelado}; estado del gasto ∈ {pagado, parcial, pendiente, previsto}. Valor por defecto: el **menos comprometido** (idea / previsto).
  - *pendiente* = comprometido (reservado) pero sin pagar · *previsto* = gasto futuro estimado, aún no comprometido.
  - Los saldos entre viajeros solo cuentan lo **ya pagado**; «su parte del total» incluye pendientes y previstos.
- **Datos sensibles:** PNR, códigos de reserva, info de acceso y documentos se muestran enmascarados por defecto con opción de revelar. No se exponen en URLs ni en logs. **Nunca** almacenar contraseñas ni datos de tarjetas (solo "método de pago" descriptivo, p. ej. "Visa terminada en 1234" si el usuario lo escribe).

---

## 6. Módulos (resumen funcional)

- **Dashboard:** próximo viaje + cuenta regresiva, viajes futuros / en curso / historial, destinos visitados, presupuesto total, gastos acumulados, próximas actividades y reservas, alertas (vuelos, check-in/out), tareas y documentos pendientes. Tarjeta por viaje: nombre, imagen, países/ciudades, fechas, días, viajeros, presupuesto, estado.
- **Viajes y destinos:** CRUD, duplicar como plantilla (sin fechas ni reservas confirmadas), múltiples destinos ordenables con fechas de llegada/salida.
- **Vuelos:** ida, vuelta y conexiones múltiples agrupadas por trayecto (`journeyId`). Duración y escalas calculadas.
- **Equipaje:** políticas por vuelo y categoría; checklist de maleta con estados; **verificación de cumplimiento** del equipaje contra todos los vuelos del itinerario (usa la política más restrictiva).
- **Alojamientos:** cualquier tipo; orden cronológico; asociación automática a destino por ciudad y fechas; noches calculadas; adjuntos.
- **Transporte terrestre:** todos los tipos; conexiones y tiempos de traslado; "cómo llegar" desde aeropuertos/estaciones al alojamiento.
- **Itinerario y actividades:** vistas mes / semana / día / lista; reordenar (drag & drop); detección de solapamientos; alertas de reservas previas.
- **Restaurantes:** listas por visitar / recomendados / reservados / visitados; filtros por ciudad y cocina.
- **Presupuesto y gastos:** estimado vs. real, pagado vs. pendiente, por categoría / ciudad / persona, distribución porcentual, multimoneda (CLP, EUR, USD), exportación CSV/Excel.
- **Documentos:** biblioteca por viaje, PDF e imágenes, asociables a vuelo / alojamiento / actividad / transporte / gasto.
- **Mapa interactivo:** destinos, alojamientos, aeropuertos, estaciones, actividades y restaurantes; capas, centrar por ciudad, distancia y tiempos estimados entre dos puntos, lugares cercanos, distancias desde cada alojamiento, ubicación de lugares sin coordenadas con revisión.
- **Importación inteligente:** PDF, imagen o texto → extracción con Claude → revisión y corrección por elemento → guardado de reserva, equipaje, documento y gasto opcional.
- **Checklist / tareas:** listas configurables por viaje con fecha límite, prioridad y estado; plantilla de tareas sugeridas.

### Automatizaciones (lógica en `lib/domain/`, con tests)

Duración del viaje · noches de alojamiento · días entre destinos · totales de costos · conversión de monedas · actividades superpuestas · conexiones demasiado ajustadas (umbral configurable; p. ej. < 60 min vuelo-vuelo, más si cambia de aeropuerto/terminal) · reservas pendientes · alertas de check-in/check-out · apertura de check-in de vuelo (antelación configurable por aerolínea; **sin inventar valores**: si no se conoce, se pide al usuario) · hora recomendada de llegada al aeropuerto (configurable) · vuelos sin información de equipaje · actividades cercanas (si hay coordenadas) · relación automática vuelos ↔ destinos ↔ alojamientos por ciudad y fecha (como **sugerencia** que el usuario acepta, no como dato confirmado).

---

## 7. Servicios externos

| Servicio | Uso | Condiciones |
|---|---|---|
| **Supabase** (proyecto compartido) | Datos, sesión y archivos. | La clave publicable es pública por diseño; la seguridad la dan RLS y las políticas de Storage. |
| **API de Claude (Anthropic)** | Extraer datos de PDFs, capturas y textos (`src/lib/import/extract.ts`). | Clave del usuario; costo por uso; el documento sale del navegador hacia Anthropic. `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Nada se guarda sin revisión. |
| **OpenStreetMap / Nominatim** | Teselas del mapa y búsqueda de coordenadas. | Atribución; Nominatim solo bajo acción del usuario, 1 petición cada 1,1 s, sin autocompletado. |
| **Google Maps URLs** | Botones «ver ruta real». | Enlaces públicos sin API key. Los tiempos de la app son estimaciones y así se indican. |

Futuras: Google Calendar, vuelos (Google Flights **no** tiene API pública), trenes, tipos de cambio automáticos, meteorología, Places, importación desde correo. Mover la llamada a Claude a una Supabase Edge Function (clave en el servidor) si se quiere evitar tener la clave en el navegador. Antes de implementar cualquiera: verificar documentación oficial, términos, costo y límites, e informar al usuario.

## 8. Plan de desarrollo por fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Arquitectura, modelo de datos, documentación | ✅ |
| 1 | Base: navegación, tema claro/oscuro, dashboard, viajes, viajeros, destinos, persistencia en Supabase | ✅ |
| 2 | Vuelos (zonas horarias, conexiones), equipaje por vuelo + resumen, alojamientos, transporte | ✅ — falta checklist de maleta |
| 3 | Actividades, restaurantes, resumen día a día | ✅ parcial — faltan calendario mensual/semanal y arrastrar para reordenar |
| 4 | Finanzas: pagado/pendiente/previsto, reparto, saldos, multimoneda, CSV | ✅ |
| 5 | Mapa ✅ · Importación ✅ · Documentos ✅ · Alertas ✅ · Exportar/importar JSON ✅ · Pendiente: checklist/tareas, PDF del itinerario, búsqueda global, acceso desde Mi Día | 🟡 |

### Al terminar cada fase (Definition of Done)

1. Verificar que todas las funcionalidades de la fase funcionan en la app real (no solo en tests).
2. Ejecutar lint, typecheck, tests unitarios y E2E.
3. Corregir errores.
4. Comprobar que no se dañaron módulos de fases anteriores (regresión).
5. Actualizar la tabla de estado, el registro de decisiones y los comandos de este archivo.

### Riesgos y dependencias identificados

- **Zonas horarias** en vuelos/transportes: fuente frecuente de errores → centralizado en `lib/domain/dates.ts` y `segments.ts`, con tests.
- **Precisión monetaria** y monedas sin decimales (CLP) → enteros en unidad mínima.
- **Tipos de cambio:** sin proveedor externo al inicio; entrada manual con historial.
- **Adjuntos:** cuota de Supabase Storage (plan gratuito) → límite de 20 MB por archivo y tipos MIME permitidos.
- **Pérdida de datos:** exportar/importar JSON desde Ajustes (`src/lib/import-json.ts`; los documentos se importan si traen `fileBase64`) + copias de Supabase; confirmación antes de eliminar.
- **Proyecto Supabase compartido:** un error de esquema podría afectar a otras apps → prefijo `tm_`, SQL idempotente y probado en local antes de pedir que se ejecute.
- **APIs de terceros:** muchas no son públicas o tienen costo → núcleo 100 % funcional sin ellas.

---

## 9. Comandos

```bash
npm install
npm run dev            # http://localhost:5173/ (usa el Supabase real: requiere iniciar sesión)
npm run lint
npm run typecheck
npm test               # Vitest
npm run build          # dist/ (lo hace GitHub Actions al publicar)
# E2E local (ver cabecera de tests/e2e/smoke.mjs):
npm run test:db        # servidor de pruebas sobre PostgreSQL local
npm run build:test && npm run preview:test
npm run test:e2e
```

## 9 bis. Seguridad

- Datos protegidos por **RLS** en todas las tablas `tm_*` y por políticas de Storage por carpeta de usuario. Probado en `tests/db/rls-test.sql`.
- La **clave de Anthropic** vive solo en `localStorage` del dispositivo del usuario. Como todas las apps comparten el origen `diego94diaz-oss.github.io`, cualquier app de ese origen podría leerla: aceptable porque son todas del usuario; si eso cambia, mover la llamada a una Edge Function.
- Códigos de reserva e información de acceso se muestran enmascarados (`components/sensitive.tsx`). Nunca se guardan contraseñas ni números de tarjeta.
- Archivos: tipos MIME permitidos, 20 MB máximo, bucket privado y enlaces firmados temporales.
- Eliminar siempre pide confirmación (`components/delete-button.tsx`).

## 10. Registro de decisiones técnicas

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-30 | Primera versión en Next.js + SQLite local | Propuesta inicial. Sustituida el mismo día (ver siguiente fila). |
| 2026-10-30 | **Versión estática en GitHub Pages + Supabase compartido** | El usuario eligió tener un enlace propio como sus otras apps (opción 1). La versión Next.js no se podía publicar en Pages. |
| 2026-10-30 | Vite + React en lugar de HTML/JS sin build | Reutiliza la lógica ya probada (dominio, formularios, componentes); el build lo hace GitHub Actions. |
| 2026-10-30 | Tablas con prefijo `tm_` y RLS `user_id = auth.uid()` + viaje propio | Convivir con `fin_*` y Kratos en el mismo proyecto sin riesgo de mezcla. |
| 2026-10-30 | Reparto de gastos en jsonb dentro del gasto | Escritura atómica sin transacciones desde el cliente. |
| 2026-10-30 | HashRouter | GitHub Pages no reescribe rutas a index.html. |
| 2026-10-30 | Importación llamando a Claude desde el navegador con la clave del usuario | Sin servidor propio; la alternativa segura (Edge Function) requiere desplegar con la CLI de Supabase. |
| 2026-10-30 | Dinero en enteros + ISO 4217; tipo de cambio congelado por gasto | Sin errores de redondeo ni cambios retroactivos. |
| 2026-10-30 | Cuatro estados de gasto: pagado, parcial, pendiente, previsto | Requisito del usuario. |
| 2026-10-30 | Mapa Leaflet + OSM; tiempos estimados + enlaces a Google Maps | Sin claves ni costos; no se presentan estimaciones como rutas reales. |
