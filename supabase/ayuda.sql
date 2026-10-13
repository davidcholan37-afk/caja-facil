-- Caja Fácil · límite diario independiente para el chat de ayuda IA.
-- Ejecutar en Supabase antes de desplegar la función "ayuda".
create table if not exists privado.ayuda_uso (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  dia date not null,
  usos integer not null default 0 check (usos >= 0),
  primary key (negocio_id, dia)
);
revoke all on privado.ayuda_uso from anon, authenticated;

create or replace function public.ayuda_usar(neg uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  estado text;
  uso integer;
begin
  if not privado.es_miembro(neg) then return false; end if;
  select n.estado into estado from public.negocios n where n.id = neg;
  if estado is distinct from 'activo' then return false; end if;

  insert into privado.ayuda_uso as a (negocio_id, dia, usos)
    values (neg, (now() at time zone 'America/Lima')::date, 1)
    on conflict (negocio_id, dia) do update set usos = a.usos + 1 where a.usos < 50
    returning a.usos into uso;
  return uso is not null;
end;
$$;
revoke all on function public.ayuda_usar(uuid) from public, anon;
grant execute on function public.ayuda_usar(uuid) to authenticated;