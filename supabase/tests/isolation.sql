-- Tenant-isolation checks. Run in the Supabase SQL editor on a DISPOSABLE project/branch.
-- Replace the two UUIDs with real auth.users ids (user A and user B), then run the whole script.
-- Each block raises an exception if isolation is broken; if the script finishes, it passed.
do $$
declare ua uuid := '00000000-0000-0000-0000-00000000000a';  -- <- replace
        ub uuid := '00000000-0000-0000-0000-00000000000b';  -- <- replace
        ta uuid; tb uuid; pa uuid; n int;
begin
  -- setup as superuser
  insert into tenants(subdomain, business_name) values ('isotesta','Iso A') returning id into ta;
  insert into tenants(subdomain, business_name) values ('isotestb','Iso B') returning id into tb;
  insert into tenant_memberships(tenant_id,user_id) values (ta,ua),(tb,ub);
  insert into properties(tenant_id,public_id,slug,title,listing_type) values (ta,'aaaaaa','a-aaaaaa','Draft A','sale') returning id into pa;
  insert into leads(tenant_id,property_id,name,phone,consent_at,consent_text_version) values (ta,pa,'x','1',now(),'v1');

  -- act as user B
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from properties where tenant_id = ta;
  if n <> 0 then raise exception 'FAIL: B can read A properties (drafts)'; end if;
  select count(*) into n from leads where tenant_id = ta;
  if n <> 0 then raise exception 'FAIL: B can read A leads'; end if;
  update properties set title = 'hacked' where tenant_id = ta;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated A property'; end if;
  begin
    insert into properties(tenant_id,public_id,slug,title,listing_type) values (ta,'bbbbbb','b-bbbbbb','evil','sale');
    raise exception 'FAIL: B inserted into A';
  exception when insufficient_privilege or check_violation then null; end;
  begin
    insert into tenant_memberships(tenant_id,user_id) values (ta,ub);
    raise exception 'FAIL: B self-added membership to A';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  reset role;
  -- cleanup
  delete from tenants where id in (ta,tb);
  raise notice 'tenant isolation checks passed';
end $$;
