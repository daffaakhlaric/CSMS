-- Additive EAM workspace migration. Existing CSMS inventory is never seeded/migrated implicitly.
begin;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','packing','office','loading','viewer','SUPER_ADMIN','SUPERVISOR','ADMIN_PACKING','ADMIN_OFFICE','CS_OPERATOR','ADMIN_LOADING','TEMPERATURE_MONITOR'));
create table public.eam_operational_runs(id uuid primary key,revision integer not null default 0,state jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(jsonb_typeof(state)='object'));
create table public.eam_operational_events(id bigint generated always as identity primary key,run_id uuid not null references public.eam_operational_runs,request_id uuid not null,revision integer not null,command jsonb not null,actor uuid not null references auth.users,created_at timestamptz not null default now(),unique(run_id,request_id));
create index eam_events_time on public.eam_operational_events(run_id,created_at desc);
alter table public.eam_operational_runs enable row level security;
alter table public.eam_operational_events enable row level security;
grant select on public.eam_operational_runs,public.eam_operational_events to authenticated;
revoke all on public.eam_operational_runs,public.eam_operational_events from anon;
grant all on public.eam_operational_runs,public.eam_operational_events to service_role;
grant usage,select on sequence public.eam_operational_events_id_seq to service_role;
create policy eam_runs_staff_read on public.eam_operational_runs for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid()));
create policy eam_events_staff_read on public.eam_operational_events for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid()));
-- Only trusted API server can commit calculated state. Client writes are not granted.
create function public.eam_commit(p_id uuid,p_revision integer,p_state jsonb,p_request uuid,p_command jsonb,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.eam_operational_runs; actor_role text; t text:=p_command->>'type';
begin
 select role into actor_role from public.profiles where id=p_actor;
 if actor_role is null then raise exception 'Unknown actor'; end if;
 if t in ('tick','control') then raise exception 'Simulation prohibited in production'; end if;
 if actor_role not in ('admin','SUPER_ADMIN') and not (
  (t in ('pack','seal') and actor_role in ('packing','ADMIN_PACKING')) or
  (t in ('verify','dispatch','batchCreate') and actor_role in ('office','ADMIN_OFFICE','SUPERVISOR')) or
  (t in ('assign','palletConfirm') and actor_role='ADMIN_PACKING') or
  (t in ('palletCreate','assign','palletConfirm','putaway','opnameScan','opnameStart') and actor_role='CS_OPERATOR') or
  (t in ('order','load','cancel') and actor_role in ('loading','ADMIN_LOADING')) or
  (t in ('channel','ack') and actor_role='TEMPERATURE_MONITOR') or
  (t in ('opnameClose','discrepancy','opnameStart','batchComplete') and actor_role='SUPERVISOR')
 ) then raise exception 'Forbidden'; end if;
 select * into r from public.eam_operational_runs where id=p_id for update;
 if not found then raise exception 'Unknown workspace'; end if;
 if exists(select 1 from public.eam_operational_events where run_id=p_id and request_id=p_request) then return to_jsonb(r); end if;
 if r.revision<>p_revision then raise exception 'Revision conflict'; end if;
 update public.eam_operational_runs set state=p_state,revision=revision+1,updated_at=now() where id=p_id returning * into r;
 insert into public.eam_operational_events(run_id,request_id,revision,command,actor) values(p_id,p_request,r.revision,p_command,p_actor);
 return to_jsonb(r);
end $$;
revoke all on function public.eam_commit(uuid,integer,jsonb,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.eam_commit(uuid,integer,jsonb,uuid,jsonb,uuid) to service_role;
-- Run state is the atomic aggregate. Read-only projections avoid duplicating legacy tables.
create view public.eam_products with(security_invoker=true) as select r.id run_id,p.* from public.eam_operational_runs r cross join lateral jsonb_to_recordset(r.state->'products') as p(id text,name text,category text,pcs integer,months integer,active boolean);
create view public.eam_pallets with(security_invoker=true) as select r.id run_id,p.* from public.eam_operational_runs r cross join lateral jsonb_to_recordset(r.state->'pallets') as p(id text,qr text,location text,confirmed boolean);
create view public.eam_sacks with(security_invoker=true) as select r.id run_id,s.* from public.eam_operational_runs r cross join lateral jsonb_to_recordset(r.state->'sacks') as s(id text,qr text,product text,owner text,pcs integer,kg numeric,status text,pallet text,location text);
grant select on public.eam_products,public.eam_pallets,public.eam_sacks to authenticated;
do $$ begin alter publication supabase_realtime add table public.eam_operational_runs; exception when duplicate_object or undefined_object then null; end $$;
commit;
