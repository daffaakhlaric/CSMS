-- Allow loading staff to dispatch without granting office/master permissions.
begin;
create or replace function public.eam_commit(p_id uuid,p_revision integer,p_state jsonb,p_request uuid,p_command jsonb,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
  (t in ('order','load','cancel','dispatch') and actor_role in ('loading','ADMIN_LOADING')) or
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

commit;
