-- Phase 1: tenancy, properties, leads. Run in the Supabase SQL editor or via the CLI.
create extension if not exists citext;

create table reserved_subdomains (name text primary key);
insert into reserved_subdomains(name) values
 ('www'),('admin'),('api'),('app'),('support'),('billing'),('mail'),('dashboard'),
 ('login'),('signup'),('static'),('assets'),('cdn'),('help'),('docs'),('status'),('blog');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  subdomain text not null unique check (subdomain ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$'),
  business_name text not null check (length(business_name) between 2 and 120),
  description text,
  contact_person text,
  business_email text,
  phone text,
  whatsapp text,
  status text not null default 'active' check (status in ('onboarding','active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager','agent')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index on tenant_memberships(user_id);

create table properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  public_id text not null,
  slug text not null,
  title text not null,
  description text,
  listing_type text not null check (listing_type in ('sale','rent')),
  category text not null default 'apartment',
  price_minor bigint check (price_minor >= 0),
  publication_status text not null default 'draft' check (publication_status in ('draft','published','unpublished','archived')),
  availability text not null default 'available' check (availability in ('available','sold','rented','unavailable')),
  construction_status text not null default 'ready_to_move',
  first_published_at timestamptz,
  published_at timestamptz,
  locality text,
  city text,
  state text,
  bedrooms int check (bedrooms >= 0),
  bathrooms int check (bathrooms >= 0),
  builtup_area numeric,
  area_unit text default 'sqft',
  furnishing text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, public_id)
);
create index properties_public_idx on properties(tenant_id, publication_status, availability, listing_type, city);
create index properties_published_at_idx on properties(tenant_id, published_at desc);

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  name text not null,
  email text,
  phone text not null,
  message text,
  consent_at timestamptz not null,
  consent_text_version text not null,
  status text not null default 'new' check (status in ('new','contacted','visit_requested','visit_scheduled','closed','not_interested')),
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_tenant_idx on leads(tenant_id, status, created_at desc);

-- keep updated_at fresh
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_tenants before update on tenants for each row execute function touch_updated_at();
create trigger t_props before update on properties for each row execute function touch_updated_at();
create trigger t_leads before update on leads for each row execute function touch_updated_at();

-- helper used by RLS: is the caller a member of this tenant?
create or replace function is_member(t uuid, roles text[] default array['owner','manager','agent'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenant_memberships m
                 where m.tenant_id = t and m.user_id = auth.uid() and m.role = any(roles));
$$;

alter table tenants enable row level security;
alter table tenant_memberships enable row level security;
alter table properties enable row level security;
alter table leads enable row level security;
alter table reserved_subdomains enable row level security;

-- tenants: anyone can read active tenants (public site); members can update their own
create policy tenants_public_read on tenants for select using (status = 'active' or is_member(id));
create policy tenants_member_update on tenants for update using (is_member(id, array['owner','manager'])) with check (is_member(id, array['owner','manager']));

-- memberships: users see only their own rows. No client-side inserts (done via create_tenant()).
create policy memberships_self_read on tenant_memberships for select using (user_id = auth.uid());

-- properties: public sees published+available-ish rows of active tenants; members see/manage their tenant's rows
create policy properties_public_read on properties for select using (
  publication_status = 'published' and deleted_at is null
  and exists (select 1 from tenants t where t.id = tenant_id and t.status = 'active'));
create policy properties_member_read on properties for select using (is_member(tenant_id));
create policy properties_member_insert on properties for insert with check (is_member(tenant_id));
create policy properties_member_update on properties for update using (is_member(tenant_id)) with check (is_member(tenant_id));
create policy properties_member_delete on properties for delete using (is_member(tenant_id, array['owner','manager']));

-- leads: only members read/update. Inserts happen server-side with the service role (/api/leads).
create policy leads_member_read on leads for select using (is_member(tenant_id));
create policy leads_member_update on leads for update using (is_member(tenant_id)) with check (is_member(tenant_id));

-- Atomic tenant creation: validates subdomain, rejects reserved names, adds owner membership.
create or replace function create_tenant(p_subdomain text, p_business_name text,
  p_contact_person text default null, p_phone text default null, p_email text default null)
returns tenants language plpgsql security definer set search_path = public as $$
declare t tenants; sub text := lower(trim(p_subdomain));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if sub !~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$' then raise exception 'invalid subdomain'; end if;
  if exists (select 1 from reserved_subdomains where name = sub) then raise exception 'subdomain reserved'; end if;
  insert into tenants(subdomain, business_name, contact_person, phone, business_email)
    values (sub, trim(p_business_name), p_contact_person, p_phone, coalesce(p_email, (select email from auth.users where id = auth.uid())))
    returning * into t;
  insert into tenant_memberships(tenant_id, user_id, role) values (t.id, auth.uid(), 'owner');
  return t;
exception when unique_violation then raise exception 'subdomain taken';
end $$;
revoke all on function create_tenant from public;
grant execute on function create_tenant to authenticated;

create or replace function subdomain_available(p_subdomain text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_subdomain) ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$'
     and not exists (select 1 from reserved_subdomains where name = lower(p_subdomain))
     and not exists (select 1 from tenants where subdomain = lower(p_subdomain));
$$;
grant execute on function subdomain_available to anon, authenticated;
