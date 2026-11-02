# memory.md — Memoria del proyecto Travel Manager

Memoria de trabajo entre sesiones. `CLAUDE.md` = reglas, arquitectura y plan (cambia poco). Este archivo = estado, preferencias, preguntas abiertas, próximos pasos y bitácora (cambia en cada sesión).

1. Al iniciar: leer `CLAUDE.md` y luego *Estado actual* y *Próximos pasos*.
2. Durante la sesión: anotar preferencias o decisiones nuevas del usuario.
3. Al cerrar: actualizar estado, próximos pasos y añadir entrada en la bitácora (la más reciente arriba).
4. Solo hechos comprobados o dichos por el usuario; marcar suposiciones. Nunca datos sensibles.

---

## Estado actual

- **2026-10-30 (sesión 4):** completadas todas las funciones del plan e instalación como app. La carpeta local ya es el repositorio git (`origin` = `Travel-manager`, rama `main`; en sesiones anteriores no lo era). Verificado: 40 tests unitarios, E2E 34/34 + 29/29 contra PostgreSQL real, migración desde el esquema antiguo conservando datos, RLS de la tabla nueva.

- **Publicada:** https://mis-viajes.github.io/ (repo `mis-viajes/mis-viajes.github.io`, con T mayúscula). Cada push a `main` la compila y la copia a la rama `gh-pages` (workflow verificado: éxito).
- Comprobado en producción: la página carga sin errores de JavaScript y muestra el inicio de sesión de Supabase.
- El usuario ya ejecutó el esquema inicial y tiene su viaje cargado en la app (dicho por el usuario). Los cambios de esquema se ejecutan en el SQL Editor con la sesión del usuario en Chrome (el sistema de permisos bloquea leer el token de `Inversiones/data/`). Supabase avisa de operación destructiva si el SQL contiene `drop`.
- **Verificado en local:** lint, typecheck, 23 tests unitarios, build; esquema SQL idempotente y RLS probados en PostgreSQL 16; E2E 34/34 contra ese PostgreSQL vía `tests/e2e/fake-supabase.mjs`; carga desde subcarpeta `/Travel-manager/`.
- **Sin verificar aún con datos reales:** login real, Supabase Storage real, llamada real a Claude (simulada en la E2E).
- GitHub Pages se activó con la rama `gh-pages` porque el entorno de Claude no puede cambiar los ajustes de Pages por API.

- **Importar viajes desde JSON** (Ajustes) añadido y probado en local: el viaje «Europa 2026» preparado a partir de 4 PDFs del usuario se importa con 7 vuelos, 3 gastos y 4 documentos sin errores. El archivo se entregó al usuario (no está en el repo: contiene datos personales).

- **Rediseño visual (2026-10-30):** fotos de ciudades, portada grande con cuenta atrás, tarjetas de destino, mapa de ruta y línea de tiempo en el resumen, tarjetas de embarque, gráficos de gastos, botones para eliminar viajes desde la lista y la portada. E2E 34/34.
- Las fotos de Wikimedia a veces fallan desde el entorno de Claude (error 429 por límite de peticiones del proxy compartido); en el navegador del usuario deberían cargar. Si fallan, se muestra un degradado.

- **Viaje Europa 2026 completo** preparado como archivo JSON (fuera del repo, contiene datos personales): 7 vuelos (LATAM con horarios corregidos según capturas de la app de LATAM: LA6, LA708, LA705, LA9), 7 alojamientos, 8 trenes por comprar, 4 actividades, 13 gastos (pagado $4.242.628, pendiente $675.441) y 10 documentos. Probado en local: pagos por persona iguales al itinerario del usuario.
- Los trayectos con solo fecha (sin hora) ya no generan alertas de conexión (`segments.ts`).

## Próximos pasos

1. Hecho (2026-10-30): `tm_checklist_items` y `tm_activities.position` creadas en Supabase desde el SQL Editor; RLS activo y conteos de datos sin cambios.
2. Probar en el dispositivo real: instalar en PC y Pixel, y abrir sin internet con la cuenta real.
3. Comprobar con datos reales lo que solo se probó en local: Supabase Storage y la llamada a Claude (requiere clave de Anthropic).
4. Valorar mover la llamada a Claude a una Supabase Edge Function.

---

## Preferencias del usuario

- Español; monedas CLP, EUR y USD (CLP por defecto en viajes nuevos, editable).
- Funcionalidad real, sin botones decorativos; diseño minimalista y profesional; desarrollo por fases con verificación.
- El equipaje por aerolínea es especialmente importante.
- Cada viaje independiente, con una base de datos central para verlos todos en el dashboard.
- Prioridades: mapa con distancias/tiempos, importación inteligente con revisión, control financiero con reparto entre viajeros.
- Quiere **un enlace propio** como el resto de sus apps (eligió GitHub Pages + Supabase compartido).

## Contexto conocido

- Ecosistema del usuario (del repo `diego94diaz-oss/mi-dia`): Mi Día (`/mi-dia/`), Finanzas (`/finanzas-personales/`), Kratos (`/kratos-gym/`) en GitHub Pages; Inversiones en `mis-inversiones.github.io`; Salud en Cloudflare Workers. Un solo proyecto Supabase (`ivzzgeoeygggaoazcoeq`) con login por correo y RLS `auth.uid() = user_id`.
- Uso personal. Viajes concretos, aerolíneas habituales y número de viajeros: desconocidos.

## Preguntas abiertas

| # | Pregunta | Estado |
|---|---|---|
| 1 | Repositorio | Resuelta: el usuario creó `Travel-manager`; Claude tiene permiso de escritura en esta sesión. |
| 2 | ¿Añadir Travel Manager a Mi Día? | Resuelta: acceso en «Mis apps» y tarjeta con el próximo viaje. |
| 3 | ¿Clave de API de Anthropic para la importación? | Abierta |
| 4 | ¿Hay viajes reales para cargar? | Abierta |

---

## Aprendizajes y problemas conocidos

- Las tablas viven en un Supabase compartido con otras apps: todo cambio de esquema debe ser idempotente, con prefijo `tm_`, y probarse en el PostgreSQL local (`tests/db`) antes de pedir al usuario que lo ejecute.
- `tests/e2e/fake-supabase.mjs` no verifica tokens y su Storage es en memoria: sirve para probar la app y el esquema, no sustituye una prueba con el Supabase real.
- En la E2E, las páginas se cargan bajo demanda: esperar a un encabezado antes de leer el texto.
- La E2E sin PostgreSQL instalado: `embedded-postgres` con `--encoding=UTF8 --locale=C` en una carpeta temporal; Playwright por `NODE_PATH`; `.env.test.local` (ignorado por git) con `VITE_TEST_ACCESS_TOKEN`; `BASE_URL=http://localhost:4173/`.
- Chromium sin interfaz descarga los PDF en vez de abrirlos: en la E2E se mira la petición, no la URL de la pestaña.
- El entorno en la nube de Claude no podía descargar binarios externos (p. ej. PostgREST) ni crear repos/pedir escritura en GitHub sin autorización explícita del usuario.

---

## Bitácora de sesiones

### 2026-11-01 — Trenes Italo
- Cargados 5 trayectos confirmados (4 billetes, EUR 169,64, pagó Diego). Gastos a 1 EUR = 1103,36 CLP, tipo guardado en la app y no el cobro real: pendiente el monto en CLP si el usuario lo entrega. PDFs subidos a Documentos y copiados en `documentos/europa-2026/`, carpeta local excluida de git porque el repositorio es público. Excursión a Verona movida al 24-11 según el billete.

### 2026-10-31 — Cuenta correcta y pendientes de transporte
- La cuenta de Catalina se cambió por `catta.sepz@gmail.com`; vínculo activo. Tarjetas del resumen clicables. Agregados 4 trayectos por definir (París ↔ Disneyland, París ↔ Versalles) y 12 tareas «Comprar billete…» en Checklist, grupo Transporte.

### 2026-10-31 — Cuentas vinculadas
- Pedido del usuario: Catalina debe ver y editar todos los viajes, también los futuros. Implementado con `tm_sharing`. El usuario creó la cuenta de Catalina y el vínculo quedó activo en ambos sentidos (2026-10-31); simulando su sesión en la base de datos ve el viaje completo, documentos y archivos.

### 2026-10-30 (6) — Pagos entre viajeros
- Nueva tabla `tm_repayments`: lo que un viajero le devuelve a otro ajusta el saldo sin cambiar el total. Catalina pagó $803.803 a Diego (registrado el 2026-10-31); tabla creada en Supabase.

### 2026-10-30 (5) — Nueva dirección
- Mudada a https://mis-viajes.github.io/ (organización `mis-viajes`, remoto `origin`). El repo anterior queda como remoto `antiguo`: su `gh-pages` redirige y su service worker se elimina solo; no publicar más allí.
- Decidido por el usuario: Disneyland queda en $238.673 y la dirección del Hotel Alcyone es Calle dei Fabbri 471 (el punto del mapa usa la ubicación del hotel en OpenStreetMap, que lo registra como 4712).

### 2026-10-30 (4) — Funciones pendientes e instalación
- Carpeta conectada al repo. Checklist de tareas y maleta con comprobación de peso, calendario mes/semana/día con arrastrar, orden manual de actividades, PDF del itinerario, búsqueda global, filtros de restaurantes, tarjeta en Mi Día.
- App instalable (PC y celular) y consulta sin conexión, incluidos documentos guardados a mano y sesión con token vencido.
- Corregido bug: «Abrir» en Documentos apuntaba a `/api/…`, ruta de la antigua versión Next.js que no existe en GitHub Pages.

### 2026-10-30 (3) — Versión publicable
- El usuario pidió un enlace propio (opción 1: GitHub Pages + Supabase). Se rehízo la app como SPA estática reutilizando la lógica de dominio, formularios y componentes de la versión Next.js.
- `supabase/schema.sql` con 12 tablas `tm_*`, RLS y bucket `tm-documentos`; validado en PostgreSQL local.
- Importación con Claude desde el navegador (clave en el dispositivo, SDK cargado bajo demanda); documentos en Supabase Storage; exportación CSV y JSON en el navegador.
- Workflow de GitHub Actions para publicar en Pages.

### 2026-10-30 (2) — Primera versión (Next.js + SQLite local)
- Todos los módulos y las tres funcionalidades prioritarias; 31/31 E2E. Quedó como referencia en el directorio raíz de la sesión y en el zip enviado al usuario; no publicable en GitHub Pages.

### 2026-10-30 (1) — Definición
- Prompt maestro recibido; creados `CLAUDE.md` y `memory.md`.
