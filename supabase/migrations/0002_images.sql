-- Phase 2: property images, storage accounting, cover selection.
alter table properties add constraint properties_id_tenant_uniq unique (id, tenant_id);

create table property_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null,
  kind text not null default 'photo' check (kind in ('photo','floor_plan')),
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  caption text check (caption is null or length(caption) <= 80),
  sort_order int not null default 0,
  is_cover boolean not null default false,
  width int, height int,
  storage_bytes bigint not null default 0,   -- declared size while pending, real stored bytes once ready
  original_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- an image can only point at a property of the SAME tenant
  foreign key (property_id, tenant_id) references properties(id, tenant_id) on delete cascade
);
create unique index property_images_one_cover on property_images(property_id) where is_cover;
create index property_images_order on property_images(property_id, sort_order);
create index property_images_pending on property_images(status, created_at) where status <> 'ready';
create trigger t_imgs before update on property_images for each row execute function touch_updated_at();

alter table property_images enable row level security;
create policy images_public_read on property_images for select using (
  status = 'ready' and exists (
    select 1 from properties p join tenants t on t.id = p.tenant_id
    where p.id = property_id and p.publication_status = 'published' and p.deleted_at is null and t.status = 'active'));
create policy images_member_read   on property_images for select using (is_member(tenant_id));
create policy images_member_insert on property_images for insert with check (is_member(tenant_id));
create policy images_member_update on property_images for update using (is_member(tenant_id)) with check (is_member(tenant_id));
create policy images_member_delete on property_images for delete using (is_member(tenant_id));

-- Storage used by a tenant (pending uploads count at their declared size). Members only.
create or replace function tenant_storage_bytes(t uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select case when is_member(t) then coalesce((select sum(storage_bytes) from property_images where tenant_id = t), 0) else 0 end;
$$;
grant execute on function tenant_storage_bytes to authenticated;

-- Cover swap (security invoker: RLS applies). Two statements to respect the one-cover unique index.
create or replace function set_cover(p_image uuid) returns void language plpgsql as $$
declare pid uuid;
begin
  select property_id into pid from property_images where id = p_image and status = 'ready' and kind = 'photo';
  if pid is null then raise exception 'image not found'; end if;
  update property_images set is_cover = false where property_id = pid and is_cover;
  update property_images set is_cover = true where id = p_image;
end $$;
grant execute on function set_cover to authenticated;
