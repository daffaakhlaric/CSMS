-- Additive initial schema. Never drops or truncates production data.
begin;
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id), display_name text not null,
 role text not null check(role in ('admin','packing','office','loading','viewer'))
);
create table if not exists public.facility_config (
 id boolean primary key default true check(id), name text not null default 'Cirebon Frozen Food Demo Facility',
 abf_count integer not null default 1 check(abf_count between 0 and 20), abf_target numeric not null default -40,
 abf_hours numeric not null default 13 check(abf_hours>0), expiry_days integer not null default 365 check(expiry_days>0),
 product_expiry jsonb not null default '{}', racks integer not null default 5 check(racks>0),
 levels integer not null default 3 check(levels>0), slots integer not null default 20 check(slots>0)
);
create table if not exists public.chambers (
 id text primary key, name text not null, kind text not null check(kind in ('cold_storage','abf')),
 layout jsonb not null default '{}', is_demo boolean not null default false
);
create table if not exists public.storage_locations (
 id uuid primary key default gen_random_uuid(), chamber_id text not null references public.chambers,
 rack integer not null check(rack>0), level integer not null check(level>0), slot integer not null check(slot>0),
 unique(chamber_id,rack,level,slot)
);
create table if not exists public.devices (
 id text primary key, model text not null, configuration jsonb not null default '{}', is_demo boolean not null default false
);
create table if not exists public.device_channels (
 device_id text not null references public.devices, channel integer not null check(channel between 1 and 8),
 chamber_id text unique references public.chambers, sensor_id text unique,
 primary key(device_id,channel), check((chamber_id is null)=(sensor_id is null))
);
create table if not exists public.temperature_thresholds (
 chamber_id text primary key references public.chambers, setpoint numeric not null default -20,
 warning numeric not null default -16, critical numeric not null default -12,
 stale_seconds integer not null default 60 check(stale_seconds>0), check(warning<critical)
);
create table if not exists public.simulator_states (
 chamber_id text primary key references public.chambers, temperature numeric not null default -20 check(temperature between -60 and 20),
 running boolean not null default true, scenario text not null default 'normal' check(scenario in ('normal','stable','door','rising','recovery','alarm','offline','stale','manual')),
 noise numeric not null default .12 check(noise>=0), connected boolean not null default true,
 quality text not null default 'baik' check(quality in ('baik','terputus','kedaluwarsa')), last_update timestamptz not null default now()
);
create table if not exists public.temperature_readings (
 id bigint generated always as identity primary key, chamber_id text not null references public.chambers,
 sensor_id text not null references public.device_channels(sensor_id), temperature numeric not null check(temperature between -100 and 100),
 recorded_at timestamptz not null default now(), source text not null check(source in ('SIMULATED','HARDWARE')),
 quality text not null default 'baik', event_id uuid unique
);
create index if not exists temperature_room_time on public.temperature_readings(chamber_id,recorded_at desc);
create table if not exists public.temperature_alerts (
 id uuid primary key default gen_random_uuid(), chamber_id text not null references public.chambers,
 severity text not null check(severity in ('warning','critical','offline','stale')), message text not null,
 opened_at timestamptz not null default now(), resolved_at timestamptz, source text not null default 'SIMULATED'
);
create table if not exists public.production_batches (
 id text primary key, product text not null, pcs integer not null check(pcs>0),
 verified boolean not null default false, verified_by uuid references auth.users, created_by uuid references auth.users,
 created_at timestamptz not null default now()
);
create unique index if not exists one_active_room_alert on public.temperature_alerts(chamber_id) where resolved_at is null;
create table if not exists public.sacks (
 id text primary key, qr text unique not null, owner text not null, product text not null,
 batch_id text not null references public.production_batches, production_date date not null, expiry_date date not null,
 pcs integer not null default 0 check(pcs>=0), kg numeric not null default 0 check(kg>=0),
 status text not null default 'disiapkan' check(status in ('disiapkan','dikemas','ditimbang','disegel','tersimpan','dimuat','dikirim')),
 location_id uuid references public.storage_locations, sealed_by uuid references auth.users, sealed_at timestamptz,
 check(expiry_date>production_date), check(status='disiapkan' or pcs>0),
 check(status in ('disiapkan','dikemas') or kg>0),
 check(status not in ('disegel','tersimpan','dimuat','dikirim') or sealed_at is not null),
 check((status in ('tersimpan','dimuat'))=(location_id is not null))
);
create unique index if not exists one_sack_per_slot on public.sacks(location_id) where location_id is not null;
create table if not exists public.inventory_ledger (
 id uuid primary key default gen_random_uuid(), sack_id text not null references public.sacks,
 kind text not null, location_id uuid references public.storage_locations, delta_pcs integer not null default 0,
 delta_kg numeric not null default 0, actor uuid references auth.users, created_at timestamptz not null default now(),
 event_key text unique
);
create table if not exists public.loading_orders (
 id text primary key, customer text not null, product text not null, required_pcs integer not null check(required_pcs>0),
 required_kg numeric not null check(required_kg>0), status text not null default 'rencana' check(status in ('rencana','dilaporkan','dikonfirmasi')),
 reported_by uuid references auth.users, reported_at timestamptz, confirmed_by uuid references auth.users, confirmed_at timestamptz
);
create table if not exists public.loading_order_sacks (
 order_id text not null references public.loading_orders, sack_id text unique not null references public.sacks,
 primary key(order_id,sack_id)
);
create table if not exists public.dispatch_records (
 id uuid primary key default gen_random_uuid(), order_id text unique not null references public.loading_orders,
 confirmed_by uuid not null references auth.users, confirmed_at timestamptz not null default now(),
 pcs integer not null, kg numeric not null
);
create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor uuid references auth.users, action text not null,
 entity_id text, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create or replace function public.current_csms_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid()
$$;
revoke all on function public.current_csms_role() from public;
grant execute on function public.current_csms_role() to authenticated;
-- All operational tables are readable only by provisioned staff. All writes use checked RPCs.
do $$ declare t text; begin
 foreach t in array array['profiles','facility_config','chambers','storage_locations','devices','device_channels','temperature_thresholds','simulator_states','temperature_readings','temperature_alerts','production_batches','sacks','inventory_ledger','loading_orders','loading_order_sacks','dispatch_records','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using (public.current_csms_role() is not null)',t);
 end loop;
end $$;
create or replace function public.assert_csms_role(allowed text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.current_csms_role()=any(allowed),false) then raise exception 'Akses tidak diizinkan' using errcode='42501'; end if;
end $$;
revoke all on function public.assert_csms_role(text[]) from public;

create or replace function public.confirm_dispatch(p_order text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.loading_orders; d uuid; total_pcs integer; total_kg numeric;
begin
 perform public.assert_csms_role(array['admin','office']);
 select * into o from public.loading_orders where id=p_order for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 select id into d from public.dispatch_records where order_id=p_order;
 if d is not null then return d; end if;
 if o.status<>'dilaporkan' then raise exception 'Laporan Admin Loading diperlukan'; end if;
 perform s.id from public.sacks s join public.loading_order_sacks x on x.sack_id=s.id where x.order_id=p_order for update of s;
 if exists(select 1 from public.sacks s join public.loading_order_sacks x on x.sack_id=s.id where x.order_id=p_order and s.status<>'dimuat') then raise exception 'Status karung tidak valid'; end if;
 select coalesce(sum(s.pcs),0),coalesce(sum(s.kg),0) into total_pcs,total_kg from public.sacks s join public.loading_order_sacks x on x.sack_id=s.id where x.order_id=p_order;
 if total_pcs<o.required_pcs or total_kg<o.required_kg then raise exception 'Target PCS / KG belum terpenuhi'; end if;
 insert into public.dispatch_records(order_id,confirmed_by,pcs,kg) values(p_order,auth.uid(),total_pcs,total_kg) returning id into d;
 insert into public.inventory_ledger(sack_id,kind,location_id,delta_pcs,delta_kg,actor,event_key)
 select s.id,'Konfirmasi pengiriman',s.location_id,-s.pcs,-s.kg,auth.uid(),'dispatch:'||p_order||':'||s.id from public.sacks s join public.loading_order_sacks x on x.sack_id=s.id where x.order_id=p_order;
 update public.sacks set status='dikirim',location_id=null where id in(select sack_id from public.loading_order_sacks where order_id=p_order);
 update public.loading_orders set status='dikonfirmasi',confirmed_by=auth.uid(),confirmed_at=now() where id=p_order;
 insert into public.audit_logs(actor,action,entity_id) values(auth.uid(),'dispatch_confirmed',p_order);
 return d;
end $$;
revoke all on function public.confirm_dispatch(text) from public;
grant execute on function public.confirm_dispatch(text) to authenticated;

create or replace function public.csms_operate(a jsonb) returns void language plpgsql security definer set search_path='' as $$
declare op text:=a->>'type'; s public.sacks; b public.production_batches; o public.loading_orders;
 loc uuid; n integer; weight numeric; expiry integer; rid text; sim public.simulator_states; cfg public.facility_config;
begin
 if op in ('batch','prepare','pack','weigh','seal','putaway') then perform public.assert_csms_role(array['admin','packing']);
 elsif op='verify' then perform public.assert_csms_role(array['admin','office']);
 elsif op in ('order','scan','report') then perform public.assert_csms_role(array['admin','loading']);
 elsif op='dispatch' then perform public.confirm_dispatch(a->>'order');return;
 elsif op in ('room','resetRoom','config') then perform public.assert_csms_role(array['admin']);
 else raise exception 'Operasi tidak dikenal'; end if;
 if op='batch' then
 insert into public.production_batches(id,product,pcs,created_by) values(a->>'id',a->>'product',(a->>'pcs')::integer,auth.uid());
 elsif op='verify' then
 update public.production_batches set verified=true,verified_by=auth.uid() where id=a->>'batch';
 if not found then raise exception 'Batch tidak ditemukan';end if;
 elsif op='prepare' then
 select * into b from public.production_batches where id=a->>'batch' for update;
 if not found or not b.verified or b.product<>a->>'product' then raise exception 'Batch harus sesuai dan terverifikasi';end if;
 select coalesce((product_expiry->>(a->>'product'))::integer,expiry_days) into expiry from public.facility_config where id=true;
 insert into public.sacks(id,qr,owner,product,batch_id,production_date,expiry_date) values(a->>'id','CSMS:'||(a->>'id'),a->>'owner',b.product,b.id,(a->>'production')::date,(a->>'production')::date+expiry);
 elsif op in ('pack','weigh','seal','putaway') then
 select * into s from public.sacks where id=a->>'id' for update;
 if not found then raise exception 'Karung tidak ditemukan';end if;
 if op='pack' then
 if s.status<>'disiapkan' then raise exception 'Karung harus disiapkan';end if;
 select * into b from public.production_batches where id=s.batch_id for update;
 n:=(a->>'pcs')::integer;
 if n<=0 or n+(select coalesce(sum(pcs),0) from public.sacks where batch_id=b.id)>b.pcs then raise exception 'PCS batch tidak mencukupi';end if;
 update public.sacks set pcs=n,status='dikemas' where id=s.id;
 elsif op='weigh' then
 if s.status<>'dikemas' then raise exception 'Karung harus dikemas';end if;
 update public.sacks set kg=(a->>'kg')::numeric,status='ditimbang' where id=s.id;
 elsif op='seal' then
 if s.status<>'ditimbang' then raise exception 'Karung harus ditimbang';end if;
 update public.sacks set status='disegel',sealed_by=auth.uid(),sealed_at=now() where id=s.id;
 elsif op='putaway' then
 if s.status<>'disegel' then raise exception 'Karung harus tersegel';end if;
 select l.id into loc from public.storage_locations l join public.chambers c on c.id=l.chamber_id where l.chamber_id=a->>'room' and c.kind='cold_storage' and l.rack=(a->>'rack')::integer and l.level=(a->>'level')::integer and l.slot=(a->>'slot')::integer for update of l;
 if loc is null then raise exception 'Lokasi tidak ditemukan';end if;
 update public.sacks set location_id=loc,status='tersimpan' where id=s.id;
 insert into public.inventory_ledger(sack_id,kind,location_id,delta_pcs,delta_kg,actor,event_key) values(s.id,'Penempatan ke ruang',loc,s.pcs,s.kg,auth.uid(),'putaway:'||s.id);
 end if;
 elsif op='order' then
 insert into public.loading_orders(id,customer,product,required_pcs,required_kg) values(a->>'id',a->>'customer',a->>'product',(a->>'pcs')::integer,(a->>'kg')::numeric);
 elsif op='scan' then
 select * into o from public.loading_orders where id=a->>'order' for update;
 if not found or o.status<>'rencana' then raise exception 'Pesanan tidak dapat diubah';end if;
 select * into s from public.sacks where id=upper(trim(a->>'input')) or qr=upper(trim(a->>'input')) for update;
 if not found or s.status<>'tersimpan' or s.product<>o.product then raise exception 'Karung tidak tersimpan atau produk tidak sesuai';end if;
 insert into public.loading_order_sacks(order_id,sack_id) values(o.id,s.id);
 update public.sacks set status='dimuat' where id=s.id;
 elsif op='report' then
 select * into o from public.loading_orders where id=a->>'order' for update;
 if not found or o.status<>'rencana' then raise exception 'Status laporan tidak valid';end if;
 select coalesce(sum(sx.pcs),0),coalesce(sum(sx.kg),0) into n,weight from public.sacks sx join public.loading_order_sacks x on x.sack_id=sx.id where x.order_id=o.id;
 if n<o.required_pcs or weight<o.required_kg then raise exception 'Target PCS / KG belum terpenuhi';end if;
 update public.loading_orders set status='dilaporkan',reported_by=auth.uid(),reported_at=now() where id=o.id;
 elsif op='room' then
 rid:=a->>'id';
 if not exists(select 1 from public.chambers where id=rid and is_demo) then raise exception 'Hanya ruang demo dapat disimulasikan';end if;
 update public.simulator_states set temperature=coalesce((a->'patch'->>'temperature')::numeric,temperature),running=coalesce((a->'patch'->>'running')::boolean,running),scenario=coalesce(a->'patch'->>'scenario',scenario),noise=coalesce((a->'patch'->>'noise')::numeric,noise) where chamber_id=rid returning * into sim;
 update public.simulator_states set connected=sim.scenario<>'offline',quality=case sim.scenario when 'offline' then 'terputus' when 'stale' then 'kedaluwarsa' else 'baik' end where chamber_id=rid;
 update public.temperature_thresholds set setpoint=coalesce((a->'patch'->>'target')::numeric,setpoint),warning=coalesce((a->'patch'->>'warning')::numeric,warning),critical=coalesce((a->'patch'->>'critical')::numeric,critical) where chamber_id=rid;
 if a->'patch' ? 'temperature' then
 insert into public.temperature_readings(chamber_id,sensor_id,temperature,source) select rid,sensor_id,sim.temperature,'SIMULATED' from public.device_channels where chamber_id=rid;
 update public.simulator_states set last_update=now() where chamber_id=rid;
 end if;
 elsif op='resetRoom' then
 rid:=a->>'id';if not exists(select 1 from public.chambers where id=rid and is_demo) then raise exception 'Ruang bukan demo';end if;
 update public.simulator_states set temperature=-20,running=true,scenario='normal',noise=.12,connected=true,quality='baik',last_update=now() where chamber_id=rid;
 update public.temperature_thresholds set setpoint=-20,warning=-16,critical=-12 where chamber_id=rid;
 elsif op='config' then
 select * into cfg from public.facility_config where id for update;
 if (a->'config'->>'racks')::integer<cfg.racks or (a->'config'->>'levels')::integer<cfg.levels or (a->'config'->>'slots')::integer<cfg.slots then raise exception 'Pengurangan dimensi memerlukan migrasi lokasi';end if;
 update public.facility_config set abf_count=(a->'config'->>'abfCount')::integer,abf_target=(a->'config'->>'abfTarget')::numeric,abf_hours=(a->'config'->>'abfHours')::numeric,expiry_days=(a->'config'->>'expiryDays')::integer,product_expiry=a->'config'->'productExpiry',racks=(a->'config'->>'racks')::integer,levels=(a->'config'->>'levels')::integer,slots=(a->'config'->>'slots')::integer where id;
 insert into public.storage_locations(chamber_id,rack,level,slot) select c.id,r,l,s from public.chambers c cross join public.facility_config f cross join lateral generate_series(1,f.racks) r cross join lateral generate_series(1,f.levels) l cross join lateral generate_series(1,f.slots) s where c.kind='cold_storage' on conflict do nothing;
 end if;
 insert into public.audit_logs(actor,action,entity_id,detail) values(auth.uid(),op,coalesce(a->>'id',a->>'order',a->>'batch'),a);
end $$;
revoke all on function public.csms_operate(jsonb) from public;
grant execute on function public.csms_operate(jsonb) to authenticated;

create or replace function public.validate_telemetry() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.device_channels where sensor_id=new.sensor_id and chamber_id=new.chamber_id) then raise exception 'Sensor tidak sesuai ruang'; end if;
 return new;
end $$;
create trigger telemetry_mapping before insert on public.temperature_readings for each row execute function public.validate_telemetry();
create or replace function public.evaluate_temperature_alert() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.temperature_thresholds; alert_severity text;
begin
 select * into t from public.temperature_thresholds where chamber_id=new.chamber_id for update;
 if exists(select 1 from public.temperature_readings where chamber_id=new.chamber_id and recorded_at>new.recorded_at) then return new;end if;
 alert_severity:=case when new.temperature>=t.critical then 'critical' when new.temperature>=t.warning then 'warning' else null end;
 update public.temperature_alerts set resolved_at=new.recorded_at where chamber_id=new.chamber_id and resolved_at is null and alert_severity is distinct from temperature_alerts.severity;
 if alert_severity is not null and not exists(select 1 from public.temperature_alerts x where x.chamber_id=new.chamber_id and x.resolved_at is null and x.severity=alert_severity) then
 insert into public.temperature_alerts(chamber_id,severity,message,source,opened_at) values(new.chamber_id,alert_severity,'Suhu melewati ambang konfigurasi',new.source,new.recorded_at);
 end if;
 return new;
end $$;
create trigger telemetry_alert after insert on public.temperature_readings for each row execute function public.evaluate_temperature_alert();
-- Gateway uses a server-only service role. Replay-safe ingestion; no invented device registers.
create or replace function public.ingest_temperature(p_sensor text,p_temperature numeric,p_at timestamptz,p_event uuid) returns void language plpgsql security definer set search_path='' as $$
declare rid text;
begin
 select ch.chamber_id into rid from public.device_channels ch join public.chambers c on c.id=ch.chamber_id join public.devices d on d.id=ch.device_id where ch.sensor_id=p_sensor and not c.is_demo and d.configuration->>'manual_verified'='true';
 if rid is null then raise exception 'Sensor hardware belum diverifikasi atau ruang masih dalam mode demo';end if;
 if p_at>now()+interval '5 minutes' or p_at<now()-interval '1 day' then raise exception 'Timestamp di luar jendela ingest';end if;
 insert into public.temperature_readings(chamber_id,sensor_id,temperature,source,recorded_at,event_id) values(rid,p_sensor,p_temperature,'HARDWARE',p_at,p_event) on conflict(event_id) do nothing;
end $$;
revoke all on function public.ingest_temperature(text,numeric,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.ingest_temperature(text,numeric,timestamptz,uuid) to service_role;
create view public.room_inventory with(security_invoker=true) as
 select l.chamber_id,count(s.id) as sacks,coalesce(sum(s.pcs),0) as pcs,coalesce(sum(s.kg),0) as kg from public.storage_locations l left join public.sacks s on s.location_id=l.id and s.status in ('tersimpan','dimuat') group by l.chamber_id;
grant select on public.room_inventory to authenticated;
do $$ declare t text; begin
 foreach t in array array['temperature_readings','temperature_alerts','simulator_states','sacks','inventory_ledger','loading_orders','production_batches','facility_config'] loop
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
commit;
