# ✈️ Travel Manager

Aplicación personal para planificar y gestionar viajes: destinos, vuelos y equipaje, alojamientos, transporte, actividades, restaurantes, finanzas compartidas, documentos, mapa interactivo e importación inteligente de reservas.

**App:** https://diego94diaz-oss.github.io/travel-manager/

Forma parte del mismo ecosistema que Mi Día, Finanzas y Kratos: mismo proyecto Supabase, mismo inicio de sesión y publicación en GitHub Pages.

## Puesta en marcha (una sola vez)

1. **Base de datos:** en supabase.com → proyecto compartido → **SQL Editor** → *New query*, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Crea las tablas `tm_*` (no toca las de las otras apps), sus políticas de seguridad y el bucket privado `tm-documentos`. Se puede volver a ejecutar sin perder datos.
2. **Publicación:** en GitHub → *Settings* → *Pages* → *Source*: **GitHub Actions**. Cada push a `main` publica la app automáticamente.
3. **Importación inteligente (opcional):** en la app, *Ajustes* → pega tu clave de API de Anthropic. Se guarda solo en ese navegador.

## Stack

Vite + React 19 + TypeScript · Tailwind CSS 4 · supabase-js (datos, sesión y archivos) · Leaflet + OpenStreetMap · API de Claude para la importación · Vitest + Playwright.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173/travel-manager/
npm run lint
npm test           # pruebas unitarias
npm run build      # genera dist/
```

Prueba de punta a punta contra un PostgreSQL local con el esquema real (ver cabecera de `tests/e2e/smoke.mjs`):

```bash
npm run test:db       # servidor de pruebas (requiere PostgreSQL con tests/db/supabase-stubs.sql + supabase/schema.sql)
npm run build:test && npm run preview:test
npm run test:e2e
```

Más detalle técnico en [`CLAUDE.md`](CLAUDE.md).
