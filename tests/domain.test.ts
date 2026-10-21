import test from "node:test";
import assert from "node:assert/strict";
import {
  createDemo,
  inventory,
  resolveSack,
  status,
  tickRoom,
  transition,
} from "../lib/domain";
test("exactly two rooms, independent sensors and 30 days of history", () => {
  const s = createDemo();
  assert.deepEqual(
    s.rooms.map((r) => r.id),
    ["CS-01", "CS-02"],
  );
  assert.equal(new Set(s.rooms.map((r) => r.sensor)).size, 2);
  assert.equal(s.rooms[0].history.length, 720);
  assert.equal(s.sacks.length, 500);
});
test("manual temperature and room alerts stay isolated", () => {
  const s = createDemo();
  const n = transition(s, {
    type: "room",
    id: "CS-01",
    patch: { temperature: -8, scenario: "manual" },
  });
  assert.equal(status(n.rooms[0]), "critical");
  assert.equal(status(n.rooms[1]), "normal");
  assert.deepEqual(n.rooms[1], s.rooms[1]);
  const n2 = transition(n, {
    type: "room",
    id: "CS-02",
    patch: { temperature: -5, scenario: "manual" },
  });
  assert.deepEqual(n2.rooms[0], n.rooms[0]);
});
test("offline and stale do not create fabricated readings", () => {
  const r = createDemo().rooms[0];
  for (const scenario of ["offline", "stale"] as const) {
    const n = tickRoom({ ...r, scenario }, new Date());
    assert.deepEqual(n.history, r.history);
    assert.equal(n.lastUpdate, r.lastUpdate);
    assert.equal(status(n), "offline");
  }
});
test("QR resolves unique sack", () => {
  const s = createDemo();
  assert.equal(resolveSack(s, "CSMS:KRG-00001")?.id, "KRG-00001");
  assert.equal(resolveSack(s, "missing"), undefined);
});
test("unsealed putaway and duplicate location rejected", () => {
  let s = createDemo();
  s = transition(s, {
    type: "batch",
    id: "NEW",
    product: "Kepala ikan",
    pcs: 100,
  });
  assert.throws(
    () =>
      transition(s, {
        type: "prepare",
        id: "NEW-S",
        owner: "Demo",
        product: "Kepala ikan",
        batch: "NEW",
        production: "2026-10-12",
      }),
    /diverifikasi/,
  );
  s = transition(s, { type: "verify", batch: "NEW", operator: "Office" });
  s = transition(s, {
    type: "prepare",
    id: "NEW-S",
    owner: "Demo",
    product: "Kepala ikan",
    batch: "NEW",
    production: "2026-10-12",
  });
  const put = {
    type: "putaway" as const,
    id: "NEW-S",
    room: "CS-02" as const,
    rack: 5,
    level: 3,
    slot: 20,
    operator: "Packing",
  };
  assert.throws(() => transition(s, put), /tersegel/);
  s = transition(s, { type: "pack", id: "NEW-S", pcs: 12 });
  s = transition(s, { type: "weigh", id: "NEW-S", kg: 20 });
  s = transition(s, { type: "seal", id: "NEW-S", operator: "Packing" });
  assert.throws(
    () => transition(s, { ...put, rack: 1, level: 1, slot: 1 }),
    /terisi/,
  );
  const before = inventory(s, "CS-02");
  s = transition(s, put);
  assert.equal(inventory(s, "CS-02").pcs, before.pcs + 12);
  assert.equal(s.sacks.at(-1)?.room, "CS-02");
  assert.equal(s.movements[0].kind, "Penempatan ke ruang");
});
test("dispatch needs report and decreases stock exactly once", () => {
  let s = createDemo();
  const before = inventory(s);
  const order = s.orders[0].id;
  assert.throws(
    () =>
      transition(s, {
        type: "scan",
        order,
        input: "KRG-00002",
        operator: "Loading",
      }),
    /sesuai/,
  );
  for (let i = 1; i <= 19; i += 2)
    s = transition(s, {
      type: "scan",
      order,
      input: `KRG-${String(i).padStart(5, "0")}`,
      operator: "Loading",
    });
  assert.deepEqual(inventory(s), before);
  assert.throws(
    () => transition(s, { type: "dispatch", order, operator: "Office" }),
    /laporan/,
  );
  s = transition(s, { type: "report", order, operator: "Loading" });
  s = transition(s, { type: "dispatch", order, operator: "Office" });
  assert.equal(inventory(s).pcs, before.pcs - 120);
  assert.equal(
    s.movements.reduce((n, m) => n + m.pcs, 0),
    inventory(s).pcs,
  );
  assert.equal(
    s.movements.reduce((n, m) => n + m.kg, 0),
    inventory(s).kg,
  );
  const count = s.movements.length;
  const repeated = transition(s, {
    type: "dispatch",
    order,
    operator: "Office",
  });
  assert.deepEqual(inventory(repeated), inventory(s));
  assert.equal(repeated.movements.length, count);
  assert.equal(repeated.orders[0].confirmedBy, "Office");
});
test("threshold validation and expiry product override", () => {
  let s = createDemo();
  assert.throws(
    () => transition(s, { type: "room", id: "CS-01", patch: { warning: 0 } }),
    /Ambang/,
  );
  s = transition(s, {
    type: "config",
    config: { ...s.config, productExpiry: { "Kepala ikan": 180 } },
  });
  s = transition(s, {
    type: "prepare",
    id: "CUSTOM",
    owner: "Demo",
    product: "Kepala ikan",
    batch: "BATCH-1",
    production: "2026-01-01",
  });
  assert.equal(s.sacks.at(-1)?.expiry, "2026-06-30");
});
test("all scenarios and pause work without hardware", () => {
  const room = createDemo().rooms[0];
  for (const scenario of [
    "normal",
    "stable",
    "door",
    "rising",
    "recovery",
    "alarm",
    "manual",
  ] as const) {
    const result = tickRoom({ ...room, scenario }, new Date(), () => 0.5);
    assert.ok(Number.isFinite(result.temperature));
    assert.equal(result.history.at(-1)?.source, "SIMULATED");
    if (scenario === "door" || scenario === "rising")
      assert.ok(result.temperature > room.temperature);
  }
  const paused = { ...room, running: false };
  assert.deepEqual(tickRoom(paused, new Date()), paused);
});
