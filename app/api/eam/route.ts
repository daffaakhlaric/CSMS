import { publicAccessError } from "@/lib/request-access";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { localRun, localCommand } from "@/lib/eam/database";
import {
  commandSchema,
  operate,
  roles,
  Role,
  seedState,
} from "@/lib/eam/engine";
export const runtime = "nodejs";
const schema = z.object({
  id: z.string().uuid(),
  mode: z.enum(["DEMO_SIMULATION", "LIVE_READ_ONLY", "CONTROLLED_OPERATIONAL"]),
  role: z.enum(roles).optional(),
  revision: z.number().int().nonnegative().optional(),
  requestId: z.string().uuid().optional(),
  command: commandSchema.optional(),
  provision: z.boolean().optional(),
});
export async function POST(request: Request) {
  try {
  const accessError = await publicAccessError(request);
  if (accessError) return accessError;
    if (Number(request.headers.get("content-length") || 0) > 12000)
      throw Error("Payload terlalu besar");
    const reader = request.body!.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12000) {
        await reader.cancel();
        throw Error("Payload terlalu besar");
      }
      chunks.push(value);
    }
    const a = schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (a.mode === "DEMO_SIMULATION") {
      let demoRole: Role = a.role || "SUPER_ADMIN";
      const bearer = request.headers.get("authorization");
      if (bearer) {
        const c = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: { headers: { Authorization: bearer } },
            auth: { persistSession: false },
          },
        );
        const { data, error } = await c.auth.getUser(
          bearer.replace(/^Bearer /, ""),
        );
        if (error || !data.user)
          return Response.json({ error: "Login tidak valid" }, { status: 401 });
        const p = await c
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        const map: Record<string, Role> = {
          admin: "SUPER_ADMIN",
          packing: "ADMIN_PACKING",
          loading: "ADMIN_LOADING",
          office: "ADMIN_OFFICE",
        };
        demoRole = map[p.data?.role] || p.data?.role;
        if (!roles.includes(demoRole))
          return Response.json(
            { error: "Profil role belum dibuat" },
            { status: 403 },
          );
      }
      if (!a.command)
        return Response.json({
          ...(await localRun(a.id)),
          role: demoRole,
          backend: "PostgreSQL lokal · DEMO terisolasi",
        });
      if (a.revision === undefined || !a.requestId)
        throw Error("Revision dan idempotency key diperlukan");
      return Response.json({
        ...(await localCommand(
          a.id,
          a.revision,
          a.command,
          demoRole,
          a.requestId,
        )),
        role: demoRole,
        backend: "PostgreSQL lokal · DEMO terisolasi",
      });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw Error("Supabase belum dikonfigurasi");
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token)
      return Response.json(
        { error: "Login Supabase diperlukan" },
        { status: 401 },
      );
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: user, error } = await client.auth.getUser(token);
    if (error || !user.user)
      return Response.json({ error: "Sesi tidak valid" }, { status: 401 });
    if (a.mode === "LIVE_READ_ONLY") {
      if (a.command) throw Error("Mode live hanya baca");
      const { data, error } = await client.rpc("csms_snapshot");
      if (error)
        throw Error(
          "Snapshot Supabase gagal. Periksa profil dan migrasi lama.",
        );
      return Response.json({
        live: data,
        backend: "Supabase · LIVE READ ONLY",
      });
    }
    const profile = await client
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();
    const map: Record<string, Role> = {
      admin: "SUPER_ADMIN",
      packing: "ADMIN_PACKING",
      office: "ADMIN_OFFICE",
      loading: "ADMIN_LOADING",
    };
    const role = map[profile.data?.role] || profile.data?.role;
    if (!roles.includes(role))
      return Response.json(
        { error: "Profil tidak memiliki peran EAM" },
        { status: 403 },
      );
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!service) throw Error("Service key server belum dikonfigurasi");
    const admin = createClient(url, service, {
      auth: { persistSession: false },
    });
    const found = await client
      .from("eam_operational_runs")
      .select("id,revision,state")
      .eq("id", a.id)
      .maybeSingle();
    if (found.error)
      throw Error(
        "Jalankan migrasi EAM 202610130001 pada Supabase terlebih dahulu.",
      );
    if (!found.data) {
      if (role !== "SUPER_ADMIN")
        throw Error("Admin harus membuat workspace operasional lebih dahulu");
      if (!a.provision)
        throw Error(
          "Workspace belum dibuat. Admin dapat membuat workspace kosong; tidak ada inventori demo yang disalin.",
        );
      const state = seedState();
      state.sacks = [];
      state.pallets = [];
      state.orders = [];
      state.ledger = [];
      state.membership = [];
      state.opname = [];
      state.batches = [];
      state.products = [];
      state.owners = [];
      state.channels.forEach((c) => {
        c.connected = false;
        c.history = [];
      });
      const created = await admin
        .from("eam_operational_runs")
        .insert({ id: a.id, revision: 0, state })
        .select("id,revision,state")
        .single();
      if (created.error)
        throw Error(
          "Pembuatan workspace gagal; periksa migrasi dan akses server",
        );
      return Response.json({
        ...created.data,
        role,
        backend: "Supabase · CONTROLLED OPERATIONAL",
      });
    }
    if (!a.command)
      return Response.json({
        ...found.data,
        role,
        backend: "Supabase · CONTROLLED OPERATIONAL",
      });
    if (["tick", "control"].includes(a.command.type))
      throw Error("Simulasi otomatis tidak diizinkan di produksi");
    if (a.revision === undefined || !a.requestId)
      throw Error("Revision dan idempotency key diperlukan");
    const repeated = await client
      .from("eam_operational_events")
      .select("id")
      .eq("run_id", a.id)
      .eq("request_id", a.requestId)
      .maybeSingle();
    if (repeated.data)
      return Response.json({
        ...found.data,
        role,
        backend: "Supabase · CONTROLLED OPERATIONAL",
      });
    const state = operate(
      found.data.state,
      a.command,
      role,
      user.user.id as Role,
    );
    if (a.command.type === "dispatch") {
      const document = state.orders.find(
        (o) => o.id === (a.command as { order: string }).order,
      )?.document;
      if (
        document &&
        !found.data.state.orders.find(
          (o: { id: string; dispatched: boolean }) =>
            o.id === (a.command as { order: string }).order,
        )?.dispatched
      )
        document.at = new Date().toISOString();
    }
    const { data, error: commitError } = await admin.rpc("eam_commit", {
      p_id: a.id,
      p_revision: a.revision,
      p_state: state,
      p_request: a.requestId,
      p_command: a.command,
      p_actor: user.user.id,
    });
    if (commitError)
      throw Error("Konflik transaksi / akses ditolak; muat ulang workspace");
    return Response.json({
      ...data,
      role,
      backend: "Supabase · CONTROLLED OPERATIONAL",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Operasi gagal" },
      { status: 400 },
    );
  }
}
