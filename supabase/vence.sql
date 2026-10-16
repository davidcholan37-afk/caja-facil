-- Caja Fácil · plan mensual (S/ 150 al mes).
-- negocios.vence = hasta cuándo está pagado. null = sin vencimiento (las tiendas que ya existían, pruebas).
-- Canjear un código da 1 mes. El proveedor renueva con «Renovar 1 mes». Migración: plan_mensual.

alter table public.negocios add column if not exists vence timestamptz;

-- El dueño no puede cambiarse solo la fecha de vencimiento.
create or replace function privado.negocio_proteger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and (new.estado is distinct from old.estado or new.voz is distinct from old.voz
          or new.voz_limite is distinct from old.voz_limite or new.vence is distinct from old.vence)
     and not privado.es_admin()
     and coalesce(current_setting('privado.ok', true), '') <> '1' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return new;
end $$;

-- El nuevo negocio tampoco puede traer una fecha elegida por el cliente.
create or replace function privado.negocio_estado_inicial() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if privado.es_admin() or exists (
    select 1 from privado.accesos a join auth.users u on lower(u.email) = a.correo where u.id = new.dueno
  ) then new.estado := 'activo'; else new.estado := 'pendiente'; end if;
  new.voz := false; new.voz_limite := 150; new.vence := null;
  return new;
end $$;

-- Canjear el código activa la caja por 1 mes.
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
  update public.negocios set estado = 'activo', vence = now() + interval '1 month'
    where id = neg and estado = 'pendiente';
  return true;
end $$;

-- Proveedor: suma meses (desde hoy o desde el vencimiento, lo que sea más tarde) y deja la caja activa.
create or replace function public.admin_renovar(n uuid, meses integer default 1) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare nuevo timestamptz;
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if meses < 1 or meses > 24 then raise exception 'Meses no válidos'; end if;
  update public.negocios
    set vence = greatest(now(), coalesce(vence, now())) + make_interval(months => meses),
        estado = case when estado = 'suspendido' then estado else 'activo' end
    where id = n returning vence into nuevo;
  return nuevo;
end $$;

-- Proveedor: quita el vencimiento (cliente sin fecha, por ejemplo pruebas).
create or replace function public.admin_sin_vence(n uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.negocios set vence = null where id = n;
end $$;

-- La lista de clientes ahora trae «vence».
drop function if exists public.admin_negocios();
create function public.admin_negocios()
returns table(id uuid, nombre text, correo text, estado text, soporte_hasta timestamptz, creado timestamptz, ultima timestamptz, tiendas bigint, nota text, vence timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
    select n.id, n.nombre, u.email::text, n.estado, n.soporte_hasta, n.creado,
           (select max(r.actualizado) from public.registros r where r.negocio_id = n.id),
           (select count(distinct r.tienda) from public.registros r where r.negocio_id = n.id and r.tipo = 'config'),
           n.nota, n.vence
    from public.negocios n left join auth.users u on u.id = n.dueno
    order by 7 desc nulls last;
end $$;

revoke all on function public.admin_renovar(uuid, integer), public.admin_sin_vence(uuid), public.admin_negocios() from public, anon;
grant execute on function public.admin_renovar(uuid, integer), public.admin_sin_vence(uuid), public.admin_negocios() to authenticated;
