-- Cambios hechos desde otro equipo («Manejar otra caja»), aplicada como migración remoto_cambios.
-- La laptop guarda aquí lo que cambió (productos, clientes, proveedores, usuarios, ajustes, stock)
-- y la caja de la tienda los lee cada minuto, los aplica y marca «aplicado».
create table if not exists public.cambios (
  id bigint generated always as identity primary key,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tienda text not null,
  datos jsonb not null,
  resumen text not null default '',
  autor text default (auth.jwt() ->> 'email'),
  dispositivo text,
  creado timestamptz not null default now(),
  aplicado timestamptz,
  aplicado_por text
);
create index if not exists cambios_pendientes on public.cambios (negocio_id, tienda, id) where aplicado is null;
alter table public.cambios enable row level security;

-- Ven y envían cambios: los miembros del negocio (el dueño con su Google) y el proveedor
-- mientras el cliente le dio acceso de soporte.
create policy "ver cambios" on public.cambios for select
  using (privado.es_miembro(negocio_id) or (privado.es_admin() and privado.soporte_activo(negocio_id)));
create policy "enviar cambios" on public.cambios for insert
  with check (privado.es_miembro(negocio_id) or (privado.es_admin() and privado.soporte_activo(negocio_id)));
-- Solo la caja del negocio marca «aplicado».
create policy "marcar aplicado" on public.cambios for update
  using (privado.es_miembro(negocio_id)) with check (privado.es_miembro(negocio_id));
