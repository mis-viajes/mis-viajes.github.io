-- Prueba de aislamiento entre usuarios (ejecutar tras supabase-stubs.sql y schema.sql).
\set ON_ERROR_STOP 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'), ('22222222-2222-2222-2222-222222222222','b@x') on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
insert into public.tm_trips (id, name, start_date, end_date) values ('aaaaaaaa-0000-0000-0000-000000000001','Viaje A','2027-01-01','2027-01-05');
insert into public.tm_travelers (trip_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Viajero A');
select 'A ve sus viajes: ' || count(*) from public.tm_trips;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', false);
select 'B ve viajes de A: ' || count(*) from public.tm_trips;
select 'B ve viajeros de A: ' || count(*) from public.tm_travelers;
update public.tm_trips set name = 'hackeado';
\set ON_ERROR_STOP 0
insert into public.tm_travelers (trip_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Intruso');
\set ON_ERROR_STOP 1

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', false);
\set ON_ERROR_STOP 0
insert into public.tm_checklist_items (trip_id, list, title) values ('aaaaaaaa-0000-0000-0000-000000000001','tareas','Intruso');
\set ON_ERROR_STOP 1
select 'Nombre tras intento de B: ' || name from public.tm_trips;
select 'Viajeros de A: ' || count(*) from public.tm_travelers;
select 'Tareas tras intento de B: ' || count(*) from public.tm_checklist_items;
delete from public.tm_trips;
select 'Viajeros tras borrar el viaje (cascada): ' || count(*) from public.tm_travelers;
reset role;
