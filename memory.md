# memory.md — Memoria del proyecto Travel Manager

Memoria de trabajo entre sesiones. `CLAUDE.md` = reglas, arquitectura y plan (cambia poco). Este archivo = estado, preferencias, preguntas abiertas, próximos pasos y bitácora (cambia en cada sesión).

1. Al iniciar: leer `CLAUDE.md` y luego *Estado actual* y *Próximos pasos*.
2. Durante la sesión: anotar preferencias o decisiones nuevas del usuario.
3. Al cerrar: actualizar estado, próximos pasos y añadir entrada en la bitácora (la más reciente arriba).
4. Solo hechos comprobados o dichos por el usuario; marcar suposiciones. Nunca datos sensibles.

---

## Estado actual

- **Versión estática** (Vite + React + Supabase) lista para publicarse en `https://diego94diaz-oss.github.io/Travel-manager/`.
- **Verificado en local (2026-10-30):** lint, typecheck, 23 pruebas unitarias, build de producción; `supabase/schema.sql` ejecutado dos veces sin errores en PostgreSQL 16 con stubs de Supabase; prueba de aislamiento RLS entre dos usuarios (`tests/db/rls-test.sql`); E2E con Playwright 34/34 contra ese PostgreSQL a través de `tests/e2e/fake-supabase.mjs`.
- **No verificado todavía:** el proyecto Supabase real (falta ejecutar el SQL), el inicio de sesión real, Supabase Storage real (en la E2E es una imitación en memoria), la llamada real a Claude (simulada en la E2E) y las teselas/Nominatim (sin salida a esos servicios desde el entorno de pruebas).
- **Pendiente para que el enlace funcione:**
  1. Crear el repositorio `diego94diaz-oss/Travel-manager` y subir el código (el entorno de Claude no tenía permiso de escritura en GitHub).
  2. Activar GitHub Pages con *Source: GitHub Actions*.
  3. Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase.

## Próximos pasos

1. Completar los tres pasos de publicación y probar la app con la cuenta real.
2. Añadir Travel Manager a la barra «Mis apps» de Mi Día (`js/config.js` → `APPS` y `LINKS`) y, opcionalmente, una tarjeta con el próximo viaje.
3. Checklist de maleta y tareas por viaje.
4. Calendario mensual/semanal; exportar itinerario a PDF; importar desde JSON; búsqueda global.
5. Valorar mover la llamada a Claude a una Supabase Edge Function.

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
| 1 | ¿Quién crea el repo `travel-manager` y da permiso de escritura a Claude? | Abierta |
| 2 | ¿Añadir Travel Manager a Mi Día? | Abierta (propuesto) |
| 3 | ¿Clave de API de Anthropic para la importación? | Abierta |
| 4 | ¿Hay viajes reales para cargar? | Abierta |

---

## Aprendizajes y problemas conocidos

- Las tablas viven en un Supabase compartido con otras apps: todo cambio de esquema debe ser idempotente, con prefijo `tm_`, y probarse en el PostgreSQL local (`tests/db`) antes de pedir al usuario que lo ejecute.
- `tests/e2e/fake-supabase.mjs` no verifica tokens y su Storage es en memoria: sirve para probar la app y el esquema, no sustituye una prueba con el Supabase real.
- En la E2E, las páginas se cargan bajo demanda: esperar a un encabezado antes de leer el texto.
- El entorno de Claude no puede descargar binarios externos (p. ej. PostgREST) ni crear repos/pedir escritura en GitHub sin autorización explícita del usuario.

---

## Bitácora de sesiones

### 2026-10-30 (3) — Versión publicable
- El usuario pidió un enlace propio (opción 1: GitHub Pages + Supabase). Se rehízo la app como SPA estática reutilizando la lógica de dominio, formularios y componentes de la versión Next.js.
- `supabase/schema.sql` con 12 tablas `tm_*`, RLS y bucket `tm-documentos`; validado en PostgreSQL local.
- Importación con Claude desde el navegador (clave en el dispositivo, SDK cargado bajo demanda); documentos en Supabase Storage; exportación CSV y JSON en el navegador.
- Workflow de GitHub Actions para publicar en Pages.

### 2026-10-30 (2) — Primera versión (Next.js + SQLite local)
- Todos los módulos y las tres funcionalidades prioritarias; 31/31 E2E. Quedó como referencia en el directorio raíz de la sesión y en el zip enviado al usuario; no publicable en GitHub Pages.

### 2026-10-30 (1) — Definición
- Prompt maestro recibido; creados `CLAUDE.md` y `memory.md`.
