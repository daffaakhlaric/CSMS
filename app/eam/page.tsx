"use client";
import { resolveCameraCode, loadingScanIssue } from "@/lib/eam/scanning";
import CameraScanner from "@/components/eam/camera-scanner";
import MasterData from "@/components/eam/master-data";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import SearchSelect from "@/components/eam/search-select";
import PrintDocument, { PrintJob } from "@/components/eam/print-document";
import { menuFor } from "@/lib/eam/access";
import { expiry } from "@/lib/eam/engine";
import {
  Camera,
  Snowflake,
  LayoutDashboard,
  Package,
  Truck,
  Database,
  Layers,
  Thermometer,
  Users,
  Settings,
  ClipboardList,
} from "lucide-react";
import {
  Command,
  EamState,
  Role,
  roles,
  scenarioNames,
  totals,
  contents,
  allowed,
} from "@/lib/eam/engine";
import { supabaseClient } from "@/lib/adapters";
import "./style.css";
const Twin = dynamic(() => import("@/components/eam/twin"), {
  ssr: false,
  loading: () => <div className="eam-loading">Menyiapkan denah EAM…</div>,
});
type Mode = "DEMO_SIMULATION" | "LIVE_READ_ONLY" | "CONTROLLED_OPERATIONAL";
type Result = {
  state: EamState;
  revision: number;
  backend: string;
  role?: Role;
  live?: unknown;
};
const icons = {
  Overview: LayoutDashboard,
  Operasional: ClipboardList,
  Inventori: Package,
  Pemuatan: Truck,
  "Master Data": Database,
  "Master Palet": Layers,
  Suhu: Thermometer,
  Pekerja: Users,
  Konfigurasi: Settings,
};
function QR({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, { width: 160, margin: 1 }).then((s) => {
      if (active) setSrc(s);
    });
    return () => {
      active = false;
    };
  }, [value]);
  return src ? (
    <Image unoptimized src={src} alt={`QR ${value}`} width={130} height={130} />
  ) : null;
}
export default function EamPage() {
  const [cameraTarget, setCameraTarget] = useState<
    "pallet" | "sack" | "assign" | "loading" | null
  >(null);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [result, setResult] = useState<Result | null>(null),
    [mode, setMode] = useState<Mode>("DEMO_SIMULATION"),
    [role, setRole] = useState<Role>("SUPER_ADMIN"),
    [tab, setTab] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [notice, setNotice] = useState("");
  const id = useRef(""),
    current = useRef<Result | null>(null),
    pending = useRef(false),
    requestError = useRef(""),
    modeRef = useRef<Mode>(mode),
    roleRef = useRef(role);
  const [token, setToken] = useState(""),
    tokenRef = useRef("");

  const [qr, setQr] = useState(""),
    [pallet, setPallet] = useState("PLT-001"),
    [order, setOrder] = useState(""),
    [location, setLocation] = useState("R3-L1-S1");
  const [product, setProduct] = useState("PRD-001"),
    [owner, setOwner] = useState("PT Unggas Sejahtera (Fiktif)"),
    [batch, setBatch] = useState("BATCH-001"),
    [kg, setKg] = useState(20),
    [production, setProduction] = useState("2026-10-13");
  const [truck, setTruck] = useState("B 9002 DEMO"),
    [destination, setDestination] = useState("Gudang pelanggan demo"),
    [search, setSearch] = useState(""),
    [confirm, setConfirm] = useState<Command | null>(null);
  const [chatOpen, setChatOpen] = useState(false),
    [question, setQuestion] = useState(""),
    [chat, setChat] = useState<
      { role: "user" | "assistant"; content: string }[]
    >([]),
    [chatBusy, setChatBusy] = useState(false);
  useEffect(() => {
    if (!menuFor(role).includes(tab)) setTab(menuFor(role)[0]);
  }, [role, tab]);
  const request = useCallback(async (command?: Command, provision = false) => {
    if (pending.current) return false;
    requestError.current = "";
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/eam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tokenRef.current
            ? { Authorization: `Bearer ${tokenRef.current}` }
            : {}),
        },
        body: JSON.stringify({
          id:
            modeRef.current === "CONTROLLED_OPERATIONAL"
              ? "00000000-0000-4000-8000-00000000ea01"
              : id.current,
          mode: modeRef.current,
          role: roleRef.current,
          revision: current.current?.revision,
          requestId: crypto.randomUUID(),
          provision,
          command,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      current.current = data;
      setResult(data);
      if (data.state)
        setOrder((previous) =>
          command?.type === "order"
            ? data.state.orders.at(-1)?.id || ""
            : data.state.orders.some((o: { id: string }) => o.id === previous)
              ? previous
              : data.state.orders.find(
                  (o: { dispatched: boolean }) => !o.dispatched,
                )?.id || "",
        );
      if (command?.type === "pack" && data.state?.sacks.length)
        setQr(data.state.sacks.at(-1).id);
      if (data.role) {
        setRole(data.role);
        roleRef.current = data.role;
      }
      setError("");
      if (command && command.type !== "tick")
        setNotice("Transaksi tersimpan di database");
      return true;
    } catch (e) {
      requestError.current = e instanceof Error ? e.message : "Koneksi gagal";
      setError(requestError.current);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    let run = localStorage.getItem("eam-run-v4");
    if (!run) {
      run = crypto.randomUUID();
      localStorage.setItem("eam-run-v4", run);
    }
    id.current = run;
    const client = supabaseClient();
    let disposed = false;
    void (async () => {
      const session = client
        ? (await client.auth.getSession()).data.session
        : null;
      if (disposed) return;
      tokenRef.current = session?.access_token || "";
      setToken(tokenRef.current);
      if (!session) {
        window.location.replace("/login");
        return;
      }
      const profile = await client!
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      const aliases: Record<string, Role> = {
        admin: "SUPER_ADMIN",
        packing: "ADMIN_PACKING",
        office: "ADMIN_OFFICE",
        loading: "ADMIN_LOADING",
      };
      const resolved = aliases[profile.data?.role] || profile.data?.role;
      if (!roles.includes(resolved)) {
        await client!.auth.signOut({ scope: "local" });
        window.location.replace("/login");
        return;
      }
      roleRef.current = resolved;
      setRole(resolved);
      setAccountEmail(session.user.email || "");
      const chosenMode =
        sessionStorage.getItem("eam-login-mode") === "DEMO_SIMULATION"
          ? "DEMO_SIMULATION"
          : "CONTROLLED_OPERATIONAL";
      modeRef.current = chosenMode;
      setMode(chosenMode);
      setAuthReady(true);
      await request();
    })();
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token || "";
      setToken(tokenRef.current);
      if (!session) window.location.replace("/login");
    });
    return () => {
      disposed = true;
      subscription?.data.subscription.unsubscribe();
    };
  }, [request]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        modeRef.current === "DEMO_SIMULATION" &&
        current.current?.state?.running
      )
        void request({ type: "tick" });
    }, 1000);
    return () => clearInterval(timer);
  }, [request]);
  useEffect(() => {
    if (mode !== "CONTROLLED_OPERATIONAL" || !token) return;
    const c = supabaseClient();
    if (!c) return;
    const channel = c
      .channel("eam-runs")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "eam_operational_runs",
          filter: "id=eq.00000000-0000-4000-8000-00000000ea01",
        },
        () => void request(),
      )
      .subscribe();
    return () => {
      void c.removeChannel(channel);
    };
  }, [mode, token, request]);
  async function scanAndSave(
    target: "assign" | "loading",
    code: string,
  ): Promise<string | null> {
    if (pending.current)
      return "Transaksi sebelumnya masih diproses. Scan kembali setelah selesai.";
    const state = current.current?.state;
    if (!state) return "Workspace belum siap.";
    const found = resolveCameraCode(state, "sack", code);
    if (found.error) {
      setError(found.error);
      return found.error;
    }
    setQr(found.qr);
    setSelected(found.id);
    const item = state.sacks.find((a) => a.id === found.id)!;
    if (target === "loading") {
      const issue = loadingScanIssue(state, order, found.id);
      if (issue) {
        setError(issue);
        return issue;
      }
    }
    setError("");
    if (target === "loading" && item.status === "LOADING") {
      setNotice(
        "Karung sudah masuk loading. Tidak ditambahkan ulang; gunakan Batalkan Loading jika diperlukan.",
      );
      return null;
    }
    if (target === "assign" && item.pallet === pallet) {
      setNotice(
        "Karung sudah ada di palet " + pallet + ". Tidak ditambahkan ulang.",
      );
      return null;
    }
    const ok = await request(
      target === "loading"
        ? { type: "load", order, sack: found.id }
        : { type: "assign", pallet, sack: found.id },
    );
    if (!ok)
      return (
        requestError.current ||
        "Scan belum tersimpan. Muat ulang data dan coba lagi."
      );
    setNotice(
      found.id + " otomatis masuk " + (target === "loading" ? order : pallet),
    );
    return null;
  }
  const act = (command: Command) => {
    if (mode === "LIVE_READ_ONLY") return;
    void request(command);
  };
  async function changeMode(next: Mode) {
    modeRef.current = next;
    setMode(next);
    setResult(null);
    current.current = null;
    setChat([]);
    await request();
  }
  async function logout() {
    setBusy(true);
    const { error } = await supabaseClient()!.auth.signOut({ scope: "local" });
    if (error) {
      setError("Logout gagal. Coba lagi.");
      setBusy(false);
      return;
    }
    tokenRef.current = "";
    current.current = null;
    setResult(null);
    setToken("");
    sessionStorage.removeItem("eam-login-mode");
    window.location.replace("/login");
  }
  const s = result?.state;
  const t = s ? totals(s) : null;
  const chosen = s?.sacks.find((a) => a.id === selected || a.qr === selected);
  const worker = s?.workers.find((w) => w.id === selected);
  const selectedPallet = s?.pallets.find(
    (p) => p.id === selected || p.id === pallet,
  );
  const loading = s?.orders.find((o) => o.id === order);
  const dispatchOrder =
    confirm?.type === "dispatch"
      ? s?.orders.find((o) => o.id === confirm.order)
      : undefined;
  const dispatchSacks =
    dispatchOrder?.items
      .filter((i) => !i.cancelled)
      .map((i) => s?.sacks.find((a) => a.id === i.sack))
      .filter((a): a is EamState["sacks"][number] => !!a) || [];
  const scan = s?.sacks.find((a) => a.id === qr || a.qr === qr);
  const p = s?.products.find((p) => p.id === product);
  function find() {
    if (!s) return;
    const sk = s.sacks.find(
      (a) => a.id === search.trim() || a.qr === search.trim(),
    );
    const pl = s.pallets.find(
      (a) => a.id === search.trim() || a.qr === search.trim(),
    );
    if (!sk && !pl) return setError("QR tidak ditemukan");
    setSelected(sk?.id || pl!.id);
    if (pl) setPallet(pl.id);
    setTab("Overview");
  }
  async function ask() {
    if (!question.trim() || !s || chatBusy) return;
    const messages = [
      ...chat,
      { role: "user" as const, content: question },
    ].slice(-11);
    setChat(messages);
    setQuestion("");
    setChatBusy(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({
          messages,
          context: {
            mode,
            capturedAt: new Date().toISOString(),
            source: "SIMULATED EAM",
            simulationSeconds: s.clock,
            totals: t,
            channels: s.channels.map(({ history, ...c }) => ({
              ...c,
              history: history.slice(-5),
            })),
            products: s.products,
            pallets: s.pallets.map((p) => ({
              ...p,
              sacks: contents(s, p.id).length,
            })),
            sacks: s.sacks,
            events: s.events.slice(-10),
            orders: s.orders,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setChat([...messages, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI gagal");
    } finally {
      setChatBusy(false);
    }
  }
  const button = (label: string, command: Command) => (
    <button
      disabled={
        busy || mode === "LIVE_READ_ONLY" || !allowed(role, command.type)
      }
      onClick={() => act(command)}
    >
      {label}
    </button>
  );
  if (!authReady)
    return (
      <div className="eam-app" style={{ padding: 40 }}>
        Memeriksa sesi petugas…
      </div>
    );
  return (
    <div className="eam-app">
      <aside className="eam-sidebar">
        <Link href="/eam" className="eam-brand">
          <span>
            <Snowflake size={25} />
          </span>
          <div>
            ENDER AGRO MITRA<small>Cold Storage · Digital Twin</small>
          </div>
        </Link>
        <p className="eam-overline">FACTORY WORKSPACE</p>
        {menuFor(role).map((name) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => setTab(name)}
          >
            {(() => {
              const Icon = icons[name as keyof typeof icons];
              return <Icon size={18} />;
            })()}{" "}
            {name === "Overview" ? "Ringkasan" : name}
          </button>
        ))}
        <div className="eam-sidebar-bottom">
          <b>V4 · OPERATIONS TWIN</b>
          <p>
            Denah referensi EAM
            <br />
            SIMULASI OPERASIONAL
          </p>
          <Link href="/legacy">Buka CSMS sebelumnya ↗</Link>
        </div>
      </aside>
      <div className="eam-main">
        <header className="eam-topbar">
          <span>PT Ender Agro Mitra / {tab}</span>
          <select
            aria-label="Mode operasi"
            value={mode}
            disabled={busy}
            onChange={(e) => void changeMode(e.target.value as Mode)}
          >
            <option>DEMO_SIMULATION</option>
            <option>LIVE_READ_ONLY</option>
            <option>CONTROLLED_OPERATIONAL</option>
          </select>
          <small>
            {accountEmail} · {role}
          </small>
          <button disabled={busy} onClick={() => void logout()}>
            Logout
          </button>
          <select
            aria-label="Peran demo"
            value={role}
            disabled={
              !!token || mode !== "DEMO_SIMULATION" || busy || s?.running
            }
            onChange={(e) => {
              setRole(e.target.value as Role);
              roleRef.current = e.target.value as Role;
            }}
          >
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </header>
        <main>
          <div className="eam-title">
            <div>
              <p className="eam-overline">EAM FACTORY INTELLIGENCE</p>
              <h1>
                {tab === "Overview" ? "Pabrik dalam satu pandangan" : tab}
              </h1>
              <p>ABF → packing → palet → cold storage → loading → dispatch</p>
            </div>
            <span className="eam-badge">
              {mode === "DEMO_SIMULATION" ? "SIMULASI · DATA FIKTIF" : mode}
            </span>
          </div>
          {error && (
            <div className="eam-error" role="alert">
              {error}
              <button onClick={() => void request()}>Muat ulang data</button>
            </div>
          )}
          {notice && (
            <div className="eam-notice">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {!s && (
            <section className="eam-card">
              <h2>Koneksi workspace</h2>
              <p>
                Demo menggunakan PostgreSQL lokal terisolasi. Mode live dan
                controlled memerlukan login Supabase.
              </p>
              <Link href="/login">Buka halaman login</Link>
              <button onClick={() => void changeMode("DEMO_SIMULATION")}>
                Kembali ke demo
              </button>
              {mode === "CONTROLLED_OPERATIONAL" && (
                <button
                  disabled={!token || busy}
                  onClick={() => void request(undefined, true)}
                >
                  Buat workspace operasional kosong (Super Admin)
                </button>
              )}
              {result?.live != null && (
                <>
                  <h3>Snapshot live (tanpa mutasi otomatis)</h3>
                  <pre>{JSON.stringify(result.live, null, 2)}</pre>
                  <Link href="/legacy">Buka dashboard CSMS live lengkap</Link>
                </>
              )}
            </section>
          )}
          {s && t && (
            <>
              <div className="eam-kpis">
                {[
                  ["Karung fisik", t.sacks, "STORED + LOADING"],
                  ["Stok tersedia", t.available, "Siap diambil"],
                  ["Palet aktif", t.pallets, "Isi aktif palet"],
                  ["Total PCS", t.pcs, "Snapshot master"],
                  [
                    "Berat bersih",
                    `${t.kg.toLocaleString("id-ID")} kg`,
                    "Input KG manual",
                  ],
                  ["Loading", t.loading, "Belum dispatch"],
                ].map(([label, value, hint]) => (
                  <button
                    key={label}
                    onClick={() => {
                      setTab(label === "Loading" ? "Pemuatan" : "Inventori");
                      setSelected(s.activeCS || "anteroom");
                    }}
                  >
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <span>{hint}</span>
                  </button>
                ))}
              </div>
              {!s.activeCS && (
                <div className="eam-warning">
                  CS-01 belum dipetakan ke ruang fisik. Pilih Cold Storage Besar
                  atau Kecil di Konfigurasi. Dua ruang digambar; hanya satu yang
                  aktif.
                  <button onClick={() => setTab("Konfigurasi")}>
                    Atur pemetaan
                  </button>
                </div>
              )}
              {tab === "Overview" && (
                <>
                  <div className="eam-channel-strip">
                    {s.channels.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelected(c.zone);
                          setTab("Suhu");
                        }}
                        className={c.alarm ? "alarm" : ""}
                      >
                        <small>{c.id} · SIMULASI</small>
                        <b>
                          {c.connected ? `${c.value.toFixed(1)}°C` : "OFFLINE"}
                        </b>
                        <span>
                          {c.alarm
                            ? "ALARM"
                            : c.connected
                              ? "Normal"
                              : "Tidak tersedia"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="eam-summary">
                    Batch ABF belum selesai:{" "}
                    {s.batches.filter((b) => !b.completed).length} · Alarm
                    aktif:{" "}
                    {s.channels.filter((c) => c.alarm || !c.connected).length} ·
                    Opname: {s.opname.at(-1)?.scanned.length || 0}/
                    {s.opname.at(-1)?.expected.length || 0} · {s.workers.length}{" "}
                    pekerja simulasi
                  </p>
                  <div className="eam-controls">
                    <select
                      aria-label="Skenario simulasi"
                      value={s.scenario}
                      disabled={s.cursor > 0 || busy}
                      onChange={(e) =>
                        act({
                          type: "control",
                          action: "pause",
                          scenario: Number(e.target.value),
                        })
                      }
                    >
                      {scenarioNames.map((n, i) => (
                        <option key={i} value={i}>
                          {i + 1}. {n}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Kecepatan simulasi"
                      value={s.speed}
                      onChange={(e) =>
                        act({
                          type: "control",
                          action: s.running ? "start" : "pause",
                          speed: Number(e.target.value) as 1 | 2 | 5 | 10,
                        })
                      }
                    >
                      {[1, 2, 5, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}×
                        </option>
                      ))}
                    </select>
                    {button(s.running ? "Jeda" : "Mulai / lanjut", {
                      type: "control",
                      action: s.running ? "pause" : "start",
                    })}
                    {button("Step +1s", { type: "control", action: "step" })}
                    <button
                      onClick={() =>
                        setConfirm({ type: "control", action: "reset" })
                      }
                    >
                      Reset
                    </button>
                    <button
                      onClick={() =>
                        setConfirm({ type: "control", action: "replay" })
                      }
                    >
                      Replay seed {s.seed}
                    </button>
                    <b>{s.clock}s</b>
                  </div>
                  <Twin state={s} selected={selected} onSelect={setSelected} />
                  <div className="eam-grid">
                    <section className="eam-card">
                      <h2>Inspeksi objek</h2>
                      <div className="eam-inline">
                        <input
                          placeholder="Scan QR / SK-00001 / PLT-001"
                          aria-label="Cari QR"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") find();
                          }}
                        />
                        <button onClick={find}>Cari & sorot</button>
                      </div>
                      {chosen ? (
                        <>
                          <h3>
                            {chosen.id} · {chosen.status}
                          </h3>
                          <QR value={chosen.qr} />
                          <p>
                            {
                              s.products.find((p) => p.id === chosen.product)
                                ?.name
                            }{" "}
                            · {chosen.owner}
                          </p>
                          <p>
                            {chosen.pcs} PCS · {chosen.kg} KG · Palet{" "}
                            {chosen.pallet || "—"} · {chosen.location || "—"}
                          </p>
                        </>
                      ) : worker ? (
                        <>
                          <h3>
                            {worker.id} · {worker.role}
                          </h3>
                          <p>
                            {worker.status} · {worker.zone} · {worker.task}
                          </p>
                          {worker.history.map((h, i) => (
                            <p key={i}>{h}</p>
                          ))}
                        </>
                      ) : (
                        <>
                          <h3>
                            {s.layout.find((z) => z.id === selected)?.name ||
                              selected ||
                              "Pilih ruang, rak, palet, karung atau pekerja"}
                          </h3>
                          <p>Ruang aktif: {s.activeCS || "Belum dipetakan"}</p>
                          {selected.startsWith("R") &&
                            s.pallets
                              .filter((p) =>
                                p.location?.startsWith(selected + "-"),
                              )
                              .map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setSelected(p.id);
                                    setPallet(p.id);
                                  }}
                                >
                                  {p.id} · {contents(s, p.id).length} karung
                                </button>
                              ))}
                          {selected.startsWith("PLT") && selectedPallet && (
                            <>
                              <QR value={selectedPallet.qr} />
                              <p>
                                {contents(s, selectedPallet.id).length} karung ·{" "}
                                {selectedPallet.location}
                              </p>
                              {contents(s, selectedPallet.id).map((sk) => (
                                <button
                                  key={sk.id}
                                  onClick={() => setSelected(sk.id)}
                                >
                                  {sk.id}
                                </button>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </section>
                    <section className="eam-card">
                      <h2>
                        Event timeline <small>SIMULASI</small>
                      </h2>
                      <div className="eam-timeline">
                        {s.events
                          .slice(-30)
                          .reverse()
                          .map((e) => (
                            <div key={e.id}>
                              <b>
                                {e.at}s · {e.kind}
                              </b>
                              <small>{e.actor}</small>
                              <p>{e.detail}</p>
                            </div>
                          ))}
                        {!s.events.length && (
                          <p>
                            Mulai skenario untuk melihat kejadian operasional.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                </>
              )}
              {tab === "Operasional" && (
                <div className="eam-grid">
                  <section className="eam-card">
                    <h2>1. Packing & QR karung</h2>
                    <SearchSelect
                      label="Batch produksi"
                      value={batch}
                      options={s.batches.map((b) => ({
                        value: b.id,
                        label: `${b.id} · ${b.verified ? "Terverifikasi" : "Belum verifikasi"}`,
                      }))}
                      onChange={(v) => {
                        setBatch(v);
                        const b = s.batches.find((b) => b.id === v);
                        if (b) setProduct(b.product);
                      }}
                    />
                    {allowed(role, "verify") &&
                      button("Verifikasi batch (Office)", {
                        type: "verify",
                        batch,
                      })}
                    <SearchSelect
                      label="Produk"
                      value={product}
                      options={s.products
                        .filter((p) => p.active)
                        .map((p) => ({
                          value: p.id,
                          label: `${p.id} · ${p.name}`,
                        }))}
                      onChange={(v) => {
                        setProduct(v);
                        const compatible = s.batches.find(
                          (b) => b.product === v && b.verified,
                        );
                        setBatch(compatible?.id || "");
                      }}
                    />
                    <p className="eam-badge">
                      {p?.pcs} PCS / karung · {p?.months} bulan · otomatis dari
                      master
                    </p>
                    <SearchSelect
                      label="Owner / pemilik"
                      value={owner}
                      options={s.owners.map((o) => ({ value: o, label: o }))}
                      onChange={setOwner}
                    />
                    <label>
                      Tanggal produksi
                      <input
                        type="date"
                        value={production}
                        onChange={(e) => setProduction(e.target.value)}
                      />
                    </label>
                    <label>
                      Expired (otomatis dari master produk)
                      <input
                        type="date"
                        readOnly
                        value={(() => {
                          try {
                            return production && p
                              ? expiry(production, p.months)
                              : "";
                          } catch {
                            return "";
                          }
                        })()}
                      />
                    </label>
                    <label>
                      KG manual
                      <input
                        type="number"
                        min=".1"
                        step=".1"
                        value={kg}
                        onChange={(e) => setKg(Number(e.target.value))}
                      />
                    </label>
                    {button("Konfirmasi packing", {
                      type: "pack",
                      product,
                      owner,
                      batch,
                      kg,
                      production,
                    })}
                    <p>Integrasi timbangan digital tidak diaktifkan.</p>
                    <label>
                      QR / kode karung
                      <input
                        value={qr}
                        onChange={(e) => setQr(e.target.value)}
                        placeholder="SK-00101"
                      />
                    </label>
                    <button
                      disabled={busy}
                      onClick={() => setCameraTarget("sack")}
                    >
                      <Camera size={16} /> Scan kamera karung
                    </button>
                    {button("Konfirmasi jahit / segel", {
                      type: "seal",
                      sack: qr || "-",
                    })}
                    {scan && (
                      <>
                        <p>
                          {scan.id} · {scan.status} · {scan.pcs} PCS
                        </p>
                        {scan.status !== "PACKED" && (
                          <>
                            <QR value={scan.qr} />
                            <button
                              onClick={() =>
                                setPrintJob({ kind: "sack", id: scan.id })
                              }
                            >
                              Pratinjau / cetak label karung
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </section>
                  <section className="eam-card">
                    <h2>2. Palletisasi & putaway</h2>
                    <p>Pilih palet yang sudah dibuat di menu Master Palet.</p>
                    <SearchSelect
                      label="Palet"
                      value={pallet}
                      options={s.pallets.map((p) => ({
                        value: p.id,
                        label: `${p.id} · ${p.location || "Belum ditempatkan"}`,
                      }))}
                      onChange={setPallet}
                    />
                    <label>
                      Scan QR palet
                      <input
                        aria-label="Scan QR palet"
                        placeholder="EAM:PLT-001"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setPallet(
                              e.currentTarget.value.trim().replace("EAM:", ""),
                            );
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </label>
                    <button
                      disabled={busy}
                      onClick={() => setCameraTarget("pallet")}
                    >
                      <Camera size={16} /> Scan kamera palet
                    </button>
                    {selectedPallet && <QR value={selectedPallet.qr} />}
                    <label>
                      Scan QR karung (otomatis masuk palet)
                      <input
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void scanAndSave("assign", e.currentTarget.value);
                          }
                        }}
                        value={qr}
                        onChange={(e) => setQr(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy}
                      onClick={() => setCameraTarget("assign")}
                    >
                      <Camera size={16} /> Scan kamera untuk isi palet
                    </button>
                    <p>
                      Scan kamera langsung tersimpan. Scanner USB / kode manual:
                      tekan Enter.
                    </p>
                    {button("Konfirmasi palletisasi", {
                      type: "palletConfirm",
                      pallet,
                    })}
                    {allowed(role, "putaway") && (
                      <>
                        <label>
                          Lokasi rak / level / slot
                          <input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="R3-L1-S1"
                          />
                        </label>
                        {button("Putaway / transfer palet", {
                          type: "putaway",
                          pallet,
                          location,
                        })}
                      </>
                    )}
                    <h3>
                      {pallet} · {contents(s, pallet).length} karung
                    </h3>
                    <p>
                      {contents(s, pallet).reduce((n, a) => n + a.pcs, 0)} PCS ·{" "}
                      {contents(s, pallet)
                        .reduce((n, a) => n + a.kg, 0)
                        .toFixed(2)}{" "}
                      KG
                    </p>
                    {contents(s, pallet).map((a) => (
                      <p key={a.id}>
                        {a.id} · {a.pcs} PCS · {a.kg} KG
                      </p>
                    ))}
                  </section>
                </div>
              )}
              {tab === "Inventori" && (
                <>
                  <section className="eam-card">
                    <h2>Inventori & FEFO</h2>
                    <input
                      aria-label="Filter inventori"
                      placeholder="Cari kode / produk / pemilik / palet"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="eam-table">
                      <table>
                        <thead>
                          <tr>
                            {[
                              "Karung / QR",
                              "Produk",
                              "Pemilik",
                              "PCS",
                              "KG",
                              "Palet / lokasi",
                              "Kedaluwarsa",
                              "Status",
                            ].map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...s.sacks]
                            .sort(
                              (a, b) =>
                                a.expiry.localeCompare(b.expiry) ||
                                a.id.localeCompare(b.id),
                            )
                            .filter((a) =>
                              JSON.stringify(a)
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                            )
                            .map((a) => (
                              <tr
                                key={a.id}
                                onClick={() => {
                                  setSelected(a.id);
                                  setQr(a.id);
                                }}
                              >
                                <td>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPrintJob({ kind: "sack", id: a.id });
                                    }}
                                    disabled={a.status === "PACKED"}
                                  >
                                    {a.id} · Cetak label
                                  </button>
                                </td>
                                <td>
                                  {
                                    s.products.find((p) => p.id === a.product)
                                      ?.name
                                  }
                                </td>
                                <td>{a.owner}</td>
                                <td>{a.pcs}</td>
                                <td>{a.kg}</td>
                                <td>
                                  {a.pallet || "—"}
                                  <small>{a.location}</small>
                                </td>
                                <td>{a.expiry}</td>
                                <td>{a.status}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Urut kedaluwarsa paling awal (FEFO). LOADING tetap
                      dihitung fisik, tetapi tidak tersedia.
                    </p>
                  </section>
                  {allowed(role, "opnameStart") && (
                    <section className="eam-card">
                      <h2>Stock opname & koreksi PCS</h2>
                      {button("Mulai sesi opname", { type: "opnameStart" })}
                      <input
                        value={qr}
                        onChange={(e) => setQr(e.target.value)}
                        placeholder="Scan karung"
                      />
                      {button("Scan opname", {
                        type: "opnameScan",
                        sack: qr || "-",
                      })}
                      {button("Tutup sesi opname", { type: "opnameClose" })}
                      <p>
                        {s.opname.at(-1)?.scanned.length || 0} dari{" "}
                        {s.opname.at(-1)?.expected.length || 0} karung di-scan.
                        Status {s.opname.at(-1)?.closed ? "ditutup" : "terbuka"}
                        .
                      </p>
                      <Discrepancy
                        disabled={!allowed(role, "discrepancy") || busy}
                        sack={qr}
                        submit={act}
                      />
                      <details>
                        <summary>Ledger inventori ({s.ledger.length})</summary>
                        {s.ledger
                          .slice(-30)
                          .reverse()
                          .map((l, i) => (
                            <p key={i}>
                              {l.at}s · {l.sack} · {l.kind} · {l.pcs} PCS ·{" "}
                              {l.kg} KG
                            </p>
                          ))}
                      </details>
                    </section>
                  )}
                </>
              )}
              {tab === "Pemuatan" && (
                <div className="eam-grid">
                  <section className="eam-card">
                    <h2>Order & scan individual sack QR</h2>
                    <label>
                      Order
                      <select
                        value={order}
                        onChange={(e) => {
                          setOrder(e.target.value);
                          setError("");
                          setQr("");
                        }}
                      >
                        <option value="">Pilih order terbuka untuk scan</option>
                        {s.orders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.id} ·{" "}
                            {o.dispatched ? "SUDAH DISPATCH" : "TERBUKA"} ·{" "}
                            {o.owner}
                          </option>
                        ))}
                      </select>
                    </label>
                    <details>
                      <summary>Buat order loading</summary>
                      <label>
                        Plat kendaraan
                        <input
                          value={truck}
                          onChange={(e) => setTruck(e.target.value)}
                        />
                      </label>
                      <label>
                        Tujuan
                        <input
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                        />
                      </label>
                      <SearchSelect
                        label="Owner / pemilik"
                        value={owner}
                        options={s.owners.map((o) => ({ value: o, label: o }))}
                        onChange={setOwner}
                      />
                      {button("Buat order", {
                        type: "order",
                        truck,
                        destination,
                        owner,
                      })}
                    </details>
                    <label>
                      Scan / cari QR KARUNG
                      <input
                        value={qr}
                        onChange={(e) => {
                          setQr(e.target.value);
                          setSelected(e.target.value.replace("EAM:", ""));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void scanAndSave("loading", e.currentTarget.value);
                          }
                        }}
                        placeholder="Scan kode lalu Enter — otomatis masuk order"
                      />
                    </label>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (!loading || loading.dispatched) {
                          setError(
                            "Pilih order loading TERBUKA sebelum scan kamera.",
                          );
                          return;
                        }
                        setCameraTarget("loading");
                      }}
                    >
                      <Camera size={16} /> Scan kamera loading
                    </button>
                    {scan && (
                      <div className="eam-scan">
                        <h3>
                          {scan.id} · {scan.status}
                        </h3>
                        <p>
                          {scan.owner} · {scan.pcs} PCS · {scan.kg} KG
                        </p>
                        <p>
                          Palet {scan.pallet || "Di daftar loading"} · lokasi{" "}
                          {scan.location || "—"}
                        </p>
                        {scan.status === "LOADING" ? (
                          <button
                            disabled={!allowed(role, "cancel") || busy}
                            onClick={() =>
                              setConfirm({
                                type: "cancel",
                                order,
                                sack: scan.id,
                                confirmed: true,
                              })
                            }
                          >
                            BATALKAN LOADING
                          </button>
                        ) : scan.status === "STORED" ? (
                          <p>
                            Scan kamera atau tekan Enter pada kode untuk
                            langsung memasukkan barang ke order.
                          </p>
                        ) : (
                          <p>
                            Karung tidak dapat dimuat. Dispatch memerlukan
                            proses retur/koreksi terpisah.
                          </p>
                        )}
                      </div>
                    )}
                    <p>
                      Scan palet tidak digunakan untuk loading. Scan ulang
                      karung LOADING membuka tombol pembatalan.
                    </p>
                  </section>
                  <section className="eam-card">
                    <h2>
                      {loading?.id} · {loading?.truck}
                    </h2>
                    <p>
                      {loading?.destination} · {loading?.owner}
                    </p>
                    <h3>
                      {loading?.items.filter((i) => !i.cancelled).length || 0}{" "}
                      {loading?.dispatched
                        ? "karung terkirim"
                        : "karung loading"}
                    </h3>
                    {loading?.items.map((item, i) => (
                      <p key={i}>
                        <button
                          onClick={() => {
                            setQr(item.sack);
                            setSelected(item.sack);
                          }}
                        >
                          {item.sack}
                        </button>{" "}
                        · asal {item.pallet} / {item.location} ·{" "}
                        {item.cancelled
                          ? "DIBATALKAN"
                          : loading?.dispatched
                            ? "TERKIRIM"
                            : "AKTIF"}
                      </p>
                    ))}
                    <button
                      disabled={
                        !loading ||
                        loading.dispatched ||
                        !loading.items.some((i) => !i.cancelled) ||
                        mode === "LIVE_READ_ONLY" ||
                        busy ||
                        !allowed(role, "dispatch")
                      }
                      className="master-primary"
                      onClick={() =>
                        loading &&
                        setConfirm({ type: "dispatch", order: loading.id })
                      }
                    >
                      {loading?.dispatched
                        ? "Loading selesai / sudah dispatch"
                        : "Finalisasi / konfirmasi loading"}
                    </button>
                    {loading?.document && (
                      <div className="eam-delivery">
                        <h2>SURAT JALAN · {loading.document.number}</h2>
                        <p>
                          {loading.document.at} · {loading.truck} →{" "}
                          {loading.destination}
                        </p>
                        <p>Pemilik: {loading.owner}</p>
                        <p>Produk: {loading.document.products.join(", ")}</p>
                        <p>
                          {loading.document.sacks} karung ·{" "}
                          {loading.document.pcs} PCS · {loading.document.kg} KG
                        </p>
                        <p>Disetujui: {loading.document.approvedBy}</p>
                        <button
                          onClick={() =>
                            setPrintJob({ kind: "delivery", id: loading.id })
                          }
                        >
                          Cetak surat jalan
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              )}
              {tab === "Suhu" && (
                <div className="eam-grid three">
                  {s.channels.map((c) => (
                    <section
                      key={c.id}
                      className={`eam-card ${c.alarm ? "alarm" : ""}`}
                    >
                      <h2>
                        {c.id} <small>SIMULASI</small>
                      </h2>
                      <strong className="eam-temperature">
                        {c.connected ? `${c.value.toFixed(1)}°C` : "OFFLINE"}
                      </strong>
                      <p>
                        Target {c.target}°C · terakhir t={c.last}s
                      </p>
                      <svg viewBox="0 0 260 70" className="eam-chart">
                        <polyline
                          fill="none"
                          stroke={c.alarm ? "#d44c4c" : "#188c85"}
                          strokeWidth="2"
                          points={c.history
                            .slice(-60)
                            .map(
                              (h, i, arr) =>
                                `${(i * 260) / Math.max(1, arr.length - 1)},${60 - (h.value + 60) * 0.8}`,
                            )
                            .join(" ")}
                        />
                      </svg>
                      <p>
                        {c.alarm
                          ? c.ack
                            ? "Alarm diakui"
                            : "ALARM AKTIF"
                          : "Normal"}{" "}
                        · arah {c.direction} · ambang {c.threshold}°C
                      </p>
                      {c.id.startsWith("ABF") && (
                        <p>Timer pembekuan demo: {c.timer}s</p>
                      )}
                      <ChannelForm
                        channel={c}
                        disabled={!allowed(role, "channel") || busy}
                        submit={act}
                      />
                      {c.alarm &&
                        button("Akui alarm", { type: "ack", id: c.id })}
                    </section>
                  ))}
                </div>
              )}
              {tab === "Pekerja" && (
                <div className="eam-grid three">
                  {s.workers.map((w) => (
                    <section className="eam-card" key={w.id}>
                      <h2>
                        {w.id} · {w.role}
                      </h2>
                      <p>
                        {w.status} · {w.zone}
                      </p>
                      <p>{w.task}</p>
                      <button
                        onClick={() => {
                          setSelected(w.id);
                          setTab("Overview");
                        }}
                      >
                        Lihat di 3D
                      </button>
                      {w.history.map((h, i) => (
                        <p key={i}>{h}</p>
                      ))}
                    </section>
                  ))}
                </div>
              )}
              {tab === "Master Data" && (
                <MasterData
                  state={s}
                  role={role}
                  busy={busy}
                  submit={request}
                />
              )}
              {tab === "Master Palet" && (
                <section className="eam-card">
                  <h2>Master Palet</h2>
                  <p>
                    Kelola QR palet di sini. Penambahan karung melalui scan pada
                    Operasional.
                  </p>
                  {button("Buat palet baru", { type: "palletCreate" })}
                  <div className="eam-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Palet</th>
                          <th>Lokasi</th>
                          <th>Karung aktif</th>
                          <th>Label</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.pallets.map((p) => (
                          <tr key={p.id}>
                            <td>{p.id}</td>
                            <td>{p.location || "Belum ditempatkan"}</td>
                            <td>{contents(s, p.id).length}</td>
                            <td>
                              <button
                                onClick={() =>
                                  setPrintJob({ kind: "pallet", id: p.id })
                                }
                              >
                                Cetak QR palet
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {tab === "Konfigurasi" && (
                <>
                  <section className="eam-card">
                    <h2>Pemetaan fisik & mesin</h2>
                    <p>
                      CS-01 adalah satu-satunya kanal cold storage aktif; admin
                      memilih ruang fisiknya. Lima kanal ABF terpisah dari
                      jumlah mesin.
                    </p>
                    <Mapping
                      state={s}
                      disabled={!allowed(role, "configure") || busy}
                      submit={act}
                    />
                    <h3>Layout editable · unit normalisasi</h3>
                    <LayoutForm
                      state={s}
                      disabled={!allowed(role, "zone") || busy}
                      submit={act}
                    />
                  </section>

                  <section className="eam-card">
                    <h2>Akun Supabase</h2>
                    <Link href="/login">Buka halaman login</Link>
                    <p>
                      Peran demo dapat dipilih untuk pengujian. Peran controlled
                      diambil dari profil Supabase dan diverifikasi server.
                    </p>
                  </section>
                </>
              )}
              <footer>
                {result.backend} · revision {result.revision} · Simulasi tidak
                menulis inventori CSMS lama ·{" "}
                <Link href="/legacy">CSMS sebelumnya & evaluasi AI suhu</Link>
              </footer>
            </>
          )}
        </main>
      </div>
      {cameraTarget && s && (
        <CameraScanner
          title={
            cameraTarget === "pallet"
              ? "Scan palet tujuan"
              : cameraTarget === "loading"
                ? "Scan karung loading"
                : "Scan karung packing"
          }
          onClose={() => setCameraTarget(null)}
          onDetected={async (code) => {
            if (cameraTarget === "assign" || cameraTarget === "loading") {
              const issue = await scanAndSave(cameraTarget, code);
              if (!issue) setCameraTarget(null);
              return issue;
            }
            const found = resolveCameraCode(s, cameraTarget, code);
            if (found.error) return found.error;
            setSelected(found.id);
            if (cameraTarget === "pallet") {
              setPallet(found.id);
              setNotice("Palet tujuan dipilih: " + found.id);
            } else {
              setQr(found.qr);
              setNotice(
                "Karung ditemukan: " +
                  found.id +
                  ". Periksa status lalu pilih tindakan.",
              );
            }
            setCameraTarget(null);
            return null;
          }}
        />
      )}
      {s && printJob && (
        <PrintDocument
          state={s}
          job={printJob}
          close={() => setPrintJob(null)}
        />
      )}
      {confirm && (
        <div className="eam-modal">
          <section className="eam-card">
            <h2>
              {confirm.type === "dispatch"
                ? "Finalisasi loading"
                : `Konfirmasi ${confirm.type}`}
            </h2>
            {dispatchOrder && (
              <div className="eam-dispatch-summary">
                <b>
                  {dispatchOrder.id} · {dispatchOrder.truck}
                </b>
                <p>
                  {dispatchOrder.owner}
                  <br />
                  {dispatchOrder.destination}
                </p>
                <p>
                  <strong>
                    {dispatchSacks.length} karung ·{" "}
                    {dispatchSacks.reduce((n, a) => n + a.pcs, 0)} PCS ·{" "}
                    {dispatchSacks
                      .reduce((n, a) => n + a.kg, 0)
                      .toLocaleString("id-ID", {
                        maximumFractionDigits: 2,
                      })}{" "}
                    KG
                  </strong>
                </p>
                <p>Karung yang dibatalkan tidak ikut dikirim.</p>
              </div>
            )}
            <p>
              {confirm.type === "control"
                ? "Reset/replay mengganti state demo run ini dengan seed awal. Audit transaksi database tetap tersimpan."
                : confirm.type === "cancel"
                  ? "Karung dikembalikan ke palet dan lokasi asal sebelum dispatch."
                  : "Dispatch mengurangi stok fisik dan menerbitkan surat jalan. Pembatalan biasa tidak tersedia setelahnya."}
            </p>
            {error && (
              <p role="alert" className="master-error">
                {error}
              </p>
            )}
            <button disabled={busy} onClick={() => setConfirm(null)}>
              Kembali
            </button>
            <button
              disabled={busy || mode === "LIVE_READ_ONLY"}
              onClick={async () => {
                if (await request(confirm)) setConfirm(null);
              }}
            >
              {busy
                ? "Menyimpan…"
                : confirm.type === "dispatch"
                  ? "Ya, finalisasi & terbitkan surat jalan"
                  : "Konfirmasi"}
            </button>
          </section>
        </div>
      )}
      {s && (
        <div className="eam-ai">
          {chatOpen && (
            <section className="eam-card">
              <h2>
                Asisten EAM{" "}
                <button onClick={() => setChatOpen(false)}>×</button>
              </h2>
              <p>
                Ringkasan inventori & suhu demo dikirim ke OpenAI ketika
                bertanya.
              </p>
              <div role="log">
                {chat.map((m, i) => (
                  <p key={i}>
                    <b>{m.role === "user" ? "Anda" : "AI"}</b>
                    <br />
                    {m.content}
                  </p>
                ))}
                {chatBusy && <p>AI membaca snapshot…</p>}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask();
                }}
              >
                <input
                  aria-label="Pertanyaan EAM"
                  maxLength={1500}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Tanya stok, loading, suhu…"
                />
                <button disabled={chatBusy || !question.trim()}>Kirim</button>
              </form>
            </section>
          )}
          <button onClick={() => setChatOpen(!chatOpen)}>
            ✦ Asisten AI EAM
          </button>
        </div>
      )}
    </div>
  );
}
type Submit = { disabled: boolean; submit: (c: Command) => void };
function Mapping({ state, disabled, submit }: { state: EamState } & Submit) {
  const [room, setRoom] = useState(state.activeCS || ""),
    [machines, setMachines] = useState(state.machineCount);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (room)
          submit({
            type: "configure",
            activeCS: room as "cs-large" | "cs-small",
            machineCount: machines,
          });
      }}
    >
      <label>
        Ruang fisik aktif
        <select required value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">Pilih setelah verifikasi admin</option>
          <option value="cs-large">Cold Storage Besar</option>
          <option value="cs-small">Cold Storage Kecil</option>
        </select>
      </label>
      <label>
        Jumlah mesin fisik ABF
        <input
          type="number"
          min={1}
          max={20}
          value={machines}
          onChange={(e) => setMachines(+e.target.value)}
        />
      </label>
      <button disabled={disabled}>Simpan pemetaan</button>
    </form>
  );
}
function LayoutForm({ state, disabled, submit }: { state: EamState } & Submit) {
  const [id, setId] = useState("packing");
  const z = state.layout.find((z) => z.id === id)!;
  return (
    <div>
      <select value={id} onChange={(e) => setId(e.target.value)}>
        {state.layout.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
      <form
        key={`${id}-${z.x}-${z.z}-${z.w}-${z.d}`}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          submit({
            type: "zone",
            id,
            x: Number(f.get("x")),
            z: Number(f.get("z")),
            w: Number(f.get("w")),
            d: Number(f.get("d")),
          });
        }}
      >
        {(["x", "z", "w", "d"] as const).map((k) => (
          <label key={k}>
            {k}
            <input type="number" name={k} defaultValue={z[k]} step=".5" />
          </label>
        ))}
        <button disabled={disabled}>Simpan koordinat</button>
      </form>
    </div>
  );
}
function ChannelForm({
  channel: c,
  disabled,
  submit,
}: { channel: EamState["channels"][number] } & Submit) {
  return (
    <form
      key={`${c.threshold}-${c.direction}-${c.target}-${c.connected}`}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({
          type: "channel",
          id: c.id,
          target: Number(f.get("target")),
          threshold: Number(f.get("threshold")),
          direction: f.get("direction") as "above" | "below",
          connected: f.get("connected") === "on",
        });
      }}
    >
      <label>
        Target
        <input type="number" name="target" defaultValue={c.target} />
      </label>
      <label>
        Ambang
        <input type="number" name="threshold" defaultValue={c.threshold} />
      </label>
      <select name="direction" defaultValue={c.direction}>
        <option value="above">Alarm jika di atas ambang</option>
        <option value="below">Alarm jika di bawah ambang</option>
      </select>
      <label>
        <input type="checkbox" name="connected" defaultChecked={c.connected} />{" "}
        Sensor terhubung
      </label>
      <button disabled={disabled}>Simpan kanal</button>
    </form>
  );
}
function Discrepancy({ sack, disabled, submit }: { sack: string } & Submit) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({
          type: "discrepancy",
          sack,
          pcs: Number(f.get("pcs")),
          reason: String(f.get("reason")),
        });
      }}
    >
      <p>Koreksi oleh supervisor untuk {sack || "pilih karung"}</p>
      <input
        type="number"
        name="pcs"
        min={1}
        required
        placeholder="PCS fisik"
      />
      <input name="reason" required placeholder="Alasan discrepancy" />
      <button disabled={disabled || !sack}>Catat koreksi berotorisasi</button>
    </form>
  );
}
