begin;
create or replace function public.csms_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if public.current_csms_role() is null then raise exception 'Profil staf belum dikonfigurasi' using errcode='42501';end if;
 select jsonb_build_object(
 'version',1,
 'alerts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'room',chamber_id,'severity',severity,'openedAt',opened_at,'resolvedAt',resolved_at,'message',message) order by opened_at desc),'[]'::jsonb) from (select * from public.temperature_alerts order by opened_at desc limit 500) a),
 'rooms',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'sensor',d.sensor_id,'channel',d.channel,
 'temperature',coalesce(last_t.temperature,sim.temperature),'target',t.setpoint,'warning',t.warning,'critical',t.critical,
 'noise',sim.noise,'connected',case when c.is_demo then sim.connected else coalesce(last_t.recorded_at>now()-make_interval(secs=>t.stale_seconds),false) end,'quality',case when c.is_demo and sim.scenario in ('offline','stale') then sim.quality when last_t.recorded_at is null or last_t.recorded_at<now()-make_interval(secs=>t.stale_seconds) then 'kedaluwarsa' else 'baik' end,
 'running',c.is_demo and sim.running,'scenario',sim.scenario,'lastUpdate',coalesce(last_t.recorded_at,sim.last_update),
 'history',coalesce((select jsonb_agg(jsonb_build_object('at',h.recorded_at,'value',h.temperature,'source',h.source) order by h.recorded_at) from (select * from public.temperature_readings where chamber_id=c.id order by recorded_at desc limit 1800) h),'[]'::jsonb)
 ) order by c.id),'[]'::jsonb) from public.chambers c join public.device_channels d on d.chamber_id=c.id join public.temperature_thresholds t on t.chamber_id=c.id join public.simulator_states sim on sim.chamber_id=c.id left join lateral (select temperature,recorded_at from public.temperature_readings where chamber_id=c.id order by recorded_at desc limit 1) last_t on true where c.kind='cold_storage'),
 'sacks',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'qr',s.qr,'owner',s.owner,'product',s.product,'batch',s.batch_id,'production',s.production_date,'expiry',s.expiry_date,'pcs',s.pcs,'kg',s.kg,'status',s.status,'room',l.chamber_id,'rack',l.rack,'level',l.level,'slot',l.slot,'sealedBy',s.sealed_by,'sealedAt',s.sealed_at) order by s.id),'[]'::jsonb) from public.sacks s left join public.storage_locations l on l.id=s.location_id),
 'batches',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'product',product,'pcs',pcs,'verified',verified,'verifiedBy',verified_by) order by created_at),'[]'::jsonb) from public.production_batches),
 'orders',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'customer',o.customer,'product',o.product,'requiredPcs',o.required_pcs,'requiredKg',o.required_kg,'status',o.status,'reportedBy',o.reported_by,'confirmedBy',o.confirmed_by,'sackIds',coalesce((select jsonb_agg(sack_id) from public.loading_order_sacks where order_id=o.id),'[]'::jsonb)) order by o.id),'[]'::jsonb) from public.loading_orders o),
 'movements',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'at',m.created_at,'sackId',m.sack_id,'kind',m.kind,'operator',coalesce(p.display_name,'Demo seed'),'room',l.chamber_id,'pcs',m.delta_pcs,'kg',m.delta_kg) order by m.created_at desc),'[]'::jsonb) from public.inventory_ledger m left join public.storage_locations l on l.id=m.location_id left join public.profiles p on p.id=m.actor),
 'config',(select jsonb_build_object('abfCount',abf_count,'abfTarget',abf_target,'abfHours',abf_hours,'expiryDays',expiry_days,'productExpiry',product_expiry,'racks',racks,'levels',levels,'slots',slots) from public.facility_config where id)
 ) into result;
 return result;
end $$;
revoke all on function public.csms_snapshot() from public;
grant execute on function public.csms_snapshot() to authenticated;
create or replace function public.tick_csms_simulator() returns void language plpgsql security definer set search_path='' as $$
declare r record; v numeric; step numeric; diff numeric; state_quality text;
begin
 perform public.assert_csms_role(array['admin']);
 for r in select s.*,t.setpoint,t.warning,t.critical,d.sensor_id from public.simulator_states s join public.chambers c on c.id=s.chamber_id join public.temperature_thresholds t on t.chamber_id=s.chamber_id join public.device_channels d on d.chamber_id=s.chamber_id where s.running and c.is_demo for update of s skip locked loop
 if r.last_update>now()-interval '3 seconds' then continue;end if;
 if r.scenario in ('offline','stale') then
 state_quality:=case r.scenario when 'offline' then 'terputus' else 'kedaluwarsa' end;
 update public.simulator_states set connected=(r.scenario<>'offline'),quality=state_quality where chamber_id=r.chamber_id;
 update public.temperature_alerts set resolved_at=now() where chamber_id=r.chamber_id and severity<>r.scenario and resolved_at is null;
 if not exists(select 1 from public.temperature_alerts where chamber_id=r.chamber_id and severity=r.scenario and resolved_at is null) then
 insert into public.temperature_alerts(chamber_id,severity,message) values(r.chamber_id,r.scenario,'Pembacaan sensor tidak tersedia (SIMULATED)');end if;
 continue;
 end if;
 diff:=r.setpoint-r.temperature;
 step:=case r.scenario when 'door' then .2 when 'rising' then .12 when 'alarm' then case when r.temperature<r.critical+1 then .4 else 0 end when 'normal' then sign(diff)*least(abs(diff),.12) when 'recovery' then sign(diff)*least(abs(diff),.32) else 0 end;
 v:=greatest(-60,least(20,round((r.temperature+step+case when r.scenario='manual' then 0 else (random()-.5)*r.noise end)::numeric,2)));
 update public.simulator_states set temperature=v,last_update=now(),connected=true,quality='baik' where chamber_id=r.chamber_id;
 insert into public.temperature_readings(chamber_id,sensor_id,temperature,source) values(r.chamber_id,r.sensor_id,v,'SIMULATED');
 end loop;
end $$;
revoke all on function public.tick_csms_simulator() from public;
grant execute on function public.tick_csms_simulator() to authenticated;
commit;
