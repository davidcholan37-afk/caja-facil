-- Caja Fácil · Voz con IA (extra de pago)
-- Aplicar UNA vez en el proyecto caja-facil de Supabase. No toca datos existentes.

-- 1) Bandera por negocio: la voz es un extra que el proveedor activa a mano.
alter table public.negocios add column if not exists voz boolean not null default false;
alter table public.negocios add column if not exists voz_limite integer not null default 150;

-- 2) Conteo de usos por día (esquema privado: nadie lo lee desde la app).
create table if not exists privado.voz_uso (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  dia date not null,
  usos integer not null default 0,
  primary key (negocio_id, dia)
);
revoke all on privado.voz_uso from anon, authenticated;

-- 3) La función de la IA llama a esto antes de gastar: ¿es miembro, está activo, tiene voz y no pasó su límite?
create or replace function public.voz_usar(neg uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v boolean; lim integer; r integer;
begin
  if not privado.es_miembro(neg) then return false; end if;
  select x.voz, x.voz_limite into v, lim from public.negocios x where x.id = neg and x.estado = 'activo';
  if not coalesce(v, false) then return false; end if;
  insert into privado.voz_uso as u (negocio_id, dia, usos)
    values (neg, (now() at time zone 'America/Lima')::date, 1)
    on conflict (negocio_id, dia) do update set usos = u.usos + 1 where u.usos < lim
    returning u.usos into r;
  return r is not null;
end;
$$;
revoke all on function public.voz_usar(uuid) from public, anon;
grant execute on function public.voz_usar(uuid) to authenticated;

-- 4) Solo el proveedor (privado.admins) activa o quita la voz y fija el límite diario.
create or replace function public.admin_voz(neg uuid, activa boolean, limite integer default 150)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if limite < 1 or limite > 2000 then raise exception 'Límite no válido'; end if;
  update public.negocios set voz = activa, voz_limite = limite where id = neg;
end;
$$;
revoke all on function public.admin_voz(uuid, boolean, integer) from public, anon;
grant execute on function public.admin_voz(uuid, boolean, integer) to authenticated;

-- 5) Para el panel «Mis clientes»: quién tiene voz y cuánto usó hoy.
create or replace function public.admin_voz_lista()
returns table(id uuid, voz boolean, voz_limite integer, usos_hoy integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
    select n.id, n.voz, n.voz_limite,
           coalesce((select u.usos from privado.voz_uso u where u.negocio_id = n.id and u.dia = (now() at time zone 'America/Lima')::date), 0)
    from public.negocios n;
end;
$$;
revoke all on function public.admin_voz_lista() from public, anon;
grant execute on function public.admin_voz_lista() to authenticated;
