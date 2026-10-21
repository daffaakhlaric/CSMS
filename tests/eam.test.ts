import test from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  operate,
  totals,
  contents,
  assertState,
  expiry,
} from "../lib/eam/engine";
const setup = () =>
  operate(
    seedState(),
    { type: "configure", activeCS: "cs-large", machineCount: 4 },
    "SUPER_ADMIN",
  );
test("EAM seed: one unmapped CS, 5 ABF, 100 sacks, 10 pallets and master snapshots", () => {
  const s = seedState();
  assertState(s);
  assert.equal(s.activeCS, null);
  assert.equal(s.channels.length, 6);
  assert.equal(s.products.length, 30);
  assert.equal(s.owners.length, 3);
  assert.equal(s.sacks.length, 100);
  assert.equal(s.pallets.length, 10);
  assert.equal(contents(s, "PLT-001").length, 30);
  assert.ok(
    s.sacks.every(
      (sk) => sk.pcs === s.products.find((p) => p.id === sk.product)!.pcs,
    ),
  );
  assert.throws(
    () => operate(s, { type: "control", action: "start" }, "SUPER_ADMIN"),
    /memetakan/,
  );
});
test("partial loading 30→20, cancellation 21, dispatch 9 exact once", () => {
  let s = setup();
  const original = totals(s);
  for (let i = 1; i <= 10; i++)
    s = operate(
      s,
      {
        type: "load",
        order: "LOAD-001",
        sack: `SK-${String(i).padStart(5, "0")}`,
      },
      "ADMIN_LOADING",
    );
  assert.equal(contents(s, "PLT-001").length, 20);
  assert.equal(totals(s).sacks, 100);
  assert.equal(totals(s).available, 90);
  assert.throws(
    () =>
      operate(
        s,
        { type: "load", order: "LOAD-001", sack: "SK-00001" },
        "ADMIN_LOADING",
      ),
    /stok tersedia/,
  );
  s = operate(
    s,
    { type: "cancel", order: "LOAD-001", sack: "SK-00010", confirmed: true },
    "ADMIN_LOADING",
  );
  assert.equal(contents(s, "PLT-001").length, 21);
  assert.equal(totals(s).available, 91);
  assert.equal(s.sacks[9].location, "R1-L1-S1");
  assert.throws(
    () => operate(s, { type: "dispatch", order: "LOAD-001" }, "ADMIN_PACKING"),
    /Peran/,
  );
  s = operate(s, { type: "dispatch", order: "LOAD-001" }, "ADMIN_LOADING");
  assert.equal(totals(s).sacks, 91);
  assert.equal(s.orders[0].document!.sacks, 9);
  assert.equal(s.orders[0].document!.pcs, 90);
  assert.equal(totals(s).pcs, original.pcs - 90);
  const again = operate(
    s,
    { type: "dispatch", order: "LOAD-001" },
    "ADMIN_LOADING",
  );
  assert.deepEqual(again, s);
  assert.throws(
    () =>
      operate(
        s,
        {
          type: "cancel",
          order: "LOAD-001",
          sack: "SK-00001",
          confirmed: true,
        },
        "ADMIN_LOADING",
      ),
    /Pembatalan/,
  );
});
test("packing snapshots, month expiry, pallet uniqueness and putaway ledger", () => {
  let s = setup();
  s = operate(
    s,
    {
      type: "pack",
      product: "PRD-001",
      owner: s.owners[0],
      batch: "BATCH-001",
      kg: 20.5,
      production: "2026-01-31",
    },
    "ADMIN_PACKING",
  );
  const sk = s.sacks.at(-1)!;
  assert.equal(sk.pcs, 10);
  assert.equal(expiry("2026-01-31", 1), "2026-02-28");
  s = operate(
    s,
    {
      type: "product",
      id: "PRD-001",
      name: "Test",
      pcs: 25,
      months: 12,
      active: true,
    },
    "SUPER_ADMIN",
  );
  assert.equal(s.sacks.at(-1)!.pcs, 10);
  s = operate(s, { type: "palletCreate" }, "CS_OPERATOR");
  assert.throws(
    () =>
      operate(
        s,
        { type: "assign", sack: sk.id, pallet: "PLT-011" },
        "CS_OPERATOR",
      ),
    /tersegel/,
  );
  s = operate(s, { type: "seal", sack: sk.id }, "ADMIN_PACKING");
  s = operate(
    s,
    { type: "assign", sack: sk.id, pallet: "PLT-011" },
    "CS_OPERATOR",
  );
  assert.throws(
    () =>
      operate(
        s,
        { type: "assign", sack: sk.id, pallet: "PLT-010" },
        "CS_OPERATOR",
      ),
    /tersegel/,
  );
  s = operate(s, { type: "palletConfirm", pallet: "PLT-011" }, "CS_OPERATOR");
  s = operate(
    s,
    { type: "putaway", pallet: "PLT-011", location: "R3-L1-S1" },
    "CS_OPERATOR",
  );
  assert.equal(totals(s).sacks, 101);
  assertState(s);
});
test("all seven scenarios deterministic, replay and directional alarm", () => {
  for (let scenario = 0; scenario <= 7; scenario++) {
    const run = () => {
      let s = operate(
        setup(),
        { type: "control", action: "start", scenario },
        "SUPER_ADMIN",
      );
      for (let i = 0; i < 150 && s.running; i++)
        s = operate(s, { type: "tick" }, "SUPER_ADMIN");
      assertState(s);
      return s;
    };
    assert.deepEqual(run(), run());
  }
  let s = operate(
    setup(),
    {
      type: "channel",
      id: "ABF-01",
      threshold: -25,
      direction: "below",
      target: -20,
      connected: true,
    },
    "TEMPERATURE_MONITOR",
  );
  s = operate(
    s,
    { type: "control", action: "start", scenario: 7, speed: 5 },
    "SUPER_ADMIN",
  );
  s = operate(s, { type: "tick" }, "SUPER_ADMIN");
  assert.equal(s.channels[0].alarm, true);
  assert.ok(s.channels[0].value < -25);
  s = operate(s, { type: "control", action: "pause" }, "SUPER_ADMIN");
  const clock = s.clock;
  s = operate(s, { type: "tick" }, "SUPER_ADMIN");
  assert.equal(s.clock, clock);
});

import { allowed } from "../lib/eam/engine";
import { menuFor } from "../lib/eam/access";
test("packing and loading roles restrict menus and backend operations", () => {
  assert.deepEqual(menuFor("ADMIN_PACKING"), ["Operasional", "Inventori"]);
  assert.deepEqual(menuFor("ADMIN_LOADING"), ["Pemuatan", "Inventori"]);
  for (const action of ["pack", "seal", "assign", "palletConfirm"] as const)
    assert.equal(allowed("ADMIN_PACKING", action), true);
  for (const action of [
    "palletCreate",
    "product",
    "dispatch",
    "putaway",
    "load",
  ] as const)
    assert.equal(allowed("ADMIN_PACKING", action), false);
  assert.equal(allowed("ADMIN_LOADING", "load"), true);
  assert.equal(allowed("ADMIN_LOADING", "pack"), false);
  assert.throws(() =>
    operate(seedState(), { type: "palletCreate" }, "ADMIN_PACKING"),
  );
});
