import { createClient } from "@supabase/supabase-js";

export function allowedAppOrigin(request: Request): boolean {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    const host = request.headers.get("host") || new URL(request.url).host;
    if (origin.host !== host) return false;
    if (process.env.CSMS_PUBLIC_ORIGIN === origin.origin) return true;
    return ["localhost", "127.0.0.1"].includes(origin.hostname) &&
      ["http:", "https:"].includes(origin.protocol);
  } catch { return false; }
}

// A forwarded installation requires a verified account even for demo and AI requests.
export async function publicAccessError(request: Request): Promise<Response | null> {
  if (!allowedAppOrigin(request))
    return Response.json({ error: "Origin aplikasi tidak diizinkan" }, { status: 403 });
  if (!process.env.CSMS_PUBLIC_ORIGIN) return null;
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: "Silakan login terlebih dahulu" }, { status: 401 });
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Sesi login tidak valid" }, { status: 401 });
  const profile = await client.from("profiles").select("role").eq("id", data.user.id).single();
  if (profile.error || !profile.data?.role)
    return Response.json({ error: "Profil role belum dibuat" }, { status: 403 });
  return null;
}
