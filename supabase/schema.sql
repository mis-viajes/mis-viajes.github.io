-- =====================================================================
--  Travel Manager — esquema para el proyecto Supabase compartido.
--  Ejecutar UNA VEZ en Supabase → SQL Editor → New query → Run.
--  Es idempotente: se puede volver a ejecutar sin perder datos.
--
--  · Prefijo tm_ para no mezclarse con las tablas de las otras apps.
--  · Row Level Security: cada fila pertenece a un usuario (user_id) y
--    solo él puede verla o modificarla (mismo patrón que fin_* y Kratos).
--  · Todo cuelga de un viaje (trip_id) y se borra en cascada con él.
--  · Importes en unidad mínima (enteros) + código de moneda ISO 4217.
-- =====================================================================

create extension if not exists pgcrypto;

-- updated_at automático
create or replace function public.tm_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Viajes
-- ---------------------------------------------------------------------
create table if not exists public.tm_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  base_currency text not null default 'CLP',
  budget_minor bigint,
  cover_image text,
  status text not null default 'planificando' check (status in ('planificando','confirmado','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------
-- Tablas hijas (todas con user_id + trip_id)
-- ---------------------------------------------------------------------
create table if not exists public.tm_travelers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  city text not null,
  country text,
  position integer not null default 0,
  arrival_date date,
  departure_date date,
  timezone text,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  direction text not null default 'ida' check (direction in ('ida','vuelta','conexion','interno')),
  airline text,
  flight_number text,
  booking_code text,
  origin_code text,
  origin_name text,
  origin_lat double precision,
  origin_lng double precision,
  destination_code text,
  destination_name text,
  destination_lat double precision,
  destination_lng double precision,
  departure_local text,
  departure_tz text,
  arrival_local text,
  arrival_tz text,
  terminal_origin text,
  terminal_destination text,
  seats text,
  cabin_class text,
  price_minor bigint,
  currency text,
  booking_status text not null default 'idea' check (booking_status in ('idea','estimado','reservado','confirmado','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_baggage_allowances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  flight_id uuid not null references public.tm_flights(id) on delete cascade,
  category text not null check (category in ('personal','cabina','facturado','adicional')),
  quantity integer,
  max_weight_kg double precision,
  max_dimensions text,
  extra_cost_minor bigint,
  currency text,
  restrictions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_lodgings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  destination_id uuid references public.tm_destinations(id) on delete set null,
  name text not null,
  type text not null default 'hotel' check (type in ('hotel','airbnb','apartamento','hostal','otro')),
  platform text,
  address text,
  city text,
  country text,
  check_in_date date,
  check_out_date date,
  check_in_time text,
  check_out_time text,
  price_minor bigint,
  taxes_minor bigint,
  currency text,
  booking_code text,
  holder_name text,
  guests integer,
  cancellation_policy text,
  amenities text,
  access_info text,
  host_contact text,
  booking_url text,
  booking_status text not null default 'idea' check (booking_status in ('idea','estimado','reservado','confirmado','cancelado')),
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_transports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  type text not null default 'tren' check (type in ('tren','bus','metro','tranvia','taxi','vtc','alquiler','traslado','ferry','otro')),
  operator text,
  service_number text,
  origin text,
  origin_lat double precision,
  origin_lng double precision,
  destination text,
  destination_lat double precision,
  destination_lng double precision,
  departure_local text,
  arrival_local text,
  timezone text,
  seat text,
  travel_class text,
  booking_code text,
  baggage_info text,
  directions_info text,
  price_minor bigint,
  currency text,
  booking_status text not null default 'idea' check (booking_status in ('idea','estimado','reservado','confirmado','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  destination_id uuid references public.tm_destinations(id) on delete set null,
  name text not null,
  description text,
  category text not null default 'turismo' check (category in ('turismo','museo','monumento','excursion','compras','entretenimiento','evento','gratuita','otro')),
  city text,
  address text,
  date date,
  start_time text,
  end_time text,
  price_minor bigint,
  currency text,
  requires_booking boolean not null default false,
  booking_status text not null default 'idea' check (booking_status in ('idea','estimado','reservado','confirmado','cancelado')),
  booking_url text,
  booking_code text,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  destination_id uuid references public.tm_destinations(id) on delete set null,
  name text not null,
  address text,
  city text,
  cuisine text,
  price_range text,
  opening_hours text,
  rating integer check (rating between 1 and 5),
  maps_url text,
  website text,
  requires_booking boolean not null default false,
  reserved_at text,
  list_status text not null default 'por_visitar' check (list_status in ('por_visitar','recomendado','reservado','visitado')),
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  title text not null,
  type text not null default 'otro' check (type in ('pasaporte','billete_avion','tarjeta_embarque','reserva_alojamiento','billete_transporte','entrada','seguro','comprobante','otro')),
  file_name text not null,
  storage_key text not null,
  mime_type text not null,
  size bigint not null,
  linked_type text check (linked_type in ('flight','lodging','transport','activity','expense')),
  linked_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  destination_id uuid references public.tm_destinations(id) on delete set null,
  description text not null,
  category text not null default 'otros' check (category in ('vuelos','alojamiento','transporte','alimentacion','restaurantes','actividades','compras','equipaje','seguros','impuestos','otros')),
  date date,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  -- Unidades de moneda base por 1 unidad de la moneda del gasto. Se congela al registrarlo.
  exchange_rate double precision not null check (exchange_rate > 0),
  amount_base_minor bigint not null,
  -- pagado · parcial · pendiente (comprometido sin pagar) · previsto (gasto futuro estimado)
  status text not null default 'previsto' check (status in ('pagado','parcial','pendiente','previsto')),
  paid_minor bigint,
  paid_by_traveler_id uuid references public.tm_travelers(id) on delete set null,
  payment_method text,
  split_mode text not null default 'igual' check (split_mode in ('igual','personalizado')),
  source_type text check (source_type in ('flight','lodging','transport','activity')),
  source_id uuid,
  -- Reparto: [{ "travelerId": uuid, "shareBaseMinor": entero en moneda base }]
  shares jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Historial de tipos de cambio (por usuario, no por viaje)
create table if not exists public.tm_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_currency text not null,
  to_currency text not null,
  rate double precision not null check (rate > 0),
  date date not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Índices, triggers y Row Level Security
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['tm_trips','tm_travelers','tm_destinations','tm_flights','tm_baggage_allowances',
                           'tm_lodgings','tm_transports','tm_activities','tm_restaurants','tm_documents',
                           'tm_expenses','tm_exchange_rates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.tm_touch_updated_at()', t || '_touch', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    execute format('drop policy if exists "tm_own_rows" on public.%I', t);
    if t in ('tm_trips', 'tm_exchange_rates') then
      execute format(
        'create policy "tm_own_rows" on public.%I for all to authenticated
           using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    else
      -- Además de ser del usuario, la fila debe colgar de un viaje del propio usuario.
      execute format(
        'create policy "tm_own_rows" on public.%I for all to authenticated
           using (user_id = auth.uid())
           with check (user_id = auth.uid()
                       and exists (select 1 from public.tm_trips tr where tr.id = trip_id and tr.user_id = auth.uid()))', t);
      execute format('create index if not exists %I on public.%I (trip_id)', t || '_trip_idx', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Almacenamiento de documentos (bucket privado, una carpeta por usuario)
-- Ruta de cada archivo: <user_id>/<trip_id>/<uuid>-<nombre>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('tm-documentos', 'tm-documentos', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "tm_docs_select" on storage.objects;
drop policy if exists "tm_docs_insert" on storage.objects;
drop policy if exists "tm_docs_delete" on storage.objects;
create policy "tm_docs_select" on storage.objects for select to authenticated
  using (bucket_id = 'tm-documentos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tm_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tm-documentos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tm_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tm-documentos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Añadido 2026-10-30: checklist (tareas + maleta) y orden manual de actividades.
-- La app funciona sin esto: hasta ejecutarlo, Checklist explica cómo activarla.
-- ---------------------------------------------------------------------
create table if not exists public.tm_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  list text not null check (list in ('tareas','maleta')),
  title text not null,
  group_name text,
  status text not null default 'pendiente' check (status in ('pendiente','en_curso','hecho')),
  priority text not null default 'media' check (priority in ('alta','media','baja')),
  due_date date,
  bag text check (bag in ('personal','cabina','facturado','adicional')),
  quantity integer check (quantity > 0),
  weight_kg double precision check (weight_kg >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tm_activities add column if not exists position integer not null default 0;

alter table public.tm_checklist_items enable row level security;
drop trigger if exists tm_checklist_items_touch on public.tm_checklist_items;
create trigger tm_checklist_items_touch before update on public.tm_checklist_items
  for each row execute function public.tm_touch_updated_at();
create index if not exists tm_checklist_items_user_idx on public.tm_checklist_items (user_id);
create index if not exists tm_checklist_items_trip_idx on public.tm_checklist_items (trip_id);
drop policy if exists "tm_own_rows" on public.tm_checklist_items;
create policy "tm_own_rows" on public.tm_checklist_items for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.tm_trips tr where tr.id = trip_id and tr.user_id = auth.uid()));

-- Para que la API vea los cambios sin esperar.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Añadido 2026-10-30: pagos entre viajeros. Ajustan los saldos, no el total del viaje.
-- ---------------------------------------------------------------------
create table if not exists public.tm_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.tm_trips(id) on delete cascade,
  from_traveler_id uuid not null references public.tm_travelers(id) on delete cascade,
  to_traveler_id uuid not null references public.tm_travelers(id) on delete cascade,
  amount_base_minor bigint not null check (amount_base_minor > 0),
  date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_traveler_id <> to_traveler_id)
);

alter table public.tm_repayments enable row level security;
drop trigger if exists tm_repayments_touch on public.tm_repayments;
create trigger tm_repayments_touch before update on public.tm_repayments
  for each row execute function public.tm_touch_updated_at();
create index if not exists tm_repayments_user_idx on public.tm_repayments (user_id);
create index if not exists tm_repayments_trip_idx on public.tm_repayments (trip_id);
drop policy if exists "tm_own_rows" on public.tm_repayments;
create policy "tm_own_rows" on public.tm_repayments for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.tm_trips tr where tr.id = trip_id and tr.user_id = auth.uid()));

notify pgrst, 'reload schema';
