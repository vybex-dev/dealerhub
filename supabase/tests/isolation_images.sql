-- Phase 2 isolation checks. Same procedure as isolation.sql: disposable project, replace the two user UUIDs.
do $$
declare ua uuid := '00000000-0000-0000-0000-00000000000a'; ub uuid := '00000000-0000-0000-0000-00000000000b';
        ta uuid; tb uuid; pa uuid; pb uuid; ia uuid; n int;
begin
  insert into tenants(subdomain,business_name) values ('imgtesta','A') returning id into ta;
  insert into tenants(subdomain,business_name) values ('imgtestb','B') returning id into tb;
  insert into tenant_memberships(tenant_id,user_id) values (ta,ua),(tb,ub);
  insert into properties(tenant_id,public_id,slug,title,listing_type) values (ta,'aaaaaa','a','A prop','sale') returning id into pa;
  insert into properties(tenant_id,public_id,slug,title,listing_type) values (tb,'bbbbbb','b','B prop','sale') returning id into pb;
  insert into property_images(tenant_id,property_id,status) values (ta,pa,'ready') returning id into ia;

  -- composite FK: image of tenant B cannot point at tenant A's property
  begin insert into property_images(tenant_id,property_id) values (tb,pa); raise exception 'FAIL: cross-tenant FK allowed';
  exception when foreign_key_violation then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from property_images where tenant_id = ta;            if n <> 0 then raise exception 'FAIL: B reads A draft images'; end if;
  delete from property_images where id = ia; get diagnostics n = row_count;    if n <> 0 then raise exception 'FAIL: B deleted A image'; end if;
  if tenant_storage_bytes(ta) <> 0 then raise exception 'FAIL: B sees A storage usage'; end if;
  begin perform set_cover(ia); raise exception 'FAIL: B set A cover'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  reset role;
  delete from tenants where id in (ta,tb);
  raise notice 'image isolation checks passed';
end $$;
