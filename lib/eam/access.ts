import { Role } from "./engine";
export function menuFor(role: Role) {
  switch (role) {
    case "ADMIN_PACKING":
      return ["Operasional", "Inventori"];
    case "ADMIN_LOADING":
      return ["Pemuatan", "Inventori"];
    case "CS_OPERATOR":
      return ["Overview", "Operasional", "Inventori", "Master Palet"];
    case "TEMPERATURE_MONITOR":
      return ["Overview", "Suhu"];
    case "ADMIN_OFFICE":
      return ["Overview", "Inventori", "Pemuatan", "Master Data"];
    default:
      return [
        "Overview",
        "Operasional",
        "Inventori",
        "Pemuatan",
        "Master Data",
        "Master Palet",
        "Suhu",
        "Pekerja",
        "Konfigurasi",
      ];
  }
}
