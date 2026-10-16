-- Caja Fácil · compra con código.
-- Toda tienda nueva empieza en «pendiente» y no vende hasta canjear un código (compra) o
-- hasta que el proveedor le dé acceso por correo (pruebas). Las tiendas que ya existían siguen activas.
-- Aplicado en el proyecto (migración pago_codigos).

alter table public.negocios drop constraint if exists negocios_estado_check;
alter table public.negocios add constraint negocios_estado_check check (estado in ('activo','suspendido','pendiente'));

create table if not exists privado.codigos (
  codigo text primary key,
  creado timestamptz not null default now(),
  nota text,
  usado_en timestamptz,
  negocio_id uuid references public.negocios(id) on delete set null
);
create table if not exists privado.accesos (
  correo text primary key,
  creado timestamptz not null default now(),
  nota text
);
alter table privado.codigos enable row level security;
alter table privado.accesos enable row level security;

-- Estado inicial de una tienda nueva (el cliente no puede elegirlo).
create or replace function privado.negocio_estado_inicial() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if privado.es_admin() or exists (
    select 1 from privado.accesos a join auth.users u on lower(u.email) = a.correo where u.id = new.dueno
  ) then new.estado := 'activo'; else new.estado := 'pendiente'; end if;
  new.voz := false; new.voz_limite := 150;
  return new;
end $$;
drop trigger if exists negocios_estado_inicial on public.negocios;
create trigger negocios_estado_inicial before insert on public.negocios
  for each row execute function privado.negocio_estado_inicial();

-- El dueño no puede cambiarse solo el estado ni la voz (solo el proveedor o el canje de un código).
create or replace function privado.negocio_proteger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and (new.estado is distinct from old.estado or new.voz is distinct from old.voz or new.voz_limite is distinct from old.voz_limite)
     and not privado.es_admin()
     and coalesce(current_setting('privado.ok', true), '') <> '1' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists negocios_proteger on public.negocios;
create trigger negocios_proteger before update on public.negocios
  for each row execute function privado.negocio_proteger();

create or replace function public.admin_estado(n uuid, e text, nota_txt text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if e not in ('activo','suspendido','pendiente') then raise exception 'Estado no válido'; end if;
  update public.negocios set estado = e, nota = coalesce(nota_txt, nota) where id = n;
end $$;

-- Proveedor: crea un código de un solo uso (12 letras/números al azar).
create or replace function public.admin_codigo_nuevo(nota_txt text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare h text; c text;
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  h := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  c := substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4);
  insert into privado.codigos (codigo, nota) values (c, nullif(trim(nota_txt), ''));
  return c;
end $$;

create or replace function public.admin_codigos() returns table(codigo text, creado timestamptz, nota text, usado_en timestamptz, negocio text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select k.codigo, k.creado, k.nota, k.usado_en, n.nombre
    from privado.codigos k left join public.negocios n on n.id = k.negocio_id order by k.creado desc limit 30;
end $$;

-- Proveedor: da acceso por correo de Google (pruebas, sin código). Si ya tiene tienda pendiente, la activa.
create or replace function public.admin_dar_acceso(correo_txt text, nota_txt text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare k integer;
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if correo_txt is null or position('@' in correo_txt) = 0 then raise exception 'Correo no válido'; end if;
  insert into privado.accesos (correo, nota) values (lower(trim(correo_txt)), nullif(trim(nota_txt), ''))
    on conflict (correo) do nothing;
  update public.negocios n set estado = 'activo'
    where n.estado = 'pendiente' and n.dueno in (select u.id from auth.users u where lower(u.email) = lower(trim(correo_txt)));
  get diagnostics k = row_count;
  return k;
end $$;

-- Cliente: ¿el código existe y está sin usar? (lo usa la página de compra para soltar la descarga; no lo gasta)
create or replace function public.codigo_valido(c text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privado.codigos k where k.codigo = upper(trim(c)) and k.usado_en is null);
$$;

-- Dueño: canjea el código y su tienda queda activa.
create or replace function public.canjear_codigo(c text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare neg uuid; cod text;
begin
  if auth.uid() is null then return false; end if;
  select id into neg from public.negocios where dueno = auth.uid() order by creado asc limit 1;
  if neg is null then return false; end if;
  update privado.codigos set usado_en = now(), negocio_id = neg
    where codigo = upper(trim(c)) and usado_en is null returning codigo into cod;
  if cod is null then return false; end if;
  perform set_config('privado.ok', '1', true);
  update public.negocios set estado = 'activo' where id = neg and estado = 'pendiente';
  return true;
end $$;

revoke all on function public.admin_codigo_nuevo(text), public.admin_codigos(), public.admin_dar_acceso(text, text) from public, anon;
revoke all on function public.canjear_codigo(text) from public, anon;
grant execute on function public.admin_codigo_nuevo(text), public.admin_codigos(), public.admin_dar_acceso(text, text), public.canjear_codigo(text) to authenticated;
grant execute on function public.codigo_valido(text) to anon, authenticated;
