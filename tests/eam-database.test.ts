import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { seedState } from "../lib/eam/engine";
test("EAM Supabase RLS blocks writes, service commits enforce actor role, locking revision and idempotency", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon;`,
    );
    for (const name of [
      "202610120001_csms.sql",
      "202610130001_eam.sql",
      "202610150001_loading_dispatch.sql",
    ]) {
      const sql = await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      );
      await db.exec(
        sql.replace("create extension if not exists pgcrypto;", ""),
      );
    }
    const admin = "00000000-0000-4000-8000-000000000001",
      loading = "00000000-0000-4000-8000-000000000002",
      run = "00000000-0000-4000-8000-000000000003",
      request = "00000000-0000-4000-8000-000000000004";
    await db.exec(
      `insert into auth.users values('${admin}'),('${loading}');insert into public.profiles values('${admin}','Demo admin','SUPER_ADMIN'),('${loading}','Demo loading','ADMIN_LOADING');`,
    );
    await db.query(
      "insert into public.eam_operational_runs(id,state) values($1,$2)",
      [run, JSON.stringify(seedState())],
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${loading}',false);set role authenticated;`,
    );
    assert.equal(
      (await db.query("select * from public.eam_operational_runs")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update public.eam_operational_runs set revision=99"),
      /permission denied/,
    );
    const commit = (
      rev: number,
      actor: string,
      key = request,
      type = "configure",
    ) =>
      db.query("select public.eam_commit($1,$2,$3,$4,$5,$6)", [
        run,
        rev,
        JSON.stringify(seedState()),
        key,
        JSON.stringify({ type }),
        actor,
      ]);
    await assert.rejects(commit(0, admin), /permission denied/);
    await db.exec("reset role;set role service_role");
    await assert.rejects(commit(0, loading), /Forbidden/);
    await commit(0, admin);
    await commit(0, admin);
    await assert.rejects(
      commit(0, admin, "00000000-0000-4000-8000-000000000005"),
      /Revision conflict/,
    );
    await assert.rejects(
      commit(1, admin, "00000000-0000-4000-8000-000000000006", "tick"),
      /Simulation prohibited/,
    );
    await assert.rejects(
      commit(1, loading, "00000000-0000-4000-8000-000000000007", "verify"),
      /Forbidden/,
    );
    await commit(
      1,
      loading,
      "00000000-0000-4000-8000-000000000008",
      "dispatch",
    );
    await commit(
      1,
      loading,
      "00000000-0000-4000-8000-000000000008",
      "dispatch",
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.eam_operational_events",
        )
      ).rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
