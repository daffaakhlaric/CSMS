import { z } from "zod";
import { Zone, zones } from "./layout";
export const roles = [
  "SUPER_ADMIN",
  "SUPERVISOR",
  "ADMIN_PACKING",
  "ADMIN_OFFICE",
  "CS_OPERATOR",
  "ADMIN_LOADING",
  "TEMPERATURE_MONITOR",
] as const;
export type Role = (typeof roles)[number];
export type Product = {
  id: string;
  name: string;
  category: string;
  pcs: number;
  months: number;
  active: boolean;
};
export type Sack = {
  id: string;
  qr: string;
  product: string;
  owner: string;
  batch: string;
  pcs: number;
  kg: number;
  production: string;
  expiry: string;
  status:
    "PACKED" | "SEALED" | "PALLETIZED" | "STORED" | "LOADING" | "DISPATCHED";
  pallet: string | null;
  location: string | null;
};
export type Pallet = {
  id: string;
  qr: string;
  location: string | null;
  confirmed: boolean;
};
export type LoadItem = {
  sack: string;
  pallet: string;
  location: string;
  cancelled: boolean;
};
export type Order = {
  id: string;
  truck: string;
  destination: string;
  owner: string;
  items: LoadItem[];
  dispatched: boolean;
  document?: {
    number: string;
    at: string;
    approvedBy: string;
    sacks: number;
    pcs: number;
    kg: number;
    products: string[];
  };
};
export type Channel = {
  id: string;
  zone: string;
  value: number;
  target: number;
  threshold: number;
  direction: "above" | "below";
  connected: boolean;
  last: number;
  alarm: boolean;
  ack: boolean;
  timer: number;
  history: { at: number; value: number }[];
};
export type Worker = {
  manual?: boolean;
  id: string;
  role: string;
  zone: string;
  from: string;
  task: string;
  status: string;
  started: number;
  history: string[];
};
export type Event = {
  id: string;
  at: number;
  kind: string;
  detail: string;
  actor: string;
};
export type EamState = {
  version: number;
  seed: number;
  clock: number;
  running: boolean;
  speed: number;
  scenario: number;
  cursor: number;
  activeCS: "cs-large" | "cs-small" | null;
  machineCount: number;
  layout: Zone[];
  products: Product[];
  owners: string[];
  sacks: Sack[];
  pallets: Pallet[];
  orders: Order[];
  channels: Channel[];
  workers: Worker[];
  events: Event[];
  ledger: { sack: string; kind: string; pcs: number; kg: number; at: number }[];
  membership: {
    sack: string;
    from: string | null;
    to: string | null;
    kind: string;
    at: number;
  }[];
  opname: {
    id: string;
    expected: string[];
    scanned: string[];
    closed: boolean;
  }[];
  batches: {
    id: string;
    product: string;
    verified: boolean;
    completed: boolean;
  }[];
  discrepancies: { sack: string; old: number; pcs: number; reason: string }[];
};
export const scenarioNames = [
  "Alur lengkap 30 → 20 → 21 → 9",
  "Produksi ABF",
  "Packing dari master",
  "Palletisasi 5 karung",
  "Loading parsial 10 dari 30",
  "Batalkan 1 loading",
  "Dispatch 9 karung",
  "Alarm ABF",
];
export function expiry(production: string, months: number) {
  const d = new Date(production + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
function random(seed: number) {
  return ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
export function seedState(seed = 20261013): EamState {
  const products = Array.from({ length: 30 }, (_, i) => ({
    id: `PRD-${String(i + 1).padStart(3, "0")}`,
    name:
      [
        "Ayam utuh",
        "Fillet dada",
        "Paha ayam",
        "Sayap",
        "Karkas",
        "Daging giling",
      ][i % 6] + ` grade ${Math.floor(i / 6) + 1}`,
    category: "Unggas beku",
    pcs: [10, 12, 20, 24, 8][i % 5],
    months: 12,
    active: true,
  }));
  const owners = [
    "PT Unggas Sejahtera (Fiktif)",
    "CV Pangan Beku (Fiktif)",
    "PT Agro Nusantara (Fiktif)",
  ];
  const pallets = Array.from({ length: 10 }, (_, i) => ({
    id: `PLT-${String(i + 1).padStart(3, "0")}`,
    qr: `EAM:PLT-${String(i + 1).padStart(3, "0")}`,
    location: `R${Math.floor(i / 5) + 1}-L1-S${(i % 5) + 1}`,
    confirmed: true,
  }));
  const sacks: Sack[] = Array.from({ length: 100 }, (_, i) => {
    const p = products[i < 30 ? 0 : i % 30],
      pallet = i < 30 ? 0 : Math.min(9, 1 + Math.floor((i - 30) / 8));
    return {
      id: `SK-${String(i + 1).padStart(5, "0")}`,
      qr: `EAM:SK-${String(i + 1).padStart(5, "0")}`,
      product: p.id,
      owner: owners[i < 30 ? 0 : i % 3],
      batch: p.id === products[0].id ? "BATCH-001" : `BATCH-${p.id}`,
      pcs: p.pcs,
      kg: Math.round((18 + random(seed + Math.imul(i, 7919)) * 7) * 100) / 100,
      production: "2026-10-13",
      expiry: expiry("2026-10-13", p.months),
      status: "STORED",
      pallet: pallets[pallet].id,
      location: pallets[pallet].location,
    };
  });
  const workerRoles = [
    "ABF Operator",
    "Packing Operator",
    "Cold Storage Operator",
    "Forklift Operator",
    "Loading Operator",
    "Supervisor",
    "Temperature Monitoring",
  ];
  return {
    version: 1,
    seed,
    clock: 0,
    running: false,
    speed: 1,
    scenario: 0,
    cursor: 0,
    activeCS: null,
    machineCount: 5,
    layout: structuredClone(zones),
    products,
    owners,
    sacks,
    pallets,
    orders: [
      {
        id: "LOAD-001",
        truck: "B 9001 DEMO",
        destination: "Gudang pelanggan demo",
        owner: owners[0],
        items: [],
        dispatched: false,
      },
    ],
    channels: Array.from({ length: 6 }, (_, i) => ({
      id: i < 5 ? `ABF-0${i + 1}` : "CS-01",
      zone: i < 5 ? `abf-${i + 1}` : "unmapped",
      value: i < 5 ? -35 : -20,
      target: i < 5 ? -35 : -20,
      threshold: i < 5 ? -25 : -16,
      direction: "above" as const,
      connected: true,
      last: 0,
      alarm: false,
      ack: false,
      timer: 0,
      history: [{ at: 0, value: i < 5 ? -35 : -20 }],
    })),
    workers: workerRoles.map((role, i) => ({
      id: `WK-0${i + 1}`,
      role,
      zone: [
        "abf-1",
        "packing",
        "anteroom",
        "anteroom",
        "loading",
        "office",
        "abf-3",
      ][i],
      from: [
        "abf-1",
        "packing",
        "anteroom",
        "anteroom",
        "loading",
        "office",
        "abf-3",
      ][i],
      task: "Menunggu tugas simulasi",
      status: "IDLE",
      started: 0,
      history: [],
    })),
    events: [],
    ledger: sacks.map((s) => ({
      sack: s.id,
      kind: "SEED",
      pcs: s.pcs,
      kg: s.kg,
      at: 0,
    })),
    membership: sacks.map((s) => ({
      sack: s.id,
      from: null,
      to: s.pallet,
      kind: "SEED",
      at: 0,
    })),
    opname: [
      {
        id: "OPN-001",
        expected: sacks.map((s) => s.id),
        scanned: [],
        closed: false,
      },
    ],
    batches: [
      {
        id: "BATCH-001",
        product: products[0].id,
        verified: true,
        completed: true,
      },
      {
        id: "BATCH-002",
        product: products[0].id,
        verified: false,
        completed: false,
      },
      ...products.slice(1).map((p) => ({
        id: `BATCH-${p.id}`,
        product: p.id,
        verified: true,
        completed: true,
      })),
    ],
    discrepancies: [],
  };
}
const id = z.string().min(1).max(100),
  short = z.string().min(1).max(180);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ownerCreate"), name: short }),
  z.object({ type: z.literal("batchCreate"), id, product: id }),
  z.object({ type: z.literal("batchComplete"), id }),
  z.object({ type: z.literal("opnameStart") }),
  z.object({
    type: z.literal("configure"),
    activeCS: z.enum(["cs-large", "cs-small"]).nullable(),
    machineCount: z.number().int().min(1).max(20),
  }),
  z.object({
    type: z.literal("zone"),
    id,
    x: z.number().min(0).max(100),
    z: z.number().min(0).max(110),
    w: z.number().min(2).max(40),
    d: z.number().min(2).max(40),
  }),
  z.object({
    type: z.literal("control"),
    action: z.enum(["start", "pause", "step", "reset", "replay"]),
    scenario: z.number().int().min(0).max(7).optional(),
    speed: z
      .union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)])
      .optional(),
  }),
  z.object({ type: z.literal("tick") }),
  z.object({ type: z.literal("verify"), batch: id }),
  z.object({
    type: z.literal("pack"),
    product: id,
    owner: short,
    batch: id,
    kg: z.number().positive().max(100),
    production: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({ type: z.literal("seal"), sack: id }),
  z.object({ type: z.literal("palletCreate") }),
  z.object({ type: z.literal("assign"), sack: id, pallet: id }),
  z.object({ type: z.literal("palletConfirm"), pallet: id }),
  z.object({
    type: z.literal("putaway"),
    pallet: id,
    location: z.string().regex(/^R[1-5]-L[1-3]-S([1-9]|10)$/),
  }),
  z.object({
    type: z.literal("order"),
    truck: short,
    destination: short,
    owner: short,
  }),
  z.object({ type: z.literal("load"), order: id, sack: id }),
  z.object({
    type: z.literal("cancel"),
    order: id,
    sack: id,
    confirmed: z.literal(true),
  }),
  z.object({ type: z.literal("dispatch"), order: id }),
  z.object({
    type: z.literal("channel"),
    id,
    threshold: z.number().min(-80).max(30),
    direction: z.enum(["above", "below"]),
    target: z.number().min(-80).max(10),
    connected: z.boolean(),
  }),
  z.object({ type: z.literal("ack"), id }),
  z.object({ type: z.literal("opnameScan"), sack: id }),
  z.object({ type: z.literal("opnameClose") }),
  z.object({
    type: z.literal("discrepancy"),
    sack: id,
    pcs: z.number().int().positive().max(1000),
    reason: short,
  }),
  z.object({
    type: z.literal("product"),
    id,
    name: short,
    pcs: z.number().int().positive().max(1000),
    months: z.number().int().min(1).max(60),
    active: z.boolean(),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
const permissions: Record<Command["type"], Role[]> = {
  ownerCreate: ["SUPER_ADMIN"],
  batchCreate: ["ADMIN_OFFICE", "SUPERVISOR"],
  batchComplete: ["SUPERVISOR"],
  opnameStart: ["CS_OPERATOR", "SUPERVISOR"],
  configure: ["SUPER_ADMIN"],
  zone: ["SUPER_ADMIN"],
  control: ["SUPER_ADMIN", "SUPERVISOR"],
  tick: ["SUPER_ADMIN", "SUPERVISOR"],
  verify: ["ADMIN_OFFICE", "SUPERVISOR"],
  pack: ["ADMIN_PACKING"],
  seal: ["ADMIN_PACKING"],
  palletCreate: ["CS_OPERATOR"],
  assign: ["CS_OPERATOR", "ADMIN_PACKING"],
  palletConfirm: ["CS_OPERATOR", "ADMIN_PACKING"],
  putaway: ["CS_OPERATOR"],
  order: ["ADMIN_LOADING"],
  load: ["ADMIN_LOADING"],
  cancel: ["ADMIN_LOADING"],
  dispatch: ["ADMIN_OFFICE", "SUPERVISOR", "ADMIN_LOADING"],
  channel: ["TEMPERATURE_MONITOR"],
  ack: ["TEMPERATURE_MONITOR"],
  opnameScan: ["CS_OPERATOR"],
  opnameClose: ["SUPERVISOR"],
  discrepancy: ["SUPERVISOR"],
  product: ["SUPER_ADMIN"],
};
export function allowed(role: Role, type: Command["type"]) {
  return role === "SUPER_ADMIN" || permissions[type].includes(role);
}
function requireThat(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function totals(s: EamState) {
  const physical = s.sacks.filter((a) =>
      ["STORED", "LOADING"].includes(a.status),
    ),
    available = physical.filter((a) => a.status === "STORED");
  return {
    sacks: physical.length,
    available: available.length,
    loading: physical.length - available.length,
    pallets: s.pallets.filter((p) => s.sacks.some((a) => a.pallet === p.id))
      .length,
    pcs: physical.reduce((n, a) => n + a.pcs, 0),
    kg: Number(physical.reduce((n, a) => n + a.kg, 0).toFixed(2)),
  };
}
export const contents = (s: EamState, pallet: string) =>
  s.sacks.filter((a) => a.pallet === pallet);
function event(s: EamState, kind: string, detail: string, actor: string) {
  s.events.push({
    id: `EV-${s.events.length + 1}`,
    at: s.clock,
    kind,
    detail,
    actor,
  });
}
function worker(
  s: EamState,
  index: number,
  zone: string,
  task: string,
  status: string,
) {
  const w = s.workers[index];
  w.from = w.zone;
  w.zone = zone;
  w.task = task;
  w.status = status;
  w.started = s.clock;
  w.manual = !s.running;
  w.history = [`${s.clock}s · ${task}`, ...w.history].slice(0, 30);
}
export function operate(
  state: EamState,
  raw: unknown,
  role: Role,
  actor: string = role,
): EamState {
  const a = commandSchema.parse(raw);
  requireThat(
    allowed(role, a.type),
    "Peran tidak diizinkan untuk tindakan ini",
  );
  let s = structuredClone(state);
  const sack = (value: string) => {
    const found = s.sacks.find((x) => x.id === value || x.qr === value);
    requireThat(found, "QR karung tidak ditemukan");
    return found;
  };
  const pallet = (value: string) => {
    const found = s.pallets.find((x) => x.id === value || x.qr === value);
    requireThat(found, "QR palet tidak ditemukan");
    return found;
  };
  const order = (value: string) => {
    const found = s.orders.find((x) => x.id === value);
    requireThat(found, "Order tidak ditemukan");
    return found;
  };
  switch (a.type) {
    case "ownerCreate":
      requireThat(!s.owners.includes(a.name), "Pemilik sudah ada");
      s.owners.push(a.name);
      break;
    case "batchCreate":
      requireThat(
        !s.batches.some((b) => b.id === a.id) &&
          s.products.some((p) => p.id === a.product && p.active),
        "Batch duplikat atau produk tidak aktif",
      );
      s.batches.push({
        id: a.id,
        product: a.product,
        verified: false,
        completed: false,
      });
      break;
    case "batchComplete": {
      const b = s.batches.find((b) => b.id === a.id);
      requireThat(b, "Batch tidak ditemukan");
      b.completed = true;
      break;
    }
    case "opnameStart":
      s.opname.push({
        id: `OPN-${s.opname.length + 1}`,
        expected: s.sacks
          .filter((sk) => sk.status === "STORED")
          .map((sk) => sk.id),
        scanned: [],
        closed: false,
      });
      break;
    case "configure":
      s.activeCS = a.activeCS;
      s.machineCount = a.machineCount;
      s.channels[5].zone = a.activeCS || "unmapped";
      break;
    case "zone": {
      const zone = s.layout.find((x) => x.id === a.id);
      requireThat(zone, "Zona tidak ditemukan");
      requireThat(a.x + a.w <= 105 && a.z + a.d <= 110, "Zona di luar denah");
      Object.assign(zone, { x: a.x, z: a.z, w: a.w, d: a.d });
      break;
    }
    case "control": {
      if (["reset", "replay"].includes(a.action)) {
        const fresh = seedState(s.seed);
        fresh.activeCS = s.activeCS;
        fresh.layout = s.layout;
        fresh.machineCount = s.machineCount;
        fresh.channels[5].zone = s.activeCS || "unmapped";
        fresh.scenario = a.scenario ?? s.scenario;
        fresh.speed = a.speed ?? s.speed;
        s = fresh;
      }
      if (a.scenario !== undefined) {
        requireThat(
          s.cursor === 0 || a.scenario === s.scenario,
          "Reset sebelum mengganti skenario",
        );
        s.scenario = a.scenario;
      }
      if (a.speed) s.speed = a.speed;
      if (a.action === "pause") s.running = false;
      if (["start", "replay"].includes(a.action)) {
        requireThat(
          s.activeCS,
          "Admin harus memetakan CS-01 ke ruang fisik terlebih dahulu",
        );
        s.running = true;
      }
      if (a.action === "step") {
        requireThat(s.activeCS, "Pemetaan ruang aktif belum ditentukan");
        s = advance(s, actor);
      }
      break;
    }
    case "tick":
      if (s.running) for (let i = 0; i < s.speed; i++) s = advance(s, actor);
      return s;
    case "verify": {
      const b = s.batches.find((b) => b.id === a.batch);
      requireThat(b?.completed, "Batch belum selesai ABF");
      b.verified = true;
      break;
    }
    case "pack": {
      const p = s.products.find((p) => p.id === a.product && p.active),
        b = s.batches.find((b) => b.id === a.batch);
      requireThat(
        p && b?.verified && b.product === p.id,
        "Pilih produk aktif sesuai batch yang sudah diverifikasi",
      );
      requireThat(s.owners.includes(a.owner), "Pemilik tidak ditemukan");
      requireThat(
        new Date(a.production + "T00:00:00Z").toISOString().slice(0, 10) ===
          a.production,
        "Tanggal tidak valid",
      );
      const sid = `SK-${String(s.sacks.length + 1).padStart(5, "0")}`;
      s.sacks.push({
        id: sid,
        qr: `EAM:${sid}`,
        product: p.id,
        owner: a.owner,
        batch: b.id,
        pcs: p.pcs,
        kg: a.kg,
        production: a.production,
        expiry: expiry(a.production, p.months),
        status: "PACKED",
        pallet: null,
        location: null,
      });
      worker(
        s,
        1,
        "packing",
        `Kemas ${sid}; ${p.pcs} PCS dari master; ${a.kg} KG manual`,
        "WORKING",
      );
      break;
    }
    case "seal": {
      const sk = sack(a.sack);
      requireThat(sk.status === "PACKED", "Karung harus sudah dikemas");
      sk.status = "SEALED";
      worker(s, 1, "packing", `Jahit dan QR ${sk.id}`, "SCANNING");
      break;
    }
    case "palletCreate": {
      const pid = `PLT-${String(s.pallets.length + 1).padStart(3, "0")}`;
      s.pallets.push({
        id: pid,
        qr: `EAM:${pid}`,
        location: null,
        confirmed: false,
      });
      break;
    }
    case "assign": {
      const sk = sack(a.sack),
        p = pallet(a.pallet);
      requireThat(
        sk.status === "SEALED" && !sk.pallet,
        "Karung harus tersegel dan belum memiliki palet",
      );
      requireThat(!p.confirmed && !p.location, "Palet sudah dikonfirmasi");
      sk.pallet = p.id;
      sk.status = "PALLETIZED";
      s.membership.push({
        sack: sk.id,
        from: null,
        to: p.id,
        kind: "ASSIGN",
        at: s.clock,
      });
      worker(s, 2, "packing", `Scan ${sk.id} ke ${p.id}`, "SCANNING");
      break;
    }
    case "palletConfirm": {
      const p = pallet(a.pallet);
      requireThat(contents(s, p.id).length > 0, "Palet kosong");
      p.confirmed = true;
      break;
    }
    case "putaway": {
      requireThat(s.activeCS, "Pemetaan CS-01 belum dikonfirmasi admin");
      const p = pallet(a.pallet);
      requireThat(
        !s.orders.some(
          (o) =>
            !o.dispatched &&
            o.items.some((i) => !i.cancelled && i.pallet === p.id),
        ),
        "Palet memiliki loading aktif; selesaikan atau batalkan loading sebelum transfer",
      );
      requireThat(p.confirmed, "Konfirmasi palet dahulu");
      requireThat(
        !s.pallets.some(
          (other) => other.id !== p.id && other.location === a.location,
        ),
        "Lokasi sudah digunakan palet lain",
      );
      p.location = a.location;
      for (const sk of contents(s, p.id)) {
        requireThat(
          ["PALLETIZED", "STORED"].includes(sk.status),
          "Status karung tidak dapat putaway",
        );
        const isNew = sk.status === "PALLETIZED";
        sk.status = "STORED";
        sk.location = a.location;
        s.ledger.push({
          sack: sk.id,
          kind: isNew ? "PUTAWAY" : "TRANSFER",
          pcs: isNew ? sk.pcs : 0,
          kg: isNew ? sk.kg : 0,
          at: s.clock,
        });
      }
      worker(
        s,
        3,
        s.activeCS,
        `Pindahkan ${p.id} ke ${a.location}`,
        "MOVING_PALLET",
      );
      break;
    }
    case "order":
      requireThat(s.owners.includes(a.owner), "Pemilik tidak ditemukan");
      s.orders.push({
        id: `LOAD-${String(s.orders.length + 1).padStart(3, "0")}`,
        truck: a.truck,
        destination: a.destination,
        owner: a.owner,
        items: [],
        dispatched: false,
      });
      break;
    case "load": {
      const sk = sack(a.sack),
        o = order(a.order);
      requireThat(!o.dispatched, "Order sudah dispatch");
      requireThat(
        sk.status === "STORED" && sk.pallet && sk.location,
        "Karung bukan stok tersedia; buka detail untuk batalkan jika sedang loading",
      );
      requireThat(sk.owner === o.owner, "Pemilik karung berbeda dari order");
      o.items.push({
        sack: sk.id,
        pallet: sk.pallet,
        location: sk.location,
        cancelled: false,
      });
      s.membership.push({
        sack: sk.id,
        from: sk.pallet,
        to: null,
        kind: "LOADING",
        at: s.clock,
      });
      sk.pallet = null;
      sk.location = null;
      sk.status = "LOADING";
      worker(s, 4, "loading", `Bawa ${sk.id} ke ${o.truck}`, "LOADING");
      break;
    }
    case "cancel": {
      const sk = sack(a.sack),
        o = order(a.order),
        item = o.items.find((i) => i.sack === sk.id && !i.cancelled);
      requireThat(
        !o.dispatched && sk.status === "LOADING" && item,
        "Pembatalan hanya sebelum dispatch pada order yang sama",
      );
      const p = pallet(item.pallet);
      requireThat(
        p.location === item.location,
        "Lokasi asal berubah; perlu koreksi supervisor",
      );
      item.cancelled = true;
      sk.status = "STORED";
      sk.pallet = item.pallet;
      sk.location = item.location;
      s.membership.push({
        sack: sk.id,
        from: null,
        to: item.pallet,
        kind: "CANCEL_LOADING",
        at: s.clock,
      });
      worker(
        s,
        4,
        s.activeCS || "anteroom",
        `Kembalikan ${sk.id} ke ${item.pallet}`,
        "MOVING_PALLET",
      );
      break;
    }
    case "dispatch": {
      const o = order(a.order);
      if (o.dispatched) return s;
      const items = o.items.filter((i) => !i.cancelled);
      requireThat(
        items.length && o.truck.trim() && o.destination.trim(),
        "Order kosong atau kendaraan/tujuan belum diisi",
      );
      const loaded = items.map((i) => sack(i.sack));
      requireThat(
        loaded.every((sk) => sk.status === "LOADING"),
        "Status karung tidak sesuai",
      );
      o.document = {
        number: `SJ-EAM-${s.seed}-${o.id}`,
        at: new Date(Date.UTC(2026, 9, 13) + s.clock * 1000).toISOString(),
        approvedBy: actor,
        sacks: loaded.length,
        pcs: loaded.reduce((n, a) => n + a.pcs, 0),
        kg: Number(loaded.reduce((n, a) => n + a.kg, 0).toFixed(2)),
        products: [
          ...new Set(
            loaded.map(
              (sk) => s.products.find((p) => p.id === sk.product)!.name,
            ),
          ),
        ],
      };
      for (const sk of loaded) {
        sk.status = "DISPATCHED";
        s.ledger.push({
          sack: sk.id,
          kind: "DISPATCH",
          pcs: -sk.pcs,
          kg: -sk.kg,
          at: s.clock,
        });
      }
      o.dispatched = true;
      worker(
        s,
        4,
        "loading",
        `Surat jalan ${o.document.number}; truk berangkat`,
        "COMPLETED",
      );
      break;
    }
    case "channel": {
      const c = s.channels.find((c) => c.id === a.id);
      requireThat(c, "Kanal tidak ditemukan");
      Object.assign(c, {
        threshold: a.threshold,
        direction: a.direction,
        target: a.target,
        connected: a.connected,
      });
      break;
    }
    case "ack": {
      const c = s.channels.find((c) => c.id === a.id);
      requireThat(c?.alarm, "Tidak ada alarm aktif");
      c.ack = true;
      break;
    }
    case "opnameScan": {
      const sk = sack(a.sack),
        session = s.opname.at(-1)!;
      requireThat(
        session && !session.closed,
        "Mulai sesi opname terbuka dahulu",
      );
      requireThat(sk.status === "STORED", "Karung bukan stok tersedia");
      if (!session.scanned.includes(sk.id)) session.scanned.push(sk.id);
      break;
    }
    case "opnameClose":
      requireThat(s.opname.length, "Mulai sesi opname dahulu");
      s.opname.at(-1)!.closed = true;
      break;
    case "discrepancy": {
      const sk = sack(a.sack);
      requireThat(
        !["LOADING", "DISPATCHED"].includes(sk.status),
        "Koreksi harus di luar loading/dispatch",
      );
      s.discrepancies.push({
        sack: sk.id,
        old: sk.pcs,
        pcs: a.pcs,
        reason: a.reason,
      });
      s.ledger.push({
        sack: sk.id,
        kind: "PCS_ADJUSTMENT",
        pcs: sk.status === "STORED" ? a.pcs - sk.pcs : 0,
        kg: 0,
        at: s.clock,
      });
      sk.pcs = a.pcs;
      break;
    }
    case "product": {
      const p = s.products.find((p) => p.id === a.id);
      if (!p) {
        s.products.push({
          id: a.id,
          name: a.name,
          category: "Unggas beku",
          pcs: a.pcs,
          months: a.months,
          active: a.active,
        });
        break;
      }
      Object.assign(p, {
        name: a.name,
        pcs: a.pcs,
        months: a.months,
        active: a.active,
      });
      break;
    }
  }
  event(s, a.type, JSON.stringify(a), actor);
  assertState(s);
  return s;
}
type Planned = {
  at: number;
  command?: Command;
  note?: string;
  worker?: number;
  zone?: string;
  task?: string;
};
export function plan(scenario: number): Planned[] {
  const loading: Planned[] = Array.from({ length: 10 }, (_, i) => ({
    at: 5 + i * 3,
    command: {
      type: "load",
      order: "LOAD-001",
      sack: `SK-${String(i + 1).padStart(5, "0")}`,
    },
  }));
  const cancel: Planned = {
      at: 38,
      command: {
        type: "cancel",
        order: "LOAD-001",
        sack: "SK-00010",
        confirmed: true,
      },
    },
    dispatch: Planned = {
      at: 45,
      command: { type: "dispatch", order: "LOAD-001" },
    };
  const production: Planned[] = [
    {
      at: 1,
      note: "ABF timer mulai",
      worker: 0,
      zone: "abf-1",
      task: "Pembekuan batch BATCH-002",
    },
    {
      at: 12,
      note: "ABF selesai",
      worker: 0,
      zone: "anteroom",
      task: "Verifikasi unloading PCS BATCH-002",
    },
    { at: 15, command: { type: "verify", batch: "BATCH-002" } },
  ];
  const packing: Planned[] = [
    {
      at: 2,
      command: {
        type: "pack",
        product: "PRD-001",
        owner: "PT Unggas Sejahtera (Fiktif)",
        batch: "BATCH-001",
        kg: 21.4,
        production: "2026-10-13",
      },
    },
    { at: 6, command: { type: "seal", sack: "SK-00101" } },
  ];
  const palletization: Planned[] = [
    { at: 1, command: { type: "palletCreate" } },
  ];
  for (let i = 0; i < 5; i++) {
    palletization.push(
      {
        at: 2 + i * 5,
        command: {
          type: "pack",
          product: "PRD-001",
          owner: "PT Unggas Sejahtera (Fiktif)",
          batch: "BATCH-001",
          kg: 20 + i * 0.2,
          production: "2026-10-13",
        },
      },
      { at: 3 + i * 5, command: { type: "seal", sack: `SK-0010${i + 1}` } },
      {
        at: 4 + i * 5,
        command: { type: "assign", sack: `SK-0010${i + 1}`, pallet: "PLT-011" },
      },
    );
  }
  palletization.push(
    { at: 28, command: { type: "palletConfirm", pallet: "PLT-011" } },
    {
      at: 32,
      command: { type: "putaway", pallet: "PLT-011", location: "R3-L1-S1" },
    },
  );
  return scenario === 0
    ? [
        ...production,
        ...palletization.map((step) => ({ ...step, at: step.at + 20 })),
        ...[...loading, cancel, dispatch].map((step) => ({
          ...step,
          at: step.at + 60,
        })),
      ]
    : scenario === 1
      ? production
      : scenario === 2
        ? packing
        : scenario === 3
          ? palletization
          : scenario === 4
            ? loading
            : scenario === 5
              ? [...loading, cancel]
              : scenario === 6
                ? [...loading, cancel, dispatch]
                : [
                    {
                      at: 5,
                      note: "ABF-01 melewati ambang",
                      worker: 6,
                      zone: "abf-1",
                      task: "Inspeksi alarm suhu ABF-01",
                    },
                  ];
}
function advance(state: EamState, actor: string) {
  let s = state;
  s.clock++;
  for (const c of s.channels) {
    if (!c.connected) continue;
    const forced = s.scenario === 7 && c.id === "ABF-01" && s.clock >= 5;
    c.value = forced
      ? c.threshold + (c.direction === "above" ? 2 : -2)
      : Number(
          (
            c.target +
            (random(s.seed + s.clock * 17 + c.id.charCodeAt(4)) - 0.5) * 0.2
          ).toFixed(2),
        );
    c.last = s.clock;
    c.history = [...c.history, { at: s.clock, value: c.value }].slice(-300);
    const alarm =
      c.direction === "above" ? c.value > c.threshold : c.value < c.threshold;
    if (alarm && !c.alarm) {
      c.ack = false;
      event(
        s,
        "TEMPERATURE_ALERT",
        `${c.id}: ${c.value}°C (${c.direction} ${c.threshold})`,
        "SIMULATOR",
      );
    }
    c.alarm = alarm;
    if (c.id.startsWith("ABF") && [0, 1].includes(s.scenario))
      c.timer = Math.max(0, 12 - s.clock);
  }
  const steps = plan(s.scenario);
  while (s.cursor < steps.length && steps[s.cursor].at <= s.clock) {
    const step = steps[s.cursor];
    s.cursor++;
    if (step.command)
      s = operate(
        s,
        step.command,
        "SUPER_ADMIN",
        `SIMULATOR / ${actor}` as Role,
      );
    if (step.note) {
      if (step.note === "ABF selesai") s.batches[1].completed = true;
      event(s, "SCENARIO", step.note, "SIMULATOR");
    }
    if (step.worker !== undefined)
      worker(
        s,
        step.worker,
        step.zone!,
        step.task!,
        step.note === "ABF timer mulai" ? "WORKING" : "INSPECTING",
      );
  }
  if (s.cursor === steps.length && s.clock >= steps.at(-1)!.at + 6)
    s.running = false;
  return s;
}
export function assertState(s: EamState) {
  requireThat(
    s.channels.length === 6 &&
      s.channels.filter((c) => c.id.startsWith("CS")).length === 1,
    "Six channels invariant",
  );
  requireThat(
    new Set(s.sacks.map((a) => a.id)).size === s.sacks.length,
    "Duplicate sack ID",
  );
  for (const sk of s.sacks) {
    requireThat(sk.pcs > 0 && sk.kg > 0, "Invalid sack quantities");
    if (["STORED", "PALLETIZED"].includes(sk.status))
      requireThat(
        s.pallets.some((p) => p.id === sk.pallet),
        "Sack missing pallet",
      );
    if (sk.status === "STORED")
      requireThat(!!sk.location, "Stored sack missing location");
    if (["LOADING", "DISPATCHED"].includes(sk.status))
      requireThat(
        sk.pallet === null && sk.location === null,
        "Loaded sack still on pallet",
      );
    const active = s.orders.flatMap((o) =>
      o.dispatched
        ? []
        : o.items.filter((i) => !i.cancelled && i.sack === sk.id),
    );
    requireThat(active.length < 2, "Sack in multiple loading orders");
    if (sk.status === "LOADING")
      requireThat(active.length === 1, "Loading sack missing order");
  }
  const keys = s.ledger.filter((l) => l.kind === "DISPATCH").map((l) => l.sack);
  requireThat(
    new Set(keys).size === keys.length,
    "Duplicate dispatch deduction",
  );
}
