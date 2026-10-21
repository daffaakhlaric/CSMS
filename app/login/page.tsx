"use client";
import { useState } from "react";
import { Snowflake, Eye, EyeOff } from "lucide-react";
import { supabaseClient } from "@/lib/adapters";
import { roles } from "@/lib/eam/engine";
import "./style.css";
const accounts = [
  ["Admin utama", "eam.admin@example.com"],
  ["Supervisor", "eam.supervisor@example.com"],
  ["Packing", "eam.packing@example.com"],
  ["Admin kantor", "eam.office@example.com"],
  ["Operator gudang", "eam.gudang@example.com"],
  ["Loading", "eam.loading@example.com"],
  ["Monitoring suhu", "eam.suhu@example.com"],
];
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(true);
  async function login() {
    setBusy(true);
    setError("");
    try {
      const client = supabaseClient();
      if (!client) throw Error("Konfigurasi Supabase belum tersedia.");
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error)
        throw Error(
          "Email atau password tidak cocok. Periksa kembali akun Anda.",
        );
      const profile = await client
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      const map: Record<string, string> = {
        admin: "SUPER_ADMIN",
        packing: "ADMIN_PACKING",
        loading: "ADMIN_LOADING",
        office: "ADMIN_OFFICE",
      };
      const role = map[profile.data?.role] || profile.data?.role;
      if (profile.error || !roles.includes(role)) {
        await client.auth.signOut();
        throw Error("Akun belum memiliki role EAM. Hubungi admin.");
      }
      sessionStorage.setItem(
        "eam-login-mode",
        demo ? "DEMO_SIMULATION" : "CONTROLLED_OPERATIONAL",
      );
      window.location.replace("/eam");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login gagal. Coba lagi.");
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <Snowflake size={28} />
          <span>
            EAM<small>PT Ender Agro Mitra</small>
          </span>
        </div>
        <h1>Masuk ke dashboard</h1>
        <p>Gunakan akun petugas. Menu dan izin mengikuti role akun Anda.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label>
            Email
            <input
              autoFocus
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@example.com"
              disabled={busy}
            />
          </label>
          <label>
            Password
            <div className="login-password">
              <input
                autoComplete="current-password"
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                aria-label={
                  show ? "Sembunyikan password" : "Tampilkan password"
                }
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label className="login-check">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
              disabled={busy}
            />{" "}
            Mode simulasi untuk tes role
          </label>
          <small className="login-hint">
            {demo
              ? "Menggunakan data simulasi. Izin tetap mengikuti akun Supabase yang login."
              : "Menggunakan workspace operasional Supabase."}
          </small>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="login-submit" disabled={busy}>
            {busy ? "Memeriksa akun…" : "Masuk"}
          </button>
        </form>
        <details>
          <summary>Pilih email akun pengujian</summary>
          <div className="login-accounts">
            {accounts.map(([label, address]) => (
              <button
                key={address}
                disabled={busy}
                onClick={() => {
                  setEmail(address);
                  setPassword("");
                  setError("");
                }}
              >
                <b>{label}</b>
                <span>{address}</span>
              </button>
            ))}
          </div>
          <small>
            Password akun tersedia pada file daftar akun yang sudah diberikan.
          </small>
        </details>
      </section>
      <footer>Cold Storage Management System · EAM</footer>
    </main>
  );
}
