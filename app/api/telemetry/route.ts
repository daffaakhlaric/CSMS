import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
/** Future gateway contract: HMAC_SHA256(secret, timestamp + '.' + raw JSON body).
 * Gateway holds only its dedicated signing secret, never the Supabase service role.
 */
export async function POST(request: Request) {
  const secret = process.env.CSMS_GATEWAY_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key)
    return Response.json(
      { error: "Ingest perangkat belum dikonfigurasi" },
      { status: 503 },
    );
  const signedAt = request.headers.get("x-csms-timestamp") ?? "";
  const signature = request.headers.get("x-csms-signature") ?? "";
  if (
    !/^\d{13}$/.test(signedAt) ||
    Math.abs(Date.now() - Number(signedAt)) > 300000 ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return Response.json(
      { error: "Tanda tangan tidak valid" },
      { status: 401 },
    );
  // Bound memory even for chunked uploads without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Isi kosong" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4096) {
      await reader.cancel();
      return Response.json({ error: "Payload terlalu besar" }, { status: 413 });
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  const expected = createHmac("sha256", secret)
    .update(signedAt + "." + body)
    .digest();
  if (!timingSafeEqual(Buffer.from(signature, "hex"), expected))
    return Response.json(
      { error: "Tanda tangan tidak valid" },
      { status: 401 },
    );
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body);
  } catch {
    return Response.json({ error: "JSON tidak valid" }, { status: 400 });
  }
  if (
    !data ||
    typeof data !== "object" ||
    typeof data.sensor !== "string" ||
    typeof data.temperature !== "number" ||
    !Number.isFinite(data.temperature) ||
    data.temperature < -100 ||
    data.temperature > 100 ||
    typeof data.at !== "string" ||
    !Number.isFinite(Date.parse(data.at)) ||
    typeof data.eventId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      data.eventId,
    )
  )
    return Response.json({ error: "Pembacaan tidak valid" }, { status: 400 });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.rpc("ingest_temperature", {
    p_sensor: data.sensor,
    p_temperature: data.temperature,
    p_at: data.at,
    p_event: data.eventId,
  });
  if (error)
    return Response.json(
      { error: "Pembacaan ditolak; periksa pemetaan dan timestamp gateway" },
      { status: 422 },
    );
  return Response.json({ accepted: true });
}
