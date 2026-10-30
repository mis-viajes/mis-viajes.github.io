# memory.md — Memoria del proyecto Travel Manager

Memoria de trabajo entre sesiones. `CLAUDE.md` = reglas, arquitectura y plan (cambia poco). Este archivo = estado, preferencias, preguntas abiertas, próximos pasos y bitácora (cambia en cada sesión).

1. Al iniciar: leer `CLAUDE.md` y luego *Estado actual* y *Próximos pasos*.
2. Durante la sesión: anotar preferencias o decisiones nuevas del usuario.
3. Al cerrar: actualizar estado, próximos pasos y añadir entrada en la bitácora (la más reciente arriba).
4. Solo hechos comprobados o dichos por el usuario; marcar suposiciones. Nunca datos sensibles.

---

## Estado actual

- **Publicada:** https://diego94diaz-oss.github.io/Travel-manager/ (repo `diego94diaz-oss/Travel-manager`, con T mayúscula). Cada push a `main` la compila y la copia a la rama `gh-pages` (workflow verificado: éxito).
- Comprobado en producción: la página carga sin errores de JavaScript y muestra el inicio de sesión de Supabase.
- **Falta (solo lo puede hacer el usuario):** ejecutar `supabase/schema.sql` en el SQL Editor de Supabase. Hasta entonces la API responde `PGRST205` (tabla `tm_trips` no existe) y la app muestra la pantalla «Falta preparar la base de datos». Claude no tiene acceso de administración a Supabase (solo la clave publicable).
- **Verificado en local:** lint, typecheck, 23 tests unitarios, build; esquema SQL idempotente y RLS probados en PostgreSQL 16; E2E 34/34 contra ese PostgreSQL vía `tests/e2e/fake-supabase.mjs`; carga desde subcarpeta `/Travel-manager/`.
- **Sin verificar aún con datos reales:** login real, Supabase Storage real, llamada real a Claude (simulada en la E2E).
- GitHub Pages se activó con la rama `gh-pages` porque el entorno de Claude no puede cambiar los ajustes de Pages por API.

- **Importar viajes desde JSON** (Ajustes) añadido y probado en local: el viaje «Europa 2026» preparado a partir de 4 PDFs del usuario se importa con 7 vuelos, 3 gastos y 4 documentos sin errores. El archivo se entregó al usuario (no está en el repo: contiene datos personales).

## Próximos pasos

1. Que el usuario ejecute `supabase/schema.sql`; después, probar con la cuenta real (crear viaje, subir documento, importar).
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
| 1 | Repositorio | Resuelta: el usuario creó `Travel-manager`; Claude tiene permiso de escritura en esta sesión. |
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
