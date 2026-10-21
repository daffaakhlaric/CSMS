import { createClient } from "@supabase/supabase-js";
import { Room, tickRoom } from "./domain";
export interface ScaleAdapter {
  readKg(): Promise<{ kg: number; source: "MOCK" | "VERIFIED_HARDWARE" }>;
}
export class MockScaleAdapter implements ScaleAdapter {
  async readKg() {
    return {
      kg: Number((20 + Math.random() * 2).toFixed(2)),
      source: "MOCK" as const,
    };
  }
}
export class SimulatorAdapter {
  read(room: Room) {
    return tickRoom(room, new Date());
  }
}
export type VerifiedModbusConfig = {
  manualReference: string;
  register: number;
  baudRate: number;
  slaveId: number;
  decode: (bytes: Uint8Array) => number;
};
/** Gateway only. No serial access from a browser. Supply independently verified device parameters. */
export class PTA8D08Adapter {
  constructor(private config?: VerifiedModbusConfig) {}
  async read(): Promise<number> {
    if (!this.config)
      throw Error(
        "Manual resmi PTA8D08 dan pemetaan register terverifikasi diperlukan",
      );
    throw Error("Transport RS485 hanya di gateway lokal; belum diintegrasikan");
  }
}
export function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}
export function subscribeTelemetry(onChange: () => void) {
  const client = supabaseClient();
  if (!client) return () => {};
  const channel = client
    .channel("csms-telemetry")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "temperature_readings" },
      onChange,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
/** RPCs enforce authorization and stock transitions in PostgreSQL, never in the 3D scene. */
export async function confirmDispatch(orderId: string) {
  const client = supabaseClient();
  if (!client) throw Error("Supabase belum dikonfigurasi");
  const { data, error } = await client.rpc("confirm_dispatch", {
    p_order: orderId,
  });
  if (error) throw error;
  return data;
}
