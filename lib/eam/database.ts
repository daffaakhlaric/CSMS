import { PGlite } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { EamState, operate, Role, seedState, Command } from "./engine";
type RecordRow = { id: string; revision: number; state: EamState };
const globalDb = globalThis as unknown as {
  eamDb?: Promise<PGlite>;
  eamQueue?: Promise<unknown>;
};
export async function database() {
  if (!globalDb.eamDb)
    globalDb.eamDb = (async () => {
      const dir = path.join(process.cwd(), ".data", "eam");
      await mkdir(dir, { recursive: true });
      const db = new PGlite(dir);
      await db.exec(
        `create table if not exists simulation_runs(id text primary key,revision integer not null,state jsonb not null,updated_at timestamptz not null default now());create table if not exists simulation_events(id bigint generated always as identity primary key,run_id text references simulation_runs,request_id text not null,revision integer not null,command jsonb not null,actor text not null,created_at timestamptz not null default now(),unique(run_id,request_id));`,
      );
      return db;
    })();
  return globalDb.eamDb;
}
export async function localRun(id: string) {
  const db = await database();
  await db.query(
    "insert into simulation_runs(id,revision,state) values($1,0,$2) on conflict do nothing",
    [id, JSON.stringify(seedState())],
  );
  return (
    await db.query<RecordRow>(
      "select id,revision,state from simulation_runs where id=$1",
      [id],
    )
  ).rows[0];
}
export async function localCommand(
  id: string,
  revision: number,
  command: Command,
  role: Role,
  requestId: string,
) {
  const task = async () => {
    const db = await database();
    return db.transaction(async (tx) => {
      const row = (
        await tx.query<RecordRow>(
          "select id,revision,state from simulation_runs where id=$1 for update",
          [id],
        )
      ).rows[0];
      if (!row) throw Error("Run tidak ditemukan");
      if (
        (
          await tx.query(
            "select id from simulation_events where run_id=$1 and request_id=$2",
            [id, requestId],
          )
        ).rows.length
      )
        return row;
      if (row.revision !== revision)
        throw Error("CONFLICT: data berubah; muat ulang dan coba lagi");
      const state = operate(row.state, command, role);
      await tx.query(
        "update simulation_runs set state=$2,revision=revision+1,updated_at=now() where id=$1",
        [id, JSON.stringify(state)],
      );
      await tx.query(
        "insert into simulation_events(run_id,request_id,revision,command,actor) values($1,$2,$3,$4,$5)",
        [id, requestId, revision + 1, JSON.stringify(command), role],
      );
      return { ...row, state, revision: revision + 1 };
    });
  };
  const promise = (globalDb.eamQueue || Promise.resolve())
    .catch(() => {})
    .then(task);
  globalDb.eamQueue = promise;
  return promise;
}
