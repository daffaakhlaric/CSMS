export type Zone = {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  kind: "production" | "cold" | "support" | "logistics";
};
// Normalized drawing units (0–100), not metres. Top of photograph is z=0.
export const zones: Zone[] = [
  ["dirty", "Dirty Area", 4, 24, 16, 10, "production"],
  ["unloading", "Unloading", 4, 34, 10, 15, "production"],
  ["waiting", "Ruang Tunggu Ayam", 4, 49, 10, 18, "production"],
  ["chiller", "Screw Chiller", 20, 18, 16, 18, "production"],
  ["clean", "Clean Area", 36, 18, 32, 18, "production"],
  ["ice", "Ice Flake Room", 68, 18, 17, 12, "production"],
  ["sanitation", "Sanitasi", 60, 14, 8, 4, "support"],
  ["waste", "Bak Limbah", 68, 16, 10, 2, "support"],
  ["abf-machine", "Mesin ABF 3,4,5", 20, 40, 9, 8, "support"],
  [
    "abf-small",
    "Mesin ABF 1+2 / Anteroom / CS kecil (?)",
    29,
    36,
    8,
    7,
    "support",
  ],
  ...Array.from({ length: 5 }, (_, i) => [
    `abf-${i + 1}`,
    `ABF ${i + 1}`,
    29,
    43 + i * 5,
    8,
    5,
    "production",
  ]),
  ["locker", "Loker Karyawan", 20, 49, 9, 15, "support"],
  ["anteroom", "Anteroom", 37, 36, 8, 37, "production"],
  ["cs-large", "Cold Storage Besar", 45, 36, 23, 12, "cold"],
  ["cs-small", "Cold Storage Kecil", 45, 48, 23, 9, "cold"],
  ["mdm", "Parting / Marinasi / MDM", 45, 57, 23, 8, "production"],
  ["packing", "Packing Room", 45, 65, 23, 5, "production"],
  ["loading", "Loading / Exit", 45, 70, 23, 9, "logistics"],
  ["coordination", "R. Koordinasi", 37, 77, 9, 3, "support"],
  ["machine-ice", "Mesin CS Es", 68, 30, 10, 5, "support"],
  ["ipal", "IPAL 1–7 / Limbah", 90, 14, 10, 16, "support"],
  ["filter", "Filter / Mesin CS", 90, 32, 10, 9, "support"],
  ["electric", "Panel Listrik", 90, 41, 10, 5, "support"],
  ["workshop", "Workshop", 90, 46, 10, 9, "support"],
  ["warehouse", "Gudang Non Bahan Baku", 90, 55, 10, 12, "logistics"],
  ["canteen", "Kantin", 90, 67, 10, 21, "support"],
  ["office", "Office PT Ender Agro Mitra", 77, 89, 23, 6, "support"],
  ["spice", "Tangga / Gudang Bumbu", 77, 86, 13, 3, "support"],
  ["mushola", "Mushola / Wudhu", 5, 86, 15, 12, "support"],
  ["wc", "WC", 20, 91, 16, 7, "support"],
  ["security", "Pos Security / Panel", 91, 98, 9, 6, "support"],
  ["pond", "Kolam Ikan", 79, 102, 12, 2, "support"],
  ["parking", "Parkir / Sirkulasi", 70, 40, 17, 43, "logistics"],
  ["unknown", "Bangunan tanpa label — verifikasi", 36, 86, 31, 18, "support"],
].map((a) => ({
  id: a[0] as string,
  name: a[1] as string,
  x: a[2] as number,
  z: a[3] as number,
  w: a[4] as number,
  d: a[5] as number,
  kind: a[6] as Zone["kind"],
}));
export const center = (zone: Zone): [number, number] => [
  zone.x + zone.w / 2,
  zone.z + zone.d / 2,
];
export function navigation(
  layout: Zone[],
  from: string,
  to: string,
): [number, number][] {
  const a = layout.find((z) => z.id === from)!,
    b = layout.find((z) => z.id === to)!;
  const ca = center(a),
    cb = center(b);
  if (from === to) return [ca, ca];
  // Operational path through Anteroom, with assumed door openings on its border.
  const corridor = layout.find((z) => z.id === "anteroom")!;
  const x = corridor.x + corridor.w / 2;
  return [ca, [x, ca[1]], [x, cb[1]], cb];
}
