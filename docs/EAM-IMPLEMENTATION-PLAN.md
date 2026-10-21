# EAM v4 implementation status

1. Repository and supplied photo inspected; existing CSMS retained at /legacy.
2. Normalized room reconstruction and assumptions documented in EAM-FLOOR-PLAN.md.
3. Procedural scene, minimap, focus presets, orbit/pan/zoom, fullscreen, walls, 2D fallback implemented.
4. ABF, packing/weighing/sewing stations, pallets, racks, sacks, forklift, truck and office props implemented.
5. Seven simulated workers, role labels, assumed corridor navigation, animations, tasks/history implemented.
6. Seeded, event-driven start/pause/reset/step/replay engine, 1/2/5/10x implemented.
7. Server-validated packing/master snapshots, manual KG, seal, palletization, putaway and ledger implemented.
8. Individual QR loading, cancellation, one-time dispatch, Surat Jalan implemented.
9. Five ABF + one unmapped CS, configurable directional thresholds, alarms and timers implemented.
10. Database persistence, migration, role checks, RLS, controlled mode transaction API, selective realtime subscription, tests and documentation implemented.

Remote prerequisites: apply Supabase migration, provision real Auth profiles and verified production master data, choose physical CS mapping. The remote migration is supplied and locally tested, not automatically executed. Live-read-only mode exposes the existing CSMS snapshot and legacy viewer; photo-to-live sensor mapping remains unverified. Initial 3D is procedural illustrative geometry, not a measured CAD/BIM model or validated evacuation/navigation system.
