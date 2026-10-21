import { inventory, readingSource, State } from "./domain";
export function assistantContext(state: State, question: string, mode: string) {
  const groups = new Map<
    string,
    {
      product: string;
      owner: string;
      room: string | null;
      status: string;
      sacks: number;
      pcs: number;
      kg: number;
    }
  >();
  for (const sack of state.sacks) {
    const key = JSON.stringify([
      sack.product,
      sack.owner,
      sack.room,
      sack.status,
    ]);
    const group = groups.get(key) || {
      product: sack.product,
      owner: sack.owner,
      room: sack.room,
      status: sack.status,
      sacks: 0,
      pcs: 0,
      kg: 0,
    };
    group.sacks++;
    group.pcs += sack.pcs;
    group.kg += sack.kg;
    groups.set(key, group);
  }
  const ids = question.toUpperCase().match(/KRG-?\d{5}/g) || [];
  return {
    capturedAt: new Date().toISOString(),
    mode,
    totals: inventory(state),
    groups: [...groups.values()],
    rooms: state.rooms.map((r) => ({
      id: r.id,
      temperature: r.temperature,
      target: r.target,
      warning: r.warning,
      critical: r.critical,
      connected: r.connected,
      quality: r.quality,
      lastUpdate: r.lastUpdate,
      source: readingSource(r),
      stock: inventory(state, r.id),
    })),
    requestedSacks: state.sacks.filter((s) =>
      ids.some((id) => id.replace("-", "") === s.id.replace("-", "")),
    ),
    lookupIds: ids,
    activeAlerts: (state.alerts || []).filter((a) => !a.resolvedAt),
    orders: state.orders,
    note: "Ringkasan semua barang menurut produk/pemilik/ruang/status. Detail karung hanya untuk ID yang disebut dalam pertanyaan. Data berasal dari sesi aplikasi pengguna.",
  };
}
