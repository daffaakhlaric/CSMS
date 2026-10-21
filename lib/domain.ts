export type RoomId = "CS-01" | "CS-02";
export type Scenario =
  | "normal"
  | "stable"
  | "door"
  | "rising"
  | "recovery"
  | "alarm"
  | "offline"
  | "stale"
  | "manual";
export const scenarios: Record<Scenario, string> = {
  normal: "Pendinginan normal",
  stable: "Suhu stabil",
  door: "Pintu terbuka",
  rising: "Suhu meningkat",
  recovery: "Pemulihan kompresor",
  alarm: "Alarm suhu tinggi",
  offline: "Sensor terputus",
  stale: "Data kedaluwarsa",
  manual: "Pengaturan manual",
};
export type Reading = {
  at: string;
  value: number;
  source: "SIMULATED" | "HARDWARE";
};
export function readingSource(room: Room) {
  return room.history.at(-1)?.source ?? "SIMULATED";
}
export type Room = {
  id: RoomId;
  name: string;
  sensor: string;
  channel: number;
  temperature: number;
  target: number;
  warning: number;
  critical: number;
  noise: number;
  connected: boolean;
  quality: "baik" | "terputus" | "kedaluwarsa";
  running: boolean;
  scenario: Scenario;
  lastUpdate: string;
  history: Reading[];
};
export type SackStatus =
  | "disiapkan"
  | "dikemas"
  | "ditimbang"
  | "disegel"
  | "tersimpan"
  | "dimuat"
  | "dikirim";
export type Sack = {
  id: string;
  qr: string;
  owner: string;
  product: string;
  batch: string;
  production: string;
  expiry: string;
  pcs: number;
  kg: number;
  status: SackStatus;
  room: RoomId | null;
  rack: number | null;
  level: number | null;
  slot: number | null;
  sealedBy?: string;
  sealedAt?: string;
};
export type Batch = {
  id: string;
  product: string;
  pcs: number;
  verified: boolean;
  verifiedBy?: string;
};
export type Order = {
  id: string;
  customer: string;
  product: string;
  requiredPcs: number;
  requiredKg: number;
  sackIds: string[];
  status: "rencana" | "dilaporkan" | "dikonfirmasi";
  reportedBy?: string;
  confirmedBy?: string;
};
export type Movement = {
  id: string;
  at: string;
  sackId: string;
  kind: string;
  operator: string;
  room: RoomId | null;
  pcs: number;
  kg: number;
};
export type Config = {
  abfCount: number;
  abfTarget: number;
  abfHours: number;
  expiryDays: number;
  productExpiry: Record<string, number>;
  racks: number;
  levels: number;
  slots: number;
};
export type TemperatureAlert = {
  id: string;
  room: RoomId;
  severity: string;
  openedAt: string;
  resolvedAt: string | null;
  message: string;
};
export type State = {
  version: 1;
  rooms: Room[];
  sacks: Sack[];
  batches: Batch[];
  orders: Order[];
  movements: Movement[];
  config: Config;
  alerts?: TemperatureAlert[];
};
export const products = ["Kepala ikan", "Daging ikan tanpa tulang"];
export const owners = ["PT Laut Biru Nusantara", "CV Samudra Pangan"];
export function expiryDate(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function createDemo(now = new Date()): State {
  const at = now.toISOString();
  const production = at.slice(0, 10);
  const rooms: Room[] = (["CS-01", "CS-02"] as RoomId[]).map((id, i) => ({
    id,
    name: `Cold Storage 0${i + 1}`,
    sensor: `TEMP-${id}`,
    channel: i + 1,
    temperature: -20.4 + i * 1.7,
    target: -20 + i,
    warning: -16,
    critical: -12,
    noise: 0.12,
    connected: true,
    quality: "baik",
    running: true,
    scenario: "normal",
    lastUpdate: at,
    history: Array.from({ length: 720 }, (_, h) => ({
      at: new Date(now.getTime() - (719 - h) * 3600000).toISOString(),
      value: Number((-20 + i + Math.sin(h * 0.36 + i) * 0.6).toFixed(2)),
      source: "SIMULATED" as const,
    })),
  }));
  const batches: Batch[] = products.map((product, i) => ({
    id: `BATCH-${i + 1}`,
    product,
    pcs: 3000,
    verified: true,
    verifiedBy: "Admin Office Demo",
  }));
  const sacks: Sack[] = Array.from({ length: 500 }, (_, i) => {
    const local = i % 250;
    const id = `KRG-${String(i + 1).padStart(5, "0")}`;
    return {
      id,
      qr: `CSMS:${id}`,
      owner: owners[i % 2],
      product: products[i % 2],
      batch: `BATCH-${(i % 2) + 1}`,
      production,
      expiry: expiryDate(production, 365),
      pcs: 12,
      kg: 20 + (i % 5) * 0.25,
      status: "tersimpan",
      room: i < 250 ? "CS-01" : "CS-02",
      rack: Math.floor(local / 60) + 1,
      level: Math.floor((local % 60) / 20) + 1,
      slot: (local % 20) + 1,
      sealedBy: "Admin Packing Demo",
      sealedAt: at,
    };
  });
  return {
    version: 1,
    alerts: [
      {
        id: "DEMO-ALERT-01",
        room: "CS-01",
        severity: "warning",
        openedAt: new Date(now.getTime() - 172800000).toISOString(),
        resolvedAt: new Date(now.getTime() - 171900000).toISOString(),
        message: "Contoh demo: pintu terbuka (SIMULATED)",
      },
      {
        id: "DEMO-ALERT-02",
        room: "CS-02",
        severity: "offline",
        openedAt: new Date(now.getTime() - 86400000).toISOString(),
        resolvedAt: new Date(now.getTime() - 85800000).toISOString(),
        message: "Contoh demo: sensor terputus (SIMULATED)",
      },
    ],
    rooms,
    sacks,
    batches,
    config: {
      abfCount: 1,
      abfTarget: -40,
      abfHours: 13,
      expiryDays: 365,
      productExpiry: {},
      racks: 5,
      levels: 3,
      slots: 20,
    },
    orders: [
      {
        id: "EXP-2026-001",
        customer: "Ocean Foods • Singapura",
        product: products[0],
        requiredPcs: 120,
        requiredKg: 200,
        sackIds: [],
        status: "rencana",
      },
      {
        id: "EXP-2026-002",
        customer: "Pacific Frozen • Jepang",
        product: products[1],
        requiredPcs: 60,
        requiredKg: 100,
        sackIds: [],
        status: "rencana",
      },
    ],
    movements: sacks.map((s) => ({
      id: `SEED-${s.id}`,
      at,
      sackId: s.id,
      kind: "Penempatan awal demo",
      operator: "Admin Packing Demo",
      room: s.room,
      pcs: s.pcs,
      kg: s.kg,
    })),
  };
}
export function status(
  room: Room,
): "normal" | "warning" | "critical" | "offline" {
  if (!room.connected || room.quality !== "baik") return "offline";
  return room.temperature >= room.critical
    ? "critical"
    : room.temperature >= room.warning
      ? "warning"
      : "normal";
}
export function tickRoom(room: Room, now: Date, random = Math.random): Room {
  if (!room.running) return room;
  if (room.scenario === "offline")
    return { ...room, connected: false, quality: "terputus" };
  if (room.scenario === "stale") return { ...room, quality: "kedaluwarsa" };
  let change = 0;
  const delta = room.target - room.temperature;
  switch (room.scenario) {
    case "normal":
    case "recovery":
      change =
        Math.sign(delta) *
        Math.min(Math.abs(delta), room.scenario === "recovery" ? 0.32 : 0.12);
      break;
    case "door":
      change = 0.2;
      break;
    case "rising":
      change = 0.12;
      break;
    case "alarm":
      change = room.temperature < room.critical + 1 ? 0.4 : 0;
      break;
  }
  const value = Math.max(
    -60,
    Math.min(
      20,
      Number(
        (
          room.temperature +
          change +
          (room.scenario === "manual" ? 0 : (random() - 0.5) * room.noise)
        ).toFixed(2),
      ),
    ),
  );
  const at = now.toISOString();
  return {
    ...room,
    temperature: value,
    connected: true,
    quality: "baik",
    lastUpdate: at,
    history: [
      ...room.history,
      { at, value, source: "SIMULATED" as const },
    ].slice(-1800),
  };
}
export function inventory(state: State, room?: RoomId) {
  const sacks = state.sacks.filter(
    (s) =>
      ["tersimpan", "dimuat"].includes(s.status) && (!room || s.room === room),
  );
  return {
    count: sacks.length,
    pcs: sacks.reduce((a, s) => a + s.pcs, 0),
    kg: sacks.reduce((a, s) => a + s.kg, 0),
  };
}
export function resolveSack(state: State, input: string) {
  return state.sacks.find(
    (s) =>
      s.id === input.trim().toUpperCase() ||
      s.qr === input.trim().toUpperCase(),
  );
}
export type Action =
  | {
      type: "room";
      id: RoomId;
      patch: Partial<
        Pick<
          Room,
          | "temperature"
          | "target"
          | "warning"
          | "critical"
          | "noise"
          | "running"
          | "scenario"
        >
      >;
    }
  | { type: "tick"; now: string }
  | { type: "resetRoom"; id: RoomId }
  | { type: "config"; config: Config }
  | { type: "batch"; id: string; product: string; pcs: number }
  | { type: "verify"; batch: string; operator: string }
  | {
      type: "prepare";
      id: string;
      owner: string;
      product: string;
      batch: string;
      production: string;
    }
  | { type: "pack"; id: string; pcs: number }
  | { type: "weigh"; id: string; kg: number }
  | { type: "seal"; id: string; operator: string }
  | {
      type: "putaway";
      id: string;
      room: RoomId;
      rack: number;
      level: number;
      slot: number;
      operator: string;
    }
  | {
      type: "order";
      id: string;
      customer: string;
      product: string;
      pcs: number;
      kg: number;
    }
  | { type: "scan"; order: string; input: string; operator: string }
  | { type: "report"; order: string; operator: string }
  | { type: "dispatch"; order: string; operator: string };
function requireThat(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function positive(n: number) {
  return Number.isFinite(n) && n > 0;
}
export function transition(
  input: State,
  action: Action,
  now = new Date(),
): State {
  const state = transitionCore(input, action, now);
  const at = now.toISOString();
  state.alerts ??= [];
  for (const room of state.rooms) {
    const severity = status(room);
    for (const alert of state.alerts) {
      if (
        alert.room === room.id &&
        !alert.resolvedAt &&
        alert.severity !== severity
      )
        alert.resolvedAt = at;
    }
    if (
      severity !== "normal" &&
      !state.alerts.some(
        (a) => a.room === room.id && a.severity === severity && !a.resolvedAt,
      )
    )
      state.alerts.unshift({
        id: crypto.randomUUID(),
        room: room.id,
        severity,
        openedAt: at,
        resolvedAt: null,
        message:
          severity === "offline"
            ? "Pembacaan sensor tidak tersedia (SIMULATED)"
            : "Suhu melewati ambang konfigurasi (SIMULATED)",
      });
  }
  state.alerts = state.alerts.slice(0, 500);
  return state;
}
function transitionCore(input: State, action: Action, now: Date): State {
  const state = structuredClone(input);
  const at = now.toISOString();
  const log = (
    s: Sack,
    kind: string,
    operator: string,
    delta: -1 | 0 | 1 = 0,
  ) =>
    state.movements.unshift({
      id: crypto.randomUUID(),
      at,
      sackId: s.id,
      kind,
      operator,
      room: s.room,
      pcs: delta * s.pcs,
      kg: delta * s.kg,
    });
  if (action.type === "tick") {
    state.rooms = state.rooms.map((r) => tickRoom(r, new Date(action.now)));
    return state;
  }
  if (action.type === "room") {
    const r = state.rooms.find((r) => r.id === action.id)!;
    Object.assign(r, action.patch);
    requireThat(
      [r.temperature, r.target, r.warning, r.critical, r.noise].every(
        Number.isFinite,
      ),
      "Nilai suhu tidak valid",
    );
    requireThat(
      r.warning < r.critical && r.noise >= 0,
      "Ambang peringatan harus di bawah ambang kritis",
    );
    r.connected = r.scenario !== "offline";
    r.quality =
      r.scenario === "offline"
        ? "terputus"
        : r.scenario === "stale"
          ? "kedaluwarsa"
          : "baik";
    if (action.patch.temperature !== undefined) {
      r.lastUpdate = at;
      r.history.push({ at, value: r.temperature, source: "SIMULATED" });
    }
    return state;
  }
  if (action.type === "resetRoom") {
    state.rooms = state.rooms.map((r) =>
      r.id === action.id
        ? createDemo(now).rooms.find((n) => n.id === r.id)!
        : r,
    );
    return state;
  }
  if (action.type === "config") {
    const c = action.config;
    requireThat(
      Number.isInteger(c.abfCount) &&
        c.abfCount >= 0 &&
        c.abfCount <= 20 &&
        positive(c.abfHours) &&
        Number.isFinite(c.abfTarget) &&
        Number.isInteger(c.expiryDays) &&
        c.expiryDays > 0 &&
        Object.values(c.productExpiry).every(
          (d) => Number.isInteger(d) && d > 0,
        ),
      "Konfigurasi tidak valid",
    );
    requireThat(
      [c.racks, c.levels, c.slots].every(
        (v) => Number.isInteger(v) && v > 0 && v <= 100,
      ),
      "Dimensi rak tidak valid",
    );
    requireThat(
      state.sacks.every(
        (s) =>
          !s.room ||
          ((s.rack ?? 0) <= c.racks &&
            (s.level ?? 0) <= c.levels &&
            (s.slot ?? 0) <= c.slots),
      ),
      "Dimensi baru tidak dapat menghapus lokasi yang terisi",
    );
    state.config = c;
    return state;
  }
  if (action.type === "batch") {
    requireThat(
      !state.batches.some((b) => b.id === action.id) &&
        positive(action.pcs) &&
        Number.isInteger(action.pcs),
      "ID batch harus unik dan PCS harus bilangan bulat positif",
    );
    state.batches.push({
      id: action.id,
      product: action.product,
      pcs: action.pcs,
      verified: false,
    });
    return state;
  }
  if (action.type === "verify") {
    const b = state.batches.find((b) => b.id === action.batch);
    requireThat(b, "Batch tidak ditemukan");
    b.verified = true;
    b.verifiedBy = action.operator;
    return state;
  }
  if (action.type === "prepare") {
    requireThat(
      !state.sacks.some((s) => s.id === action.id),
      "ID karung sudah digunakan",
    );
    const b = state.batches.find((b) => b.id === action.batch);
    requireThat(
      b?.verified && b.product === action.product,
      "Batch harus diverifikasi Admin Office dan sesuai produk",
    );
    requireThat(
      action.owner.trim() && /^\d{4}-\d{2}-\d{2}$/.test(action.production),
      "Pemilik dan tanggal produksi wajib diisi",
    );
    state.sacks.push({
      id: action.id,
      qr: `CSMS:${action.id}`,
      owner: action.owner,
      product: action.product,
      batch: action.batch,
      production: action.production,
      expiry: expiryDate(
        action.production,
        state.config.productExpiry[action.product] ?? state.config.expiryDays,
      ),
      pcs: 0,
      kg: 0,
      status: "disiapkan",
      room: null,
      rack: null,
      level: null,
      slot: null,
    });
    return state;
  }
  if (action.type === "order") {
    requireThat(
      !state.orders.some((o) => o.id === action.id) &&
        action.customer.trim() &&
        positive(action.pcs) &&
        Number.isInteger(action.pcs) &&
        positive(action.kg),
      "Pesanan memerlukan ID unik, pelanggan, PCS dan KG positif",
    );
    state.orders.push({
      id: action.id,
      customer: action.customer,
      product: action.product,
      requiredPcs: action.pcs,
      requiredKg: action.kg,
      sackIds: [],
      status: "rencana",
    });
    return state;
  }
  if (action.type === "scan") {
    const o = state.orders.find((o) => o.id === action.order);
    const s = resolveSack(state, action.input);
    requireThat(o?.status === "rencana", "Pesanan tidak dapat diubah");
    requireThat(
      s && s.status === "tersimpan" && s.product === o.product,
      "Karung harus tersimpan dan sesuai produk pesanan",
    );
    requireThat(
      !state.orders.some((x) => x.sackIds.includes(s.id)),
      "Karung sudah dialokasikan",
    );
    o.sackIds.push(s.id);
    s.status = "dimuat";
    log(s, "Persiapan pemuatan", action.operator);
    return state;
  }
  if (action.type === "report" || action.type === "dispatch") {
    const o = state.orders.find((o) => o.id === action.order);
    requireThat(o, "Pesanan tidak ditemukan");
    if (action.type === "dispatch" && o.status === "dikonfirmasi") return state;
    const sacks = state.sacks.filter((s) => o.sackIds.includes(s.id));
    requireThat(
      sacks.length > 0 && sacks.every((s) => s.status === "dimuat"),
      "Karung pemuatan tidak valid",
    );
    requireThat(
      sacks.reduce((a, s) => a + s.pcs, 0) >= o.requiredPcs &&
        sacks.reduce((a, s) => a + s.kg, 0) >= o.requiredKg,
      "Target PCS dan KG belum terpenuhi",
    );
    if (action.type === "report") {
      requireThat(o.status === "rencana", "Laporan sudah dikirim");
      o.status = "dilaporkan";
      o.reportedBy = action.operator;
    } else {
      requireThat(
        o.status === "dilaporkan",
        "Admin Loading harus mengirim laporan dahulu",
      );
      o.status = "dikonfirmasi";
      o.confirmedBy = action.operator;
      sacks.forEach((s) => {
        log(s, "Konfirmasi pengiriman", action.operator, -1);
        s.status = "dikirim";
        s.room = null;
        s.rack = null;
        s.level = null;
        s.slot = null;
      });
    }
    return state;
  }
  const s = state.sacks.find((s) => s.id === action.id);
  requireThat(s, "Karung tidak ditemukan");
  if (action.type === "pack") {
    requireThat(
      s.status === "disiapkan" &&
        positive(action.pcs) &&
        Number.isInteger(action.pcs),
      "Karung harus disiapkan dan PCS harus bulat positif",
    );
    const b = state.batches.find((b) => b.id === s.batch)!;
    requireThat(
      state.sacks
        .filter((x) => x.batch === s.batch)
        .reduce((a, x) => a + x.pcs, 0) +
        action.pcs <=
        b.pcs,
      "PCS melebihi jumlah batch",
    );
    s.pcs = action.pcs;
    s.status = "dikemas";
  }
  if (action.type === "weigh") {
    requireThat(
      s.status === "dikemas" && positive(action.kg),
      "Karung harus dikemas dan berat harus positif",
    );
    s.kg = action.kg;
    s.status = "ditimbang";
  }
  if (action.type === "seal") {
    requireThat(
      s.status === "ditimbang" && action.operator.trim(),
      "Karung harus ditimbang; operator wajib diisi",
    );
    s.sealedAt = at;
    s.sealedBy = action.operator;
    s.status = "disegel";
    log(s, "Penjahitan / segel", action.operator);
  }
  if (action.type === "putaway") {
    requireThat(
      s.status === "disegel" && s.sealedAt,
      "Hanya karung tersegel yang dapat ditempatkan",
    );
    requireThat(
      state.rooms.some((r) => r.id === action.room),
      "Ruang tidak valid",
    );
    requireThat(
      [action.rack, action.level, action.slot].every(
        (v) => Number.isInteger(v) && v > 0,
      ) &&
        action.rack <= state.config.racks &&
        action.level <= state.config.levels &&
        action.slot <= state.config.slots,
      "Lokasi di luar konfigurasi",
    );
    requireThat(
      !state.sacks.some(
        (x) =>
          x.room === action.room &&
          x.rack === action.rack &&
          x.level === action.level &&
          x.slot === action.slot,
      ),
      "Slot sudah terisi",
    );
    Object.assign(s, {
      room: action.room,
      rack: action.rack,
      level: action.level,
      slot: action.slot,
      status: "tersimpan",
    });
    log(s, "Penempatan ke ruang", action.operator, 1);
  }
  return state;
}
