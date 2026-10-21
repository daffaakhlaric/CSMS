-- Fictional demo only. Explicitly refuse to mix into an existing operational facility.
begin;
do $$ begin
 if exists(select 1 from public.chambers) or exists(select 1 from public.sacks) then raise exception 'Seed hanya boleh dijalankan pada basis data demo kosong';end if;
end $$;
insert into public.facility_config(id) values(true) on conflict do nothing;
insert into public.chambers(id,name,kind,is_demo,layout) values
 ('CS-01','Cold Storage 01','cold_storage',true,'{"x":-6,"z":-3,"width":10,"depth":11,"demonstration_only":true}'),
 ('CS-02','Cold Storage 02','cold_storage',true,'{"x":6,"z":-3,"width":10,"depth":11,"demonstration_only":true}') on conflict do nothing;
insert into public.devices(id,model,is_demo,configuration) values('PTA8D08-DEMO-01','PTA8D08 8-channel PT100',true,'{"mapping":"provisional","manual_verified":false}') on conflict do nothing;
insert into public.device_channels(device_id,channel,chamber_id,sensor_id)
 select 'PTA8D08-DEMO-01',n,case when n<=2 then 'CS-0'||n end,case when n<=2 then 'TEMP-CS-0'||n end from generate_series(1,8) n on conflict do nothing;
insert into public.temperature_thresholds(chamber_id,setpoint) values('CS-01',-20),('CS-02',-19) on conflict do nothing;
insert into public.simulator_states(chamber_id,temperature) values('CS-01',-20.4),('CS-02',-18.7) on conflict do nothing;
insert into public.storage_locations(chamber_id,rack,level,slot) select c.id,r,l,s from public.chambers c cross join generate_series(1,5) r cross join generate_series(1,3) l cross join generate_series(1,20) s where c.id in ('CS-01','CS-02') on conflict do nothing;
insert into public.production_batches(id,product,pcs,verified) values('BATCH-1','Kepala ikan',3000,true),('BATCH-2','Daging ikan tanpa tulang',3000,true) on conflict do nothing;
insert into public.sacks(id,qr,owner,product,batch_id,production_date,expiry_date,pcs,kg,status,location_id,sealed_at)
 select 'KRG-'||lpad((n+1)::text,5,'0'),'CSMS:KRG-'||lpad((n+1)::text,5,'0'),case when n%2=0 then 'PT Laut Biru Nusantara' else 'CV Samudra Pangan' end,
 case when n%2=0 then 'Kepala ikan' else 'Daging ikan tanpa tulang' end,'BATCH-'||(n%2+1),current_date,current_date+365,12,20+(n%5)*.25,'tersimpan',l.id,now()
 from generate_series(0,499) n join public.storage_locations l on l.chamber_id=case when n<250 then 'CS-01' else 'CS-02' end and l.rack=(n%250)/60+1 and l.level=((n%250)%60)/20+1 and l.slot=(n%250)%20+1 on conflict(id) do nothing;
insert into public.inventory_ledger(sack_id,kind,location_id,delta_pcs,delta_kg,event_key) select id,'Penempatan awal demo',location_id,pcs,kg,'seed:'||id from public.sacks where id like 'KRG-%' on conflict(event_key) do nothing;
insert into public.loading_orders(id,customer,product,required_pcs,required_kg) values('EXP-2026-001','Ocean Foods • Singapura','Kepala ikan',120,200),('EXP-2026-002','Pacific Frozen • Jepang','Daging ikan tanpa tulang',60,100) on conflict do nothing;
insert into public.temperature_readings(chamber_id,sensor_id,temperature,recorded_at,source)
 select c.chamber_id,c.sensor_id,(case c.channel when 1 then -20 else -19 end)+sin(h*.36+c.channel)*.6,now()-(719-h)*interval '1 hour','SIMULATED'
 from public.device_channels c cross join generate_series(0,719) h where c.chamber_id is not null and not exists(select 1 from public.temperature_readings t where t.chamber_id=c.chamber_id);
insert into public.temperature_alerts(id,chamber_id,severity,message,opened_at,resolved_at,source) values
 ('10000000-0000-4000-8000-000000000001','CS-01','warning','Contoh demo: pintu terbuka',now()-interval '2 days',now()-interval '2 days'+interval '15 minutes','SIMULATED'),
 ('10000000-0000-4000-8000-000000000002','CS-02','offline','Contoh demo: sensor terputus',now()-interval '1 day',now()-interval '1 day'+interval '10 minutes','SIMULATED') on conflict do nothing;
commit;
