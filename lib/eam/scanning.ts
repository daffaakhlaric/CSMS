import { EamState } from "./engine";
export function resolveCameraCode(
  state: EamState,
  target: "pallet" | "sack" | "loading",
  raw: string,
) {
  const code = raw.trim();
  if (target === "pallet") {
    const item = state.pallets.find((p) => p.id === code || p.qr === code);
    return item
      ? { id: item.id, qr: item.qr, error: null }
      : {
          id: "",
          qr: "",
          error:
            "QR palet tidak ditemukan. Arahkan kamera ke label palet yang terdaftar.",
        };
  }
  const item = state.sacks.find((s) => s.id === code || s.qr === code);
  return item
    ? { id: item.id, qr: item.qr, error: null }
    : {
        id: "",
        qr: "",
        error:
          "Kode karung tidak ditemukan. Gunakan label karung yang terdaftar, bukan label palet.",
      };
}

export function loadingScanIssue(
  state: EamState,
  orderId: string,
  sackId: string,
): string | null {
  const order = state.orders.find((o) => o.id === orderId),
    sack = state.sacks.find((s) => s.id === sackId);
  if (!order)
    return "Pilih atau buat order loading yang masih terbuka sebelum scan.";
  if (order.dispatched)
    return `${order.id} sudah dispatch. Pilih order berstatus TERBUKA atau buat order baru.`;
  if (!sack) return "Karung tidak ditemukan.";
  if (sack.owner !== order.owner)
    return `${sack.id} milik ${sack.owner}, sedangkan ${order.id} milik ${order.owner}. Pilih atau buat order dengan pemilik ${sack.owner}.`;
  if (sack.status === "LOADING") {
    const assigned = state.orders.find(
      (o) =>
        !o.dispatched &&
        o.items.some((i) => !i.cancelled && i.sack === sack.id),
    );
    if (assigned?.id !== order.id)
      return `${sack.id} sudah masuk ${assigned?.id || "order lain"}. Buka order tersebut untuk pembatalan sebelum memindahkannya.`;
    return null;
  }
  if (sack.status !== "STORED")
    return `${sack.id} berstatus ${sack.status}. Hanya karung STORED yang dapat dimuat.`;
  return null;
}
