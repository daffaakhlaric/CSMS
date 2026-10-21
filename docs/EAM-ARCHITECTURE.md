# EAM v4 architecture and deployment

## Routes and compatibility

`/` opens `/eam`. `/legacy` preserves the complete previous CSMS, including its two-room demo, Supabase login, AI score and chat. No legacy tables or inventory are rewritten. The new EAM workspace reflects the latest one-active-CS scope; the legacy screen is explicitly an earlier version.

## Domain and transactions

`lib/eam/engine.ts` contains Zod-validated commands, role permissions, deterministic seed, seven scenarios plus combined walkthrough, invariants and state transitions. Quantities are master-product snapshots; KG is manual. A sack has one active pallet pointer. Loading clears that pointer while recording original pallet/location. Cancellation restores it. Pending-loading pallets cannot be moved, preserving the return location. Dispatch is terminal and idempotent, writes negative ledger entries once, and creates a delivery document. Animations never trigger domain transitions.

The run is one atomic aggregate. Backend PostgreSQL serializes writes with row locking and revision checks; request UUIDs have unique constraints for retry idempotency. This intentionally uses an event log + JSONB aggregate rather than duplicating every legacy table with incompatible definitions. Domain checks occur in the trusted server before the aggregate commit. Supabase offers security-invoker relational projections for products, sacks and pallets. This is a functional first implementation, not a normalized replacement of the legacy warehouse schema.

## Storage modes

- DEMO_SIMULATION: PGlite PostgreSQL in `.data/eam`, only fictitious data; persisted across browser/server restarts. Browser stores only run UUID. Role dropdown emulates seven staff roles; server enforces the selected demo role. It is not employee authentication. Run reset replaces the demo aggregate but keeps the database audit log.
- LIVE_READ_ONLY: requires Supabase Auth and existing `csms_snapshot` permissions; reads the existing CSMS snapshot without writes, offers the legacy operational viewer. The photo-to-live sensor mapping cannot be inferred, so the legacy two-channel snapshot is not relabeled as six verified EAM channels.
- CONTROLLED_OPERATIONAL: requires Supabase Auth; role is read from profiles, never trusted from the browser. Install migration `202610130001_eam.sql` first. A SUPER_ADMIN may explicitly create an empty workspace. Enter real owners/products/batches, complete/verify batches and confirm room mapping. No sample inventory is imported. Simulation `tick`/`control` are blocked. Monitoring initially disconnected; hardware integration remains deferred.

## Supabase setup

Run existing migrations then `202610130001_eam.sql` in Supabase SQL Editor. The migration is additive except expanding the existing profile role constraint. It creates `eam_operational_runs`, `eam_operational_events`, projections, RLS, the service-only `eam_commit` transaction and a selective realtime publication. Direct authenticated writes and direct client RPC commits are denied. The server validates JWT with getUser, resolves profile, applies domain permissions, then uses service-only RPC. DB also checks actor permissions. Service role key never reaches the browser.

Assign real Auth users a role using the existing profiles table. Seven demo roles are represented by simulated role selection, not fake Auth users or shared passwords. Do not seed privileged production users automatically. Example after creating the Auth user:

```sql
insert into public.profiles(id,display_name,role)
values ('AUTH-USER-UUID','Operator EAM','CS_OPERATOR');
```

Service role / anon credentials cannot execute arbitrary SQL migrations through the Data API. This task supplies and tests the migration locally; it does not claim to have applied the migration to the user's remote Supabase project.

## Scene and performance

Configurable normalized zones follow the evacuation photo. A cutaway renders support spaces, five ABF equipment points, racks, pallets, instanced sacks, truck, forklift and seven stylized workers. Repeated sacks use instancing; projection labels update DOM transforms without React render per frame. Lazy Canvas, capped DPR, simple geometries, optional labels/walls and a 2D fallback limit load. Workers follow assumed doors/Anteroom polylines; layout edits are unmeasured assumptions, not validated building navigation. Minimap, click/double-click focus, smooth overview/presets and fullscreen are provided.

## AI

The EAM assistant uses the existing server-only OpenAI key. Snapshot contains EAM inventory, pallets, events and six simulated channels. It cannot mutate inventory. Prior temperature-score functionality remains available in `/legacy`. No API key, secret or real employee location is shown in 3D.

## Operational limits

Initial deployment binds localhost. The local demo database is a single-process store; do not run multiple application instances against the same `.data/eam` directory. For VPS access, replace the localhost origin guard with authenticated deployment-origin checks and add distributed rate limits, backups and session management. Live spatial mapping, real dimensions/doors, physical sensor wiring and evacuation correctness require site verification. ABF timers are compressed demonstration timers, not validated freezing recipes. No actual device control, digital scale transport, employee location tracking, or reverse Loading→ABF workflow is implemented.
