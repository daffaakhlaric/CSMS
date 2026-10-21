import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL migrations, RLS, role boundaries, ledger and idempotent dispatch", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
    for (const file of [
      "202610120001_csms.sql",
      "202610120002_snapshot_simulation.sql",
    ]) {
      const sql = await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      );
      // PGlite includes gen_random_uuid in core; Supabase installs pgcrypto in its real environment.
      await db.exec(
        sql.replace("create extension if not exists pgcrypto;", ""),
      );
    }
    await db.exec(
      await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
    );
    const rows = await db.query<{ n: number }>(
      "select count(*)::int n from public.sacks",
    );
    assert.equal(rows.rows[0].n, 500);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.temperature_readings",
        )
      ).rows[0].n,
      1440,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.device_channels where chamber_id is not null",
        )
      ).rows[0].n,
      2,
    );
    await db.exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004');
 insert into public.profiles values('00000000-0000-4000-8000-000000000001','Office Test','office'),('00000000-0000-4000-8000-000000000002','Loading Test','loading'),('00000000-0000-4000-8000-000000000003','Packing Test','packing'),('00000000-0000-4000-8000-000000000004','Admin Test','admin');`);
    const role = async (id: string) => {
      await db.exec(
        `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
      );
    };
    const op = async (a: Record<string, unknown>) =>
      db.query("select public.csms_operate($1::jsonb)", [JSON.stringify(a)]);
    const office = "00000000-0000-4000-8000-000000000001",
      loading = "00000000-0000-4000-8000-000000000002",
      packing = "00000000-0000-4000-8000-000000000003",
      admin = "00000000-0000-4000-8000-000000000004";
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from public.sacks"),
      /permission denied/,
    );
    await role("");
    assert.equal((await db.query("select * from public.sacks")).rows.length, 0);
    await role(packing);
    await assert.rejects(
      db.query("update public.sacks set pcs=999 where id='KRG-00001'"),
      /permission denied/,
    );
    await assert.rejects(op({ type: "verify", batch: "BATCH-1" }), /Akses/);
    await op({ type: "batch", id: "QA", product: "Kepala ikan", pcs: 100 });
    await assert.rejects(
      op({
        type: "prepare",
        id: "QA-S",
        owner: "Demo",
        product: "Kepala ikan",
        batch: "QA",
        production: "2026-10-12",
      }),
      /terverifikasi/,
    );
    await role(office);
    await op({ type: "verify", batch: "QA" });
    await role(packing);
    await op({
      type: "prepare",
      id: "QA-S",
      owner: "Demo",
      product: "Kepala ikan",
      batch: "QA",
      production: "2026-10-12",
    });
    await assert.rejects(
      op({
        type: "putaway",
        id: "QA-S",
        room: "CS-02",
        rack: 5,
        level: 3,
        slot: 20,
      }),
      /tersegel/,
    );
    await op({ type: "pack", id: "QA-S", pcs: 12 });
    await op({ type: "weigh", id: "QA-S", kg: 20 });
    await op({ type: "seal", id: "QA-S" });
    await assert.rejects(
      op({
        type: "putaway",
        id: "QA-S",
        room: "CS-02",
        rack: 1,
        level: 1,
        slot: 1,
      }),
      /unique/,
    );
    await op({
      type: "putaway",
      id: "QA-S",
      room: "CS-02",
      rack: 5,
      level: 3,
      slot: 20,
    });
    await role(loading);
    await assert.rejects(
      db.query("select public.confirm_dispatch('EXP-2026-001')"),
      /Akses/,
    );
    await assert.rejects(
      op({ type: "scan", order: "EXP-2026-001", input: "KRG-00002" }),
      /sesuai/,
    );
    for (let i = 1; i <= 19; i += 2)
      await op({
        type: "scan",
        order: "EXP-2026-001",
        input: "CSMS:KRG-" + String(i).padStart(5, "0"),
      });
    await op({ type: "report", order: "EXP-2026-001" });
    await role(office);
    const one = await db.query("select public.confirm_dispatch($1) id", [
      "EXP-2026-001",
    ]);
    const two = await db.query("select public.confirm_dispatch($1) id", [
      "EXP-2026-001",
    ]);
    assert.deepEqual(one.rows, two.rows);
    const outbound = await db.query<{ pcs: number; n: number }>(
      "select sum(delta_pcs)::int pcs,count(*)::int n from public.inventory_ledger where kind='Konfirmasi pengiriman'",
    );
    assert.equal(outbound.rows[0].pcs, -120);
    assert.equal(outbound.rows[0].n, 10);
    const snapshot = await db.query<{
      state: { rooms: unknown[]; sacks: unknown[] };
    }>("select public.csms_snapshot() state");
    assert.equal(snapshot.rows[0].state.rooms.length, 2);
    assert.equal(snapshot.rows[0].state.sacks.length, 501);
    await role(admin);
    await op({
      type: "room",
      id: "CS-01",
      patch: { temperature: -8, scenario: "manual" },
    });
    const alarms = await db.query<{ chamber_id: string }>(
      "select chamber_id from public.temperature_alerts where resolved_at is null",
    );
    assert.deepEqual(
      alarms.rows.map((x) => x.chamber_id),
      ["CS-01"],
    );
    await db.exec(
      "reset role;update public.simulator_states set last_update=now()-interval '10 seconds';set role authenticated;",
    );
    await db.query("select public.tick_csms_simulator()");
    await assert.rejects(
      db.query(
        "select public.ingest_temperature('TEMP-CS-01',-20,now(),gen_random_uuid())",
      ),
      /permission denied/,
    );
    await db.exec(
      "reset role;grant usage on schema public to service_role;set role service_role;",
    );
    await assert.rejects(
      db.query(
        "select public.ingest_temperature('TEMP-CS-01',-20,now(),gen_random_uuid())",
      ),
      /belum diverifikasi/,
    );
    await db.exec(
      `reset role;update public.chambers set is_demo=false where id='CS-01';update public.devices set configuration='{"manual_verified":true}';set role service_role;`,
    );
    for (let i = 0; i < 2; i++)
      await db.query(
        "select public.ingest_temperature('TEMP-CS-01',-20,now()+interval '1 second','11111111-1111-4111-8111-111111111111')",
      );
    await role(admin);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.temperature_readings where source='HARDWARE'",
        )
      ).rows[0].n,
      1,
    );
    const hardwareSnapshot = await db.query<{
      state: {
        rooms: {
          id: string;
          running: boolean;
          history: { source: string }[];
        }[];
      };
    }>("select public.csms_snapshot() state");
    const hardwareRoom = hardwareSnapshot.rows[0].state.rooms.find(
      (r) => r.id === "CS-01",
    )!;
    assert.equal(hardwareRoom.running, false);
    assert.equal(hardwareRoom.history.at(-1)?.source, "HARDWARE");
  } finally {
    await db.close();
  }
});
