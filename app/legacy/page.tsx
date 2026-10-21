"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { readingSource } from "@/lib/domain";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Factory,
  LayoutDashboard,
  MapPin,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Truck,
  Warehouse,
  Wifi,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useCSMS } from "@/lib/store";
import {
  Action,
  Config,
  inventory,
  owners,
  products,
  resolveSack,
  Room,
  RoomId,
  Sack,
  scenarios,
  Scenario,
  State,
  status,
} from "@/lib/domain";
import { MockScaleAdapter } from "@/lib/adapters";
import Effectiveness from "@/components/effectiveness";
import AIAssistant from "@/components/ai-assistant";
const Twin = dynamic(() => import("@/components/twin"), {
  ssr: false,
  loading: () => <div className="twin-loading">Memuat pabrik 3D…</div>,
});
type Tab =
  | "Ringkasan"
  | "Digital Twin"
  | "Inventori"
  | "Operasional"
  | "Pemuatan"
  | "Simulator"
  | "Pengaturan";
const nav = [
  { name: "Ringkasan", icon: LayoutDashboard },
  { name: "Digital Twin", icon: Box },
  { name: "Inventori", icon: Boxes },
  { name: "Operasional", icon: ClipboardCheck },
  { name: "Pemuatan", icon: Truck },
  { name: "Simulator", icon: Activity },
  { name: "Pengaturan", icon: Settings2 },
] as const;
const fmt = (n: number) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
const time = (value: string) =>
  new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
const statusLabels = {
  normal: "Normal",
  warning: "Peringatan",
  critical: "Kritis",
  offline: "Tidak tersedia",
};
function BackendConnection({
  mode,
  role,
  connect,
  disconnect,
}: {
  mode: string;
  role: string;
  connect: (email: string, password: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="card padded" style={{ marginBottom: 24 }}>
      <h3>Koneksi backend Supabase</h3>
      {mode === "supabase" ? (
        <>
          <p>
            Terhubung sebagai {role}. Seluruh operasi divalidasi database dan
            perubahan disinkronkan melalui Realtime.
          </p>
          <button
            className="button secondary"
            onClick={() => void disconnect()}
          >
            Keluar ke demo lokal
          </button>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await connect(email, password);
            setPassword("");
            setBusy(false);
          }}
        >
          <p>
            Demo lokal siap digunakan. Untuk mode backend, konfigurasi URL dan
            anon key di .env.local, jalankan migrasi + seed, lalu masuk dengan
            akun staf yang sudah memiliki profil peran.
          </p>
          <div className="form-grid">
            <Field label="Email staf">
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Kata sandi">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </div>
          <button disabled={busy} className="button primary" type="submit">
            {busy ? "Menghubungkan…" : "Masuk ke Supabase"}
          </button>
        </form>
      )}
    </section>
  );
}
function Badge({
  children,
  tone = "normal",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Chart({ room, large = false }: { room: Room; large?: boolean }) {
  const points = room.history.slice(-60);
  const min = Math.min(room.target - 3, ...points.map((p) => p.value));
  const max = Math.max(room.critical + 1, ...points.map((p) => p.value));
  const y = (v: number) => 80 - ((v - min) / (max - min)) * 70;
  const line = points
    .map((p, i) => `${(i / (points.length - 1)) * 400},${y(p.value)}`)
    .join(" ");
  return (
    <div className={large ? "chart large" : "chart"}>
      <svg
        viewBox="0 0 400 95"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Grafik suhu ${room.id}, ${readingSource(room)}`}
      >
        <defs>
          <linearGradient
            id={`fill-${room.id}-${large}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#1eaaa1" stopOpacity=".18" />
            <stop offset="100%" stopColor="#1eaaa1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 45, 70].map((n) => (
          <line
            key={n}
            x1="0"
            x2="400"
            y1={n}
            y2={n}
            stroke="#e8eeee"
            strokeDasharray="3 4"
          />
        ))}
        <line
          x1="0"
          x2="400"
          y1={y(room.warning)}
          y2={y(room.warning)}
          stroke="#e8b971"
          strokeDasharray="5 5"
        />
        <polygon
          points={`0,95 ${line} 400,95`}
          fill={`url(#fill-${room.id}-${large})`}
        />
        <polyline
          points={line}
          fill="none"
          stroke={status(room) === "critical" ? "#df5757" : "#159e96"}
          strokeWidth="2.2"
        />
      </svg>
      <div className="chart-axis">
        <span>{points.length ? time(points[0].at) : "—"}</span>
        <span>
          Riwayat {readingSource(room)} · {points.length} titik
        </span>
        <span>{time(room.lastUpdate)}</span>
      </div>
    </div>
  );
}
function RoomCard({
  room,
  state,
  onView,
}: {
  room: Room;
  state: State;
  onView: () => void;
}) {
  const stock = inventory(state, room.id);
  const capacity =
    state.config.racks * state.config.levels * state.config.slots;
  return (
    <section className="card room-card">
      <div className="card-head">
        <div className="room-title">
          <span className="icon-box">
            <Snowflake size={20} />
          </span>
          <div>
            <h3>{room.name}</h3>
            <small>
              {room.id} <span>·</span> {room.sensor}
            </small>
          </div>
        </div>
        <Badge tone={status(room)}>{statusLabels[status(room)]}</Badge>
      </div>
      <div className="temperature">
        <strong>
          {room.temperature.toFixed(1)}
          <sup>°C</sup>
        </strong>
        <div>
          Target <b>{room.target}°C</b>
          <small>{readingSource(room)}</small>
        </div>
      </div>
      <Chart room={room} />
      <div className="room-stats">
        <div>
          <small>Jumlah produk</small>
          <b>
            {fmt(stock.pcs)} <em>PCS</em>
          </b>
        </div>
        <div>
          <small>Berat bersih</small>
          <b>
            {fmt(stock.kg)} <em>KG</em>
          </b>
        </div>
        <div>
          <small>Utilisasi ruang</small>
          <b>
            {Math.round((stock.count / capacity) * 100)}
            <em>%</em>
          </b>
        </div>
      </div>
      <div className="progress">
        <span style={{ width: `${(stock.count / capacity) * 100}%` }} />
      </div>
      <footer>
        <span>
          <Wifi size={13} />{" "}
          {room.quality === "baik"
            ? `Diperbarui ${time(room.lastUpdate)}`
            : room.quality}
        </span>
        <button className="text-button" onClick={onView}>
          Lihat 3D <ArrowUpRight size={15} />
        </button>
      </footer>
    </section>
  );
}
function QR({ sack }: { sack: Sack }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(sack.qr, { margin: 1, width: 180 }).then(setUrl);
  }, [sack.qr]);
  return url ? (
    <Image
      unoptimized
      src={url}
      width={150}
      height={150}
      alt={`QR ${sack.id}`}
    />
  ) : null;
}
export default function Page() {
  const {
    state,
    act,
    reset,
    error,
    setError,
    mode,
    role,
    connect,
    disconnect,
  } = useCSMS();
  const [tab, setTab] = useState<Tab>("Ringkasan");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<RoomId | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  if (!state)
    return (
      <div className="boot">
        <Snowflake size={38} />
        <h2>CSMS</h2>
        <p>Menyiapkan pusat kendali…</p>
      </div>
    );
  const selected = state.sacks.find((s) => s.id === selectedId) ?? null;
  const total = inventory(state);
  const alertRooms = state.rooms.filter((r) => status(r) !== "normal");
  const goRoom = (id: RoomId) => {
    setFocus(id);
    setTab("Digital Twin");
  };
  const action = async (a: Action) => {
    const ok = await act(a);
    if (ok)
      setNotice(
        mode === "local"
          ? "Perubahan berhasil disimpan dalam demo lokal."
          : "Transaksi berhasil disimpan di Supabase.",
      );
    return ok;
  };
  const locate = (s: Sack) => {
    setSelectedId(s.id);
    setFocus(s.room);
    setTab("Digital Twin");
  };
  const search = () => {
    const s = resolveSack(state, query);
    if (s) {
      locate(s);
      setError("");
    } else setError("ID / QR karung tidak ditemukan. Contoh: KRG-00001");
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span>
            <Snowflake size={25} />
          </span>
          <div>
            CSMS<small>COLD STORAGE MANAGEMENT</small>
          </div>
        </Link>
        <div className="facility-switch">
          <span className="facility-icon">
            <Factory size={19} />
          </span>
          <div>
            Cirebon Frozen Food<small>Fasilitas demo</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">RUANG KERJA</div>
        <nav>
          {nav.map(({ name, icon: Icon }, i) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              <Icon size={19} />
              {name}
              {name === "Simulator" ? (
                <span className="nav-tag">DEMO</span>
              ) : i === 2 ? (
                <small>500+</small>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-health">
            <span className="green-dot" />
            <b>Sistem demo aktif</b>
            <small>2 ruang · 2 titik pemantauan</small>
          </div>
          <button
            onClick={() => {
              setTab("Pengaturan");
              setNotice(
                "Semua angka, kapasitas, dan dimensi merupakan konfigurasi demonstrasi.",
              );
            }}
          >
            <CircleHelp size={17} /> Bantuan & konfigurasi
          </button>
          <div className="profile">
            <span>AD</span>
            <div>
              {mode === "local" ? "Admin Demo" : `Staf · ${role}`}
              <small>
                {mode === "local"
                  ? "Akses demonstrasi lokal"
                  : "Akses berdasarkan peran"}
              </small>
            </div>
            <ShieldCheck size={18} />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Ruang kerja <ChevronRight size={14} /> <b>{tab}</b>
          </div>
          <div className="topbar-right">
            <span>
              <i className="green-dot" />{" "}
              {mode === "local" ? "Demo lokal" : "Supabase · " + role}
            </span>
            <span className="separator" />
            <span>WIB · Cirebon, Indonesia</span>
            <span className="avatar">AD</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CIREBON FROZEN FOOD DEMO FACILITY</div>
              <h1>
                {tab === "Ringkasan"
                  ? "Pusat kendali penyimpanan"
                  : tab === "Digital Twin"
                    ? "Pabrik dalam satu pandangan"
                    : tab === "Inventori"
                      ? "Inventori & lokasi karung"
                      : tab === "Operasional"
                        ? "Alur produksi"
                        : tab === "Pemuatan"
                          ? "Pemuatan & pengiriman"
                          : tab === "Simulator"
                            ? "Simulator suhu"
                            : "Konfigurasi fasilitas"}
              </h1>
              <p>
                {tab === "Ringkasan"
                  ? "Pantau suhu, inventori, dan aktivitas operasional dalam satu tempat."
                  : tab === "Digital Twin"
                    ? "Jelajahi fasilitas, pantau kondisi ruang, dan temukan setiap karung."
                    : tab === "Simulator"
                      ? "Kendalikan kondisi setiap ruang secara independen. Semua pembacaan berlabel SIMULATED."
                      : mode === "local"
                        ? "Data fiktif demonstrasi · perubahan disimpan pada browser ini."
                        : "Backend Supabase · transaksi divalidasi berdasarkan peran staf."}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "csms-demo.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <ArrowDownToLine size={16} /> Ekspor data
            </button>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button aria-label="Tutup kesalahan" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              {notice}
              <button
                aria-label="Tutup pemberitahuan"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "Ringkasan" && (
            <>
              <div className="metrics">
                <Metric
                  icon={<Package />}
                  label="Total stok aktif"
                  value={fmt(total.pcs)}
                  unit="PCS"
                  sub={`${fmt(total.kg)} KG berat bersih`}
                />
                <Metric
                  icon={<Warehouse />}
                  label="Karung tersimpan"
                  value={fmt(total.count)}
                  unit="karung"
                  sub="Tersebar di 2 ruang penyimpanan"
                />
                <Metric
                  icon={<Thermometer />}
                  label="Pemantauan suhu"
                  value={`${state.rooms.filter((r) => r.connected).length}/2`}
                  unit="sensor"
                  sub="PTA8D08 · CH1 & CH2"
                />
                <Metric
                  icon={<Truck />}
                  label="Rencana pemuatan"
                  value={String(
                    state.orders.filter((o) => o.status !== "dikonfirmasi")
                      .length,
                  ).padStart(2, "0")}
                  unit="pesanan"
                  sub="Menunggu penyelesaian pengiriman"
                />
              </div>
              <div className="section-title">
                <h2>
                  Kondisi ruang penyimpanan{" "}
                  <span className="count">2 RUANG</span>
                </h2>
                <span>
                  <i className="green-dot" /> Simulasi diperbarui setiap 3 detik
                </span>
              </div>
              <div className="room-grid">
                {state.rooms.map((r) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    state={state}
                    onView={() => goRoom(r.id)}
                  />
                ))}
              </div>
              <div className="overview-bottom">
                <section className="card preview-card">
                  <div className="card-head">
                    <div>
                      <h3>Digital Twin fasilitas</h3>
                      <small>
                        Visibilitas operasional dari produksi hingga pengiriman
                      </small>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setTab("Digital Twin")}
                    >
                      Buka tampilan penuh <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <Twin
                    state={state}
                    selected={selected}
                    onRoom={goRoom}
                    onSack={(s) => locate(s)}
                    focus={null}
                  />
                </section>
                <section className="card activity-card">
                  <div className="card-head">
                    <h3>Aktivitas terkini</h3>
                    <span className="count">DEMO</span>
                  </div>
                  <div className="activity-list">
                    {state.movements.slice(0, 4).map((m, i) => (
                      <div className="activity" key={m.id}>
                        <span
                          className={
                            i === 0
                              ? "activity-icon highlighted"
                              : "activity-icon"
                          }
                        >
                          <Package size={15} />
                        </span>
                        <div>
                          <b>{m.kind}</b>
                          <p>
                            {m.sackId} · {m.room ?? "Pengiriman"}
                          </p>
                          <small>{time(m.at)} WIB</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="alert-summary">
                    <ShieldCheck size={21} />
                    <div>
                      <b>
                        {alertRooms.length
                          ? `${alertRooms.length} ruang perlu diperiksa`
                          : "Semua ruang dalam kondisi normal"}
                      </b>
                      <small>
                        {alertRooms.length
                          ? "Periksa alarm pada simulator"
                          : "Tidak ada alarm suhu aktif"}
                      </small>
                    </div>
                  </div>
                  <button
                    className="text-button full-width"
                    onClick={() => setTab("Operasional")}
                  >
                    Lihat riwayat operasional <ArrowRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {tab === "Digital Twin" && (
            <>
              <div className="search-row">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Cari ID atau QR karung"
                    placeholder="Cari ID karung atau pindai QR…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") search();
                    }}
                  />
                  <button onClick={search}>Temukan karung</button>
                </div>
                {state.rooms.map((r) => (
                  <button
                    className={`button ${focus === r.id ? "primary" : "secondary"}`}
                    key={r.id}
                    onClick={() => setFocus(r.id)}
                  >
                    {r.id} · {r.temperature.toFixed(1)}°C
                  </button>
                ))}
              </div>
              <div className="twin-layout">
                <section className="card full-twin">
                  <Twin
                    state={state}
                    selected={selected}
                    onRoom={setFocus}
                    onSack={(s) => setSelectedId(s.id)}
                    focus={focus}
                  />
                </section>
                <section className="card inspector">
                  <h3>Inspeksi lokasi</h3>
                  {selected ? (
                    <>
                      <QR sack={selected} />
                      <h2>{selected.id}</h2>
                      <p>{selected.product}</p>
                      <dl>
                        {[
                          ["Pemilik", selected.owner],
                          ["Batch", selected.batch],
                          [
                            "Kuantitas",
                            `${selected.pcs} PCS / ${selected.kg} KG`,
                          ],
                          ["Status", selected.status],
                          ["Ruang", selected.room ?? "Di luar penyimpanan"],
                          [
                            "Lokasi",
                            selected.room
                              ? `Rak ${selected.rack} · L${selected.level} · S${selected.slot}`
                              : "—",
                          ],
                          ["Kedaluwarsa", selected.expiry],
                        ].map(([a, b]) => (
                          <div key={a}>
                            <dt>{a}</dt>
                            <dd>{b}</dd>
                          </div>
                        ))}
                      </dl>
                      <button
                        className="button secondary"
                        onClick={() => setSelectedId(null)}
                      >
                        Tutup karung
                      </button>
                    </>
                  ) : focus ? (
                    (() => {
                      const r = state.rooms.find((r) => r.id === focus)!;
                      return (
                        <>
                          <Snowflake size={35} />
                          <h2>{r.name}</h2>
                          <Badge tone={status(r)}>
                            {statusLabels[status(r)]}
                          </Badge>
                          <dl>
                            {[
                              [
                                "Suhu",
                                `${r.temperature.toFixed(1)}°C · ${readingSource(r)}`,
                              ],
                              ["Sensor", r.sensor],
                              ["Kanal", `PTA8D08 CH${r.channel}`],
                              ["Kualitas", r.quality],
                              [
                                "Stok",
                                `${inventory(state, r.id).count} karung`,
                              ],
                              ["Pembaruan", time(r.lastUpdate)],
                            ].map(([a, b]) => (
                              <div key={a}>
                                <dt>{a}</dt>
                                <dd>{b}</dd>
                              </div>
                            ))}
                          </dl>
                          <p>
                            Warna menunjukkan status pemantauan, bukan simulasi
                            termal.
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <div className="empty">
                      <MapPin />
                      <p>Pilih ruang, rak, atau karung pada pabrik 3D.</p>
                    </div>
                  )}
                </section>
              </div>
              <div className="legend">
                <span>
                  <i style={{ background: "#29c7ce" }} />
                  Normal
                </span>
                <span>
                  <i style={{ background: "#f5ae48" }} />
                  Peringatan
                </span>
                <span>
                  <i style={{ background: "#f45252" }} />
                  Kritis
                </span>
                <span>
                  <i style={{ background: "#87939c" }} />
                  Sensor tidak tersedia
                </span>
                <span>Dimensi & tata letak demonstrasi</span>
              </div>
            </>
          )}
          {tab === "Inventori" && (
            <section className="card">
              <div className="table-toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Filter inventori"
                    placeholder="Cari karung, produk, pemilik atau QR…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter ruang"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="semua">Semua ruang</option>
                  <option>CS-01</option>
                  <option>CS-02</option>
                  <option value="proses">Dalam proses</option>
                </select>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ID Karung</th>
                      <th>Produk / pemilik</th>
                      <th>Kuantitas</th>
                      <th>Lokasi</th>
                      <th>Status</th>
                      <th>Kedaluwarsa</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.sacks
                      .filter(
                        (s) =>
                          (filter === "semua" ||
                            s.room === filter ||
                            (filter === "proses" && !s.room)) &&
                          [s.id, s.qr, s.product, s.owner].some((v) =>
                            v.toLowerCase().includes(query.toLowerCase()),
                          ),
                      )
                      .map((s) => (
                        <tr key={s.id}>
                          <td>
                            <b>{s.id}</b>
                            <small>{s.batch}</small>
                          </td>
                          <td>
                            {s.product}
                            <small>{s.owner}</small>
                          </td>
                          <td>
                            {s.pcs} PCS<small>{fmt(s.kg)} KG</small>
                          </td>
                          <td>
                            {s.room ?? "—"}
                            <small>
                              {s.room
                                ? `R${s.rack} · L${s.level} · S${s.slot}`
                                : "Di luar penyimpanan"}
                            </small>
                          </td>
                          <td>
                            <Badge>{s.status}</Badge>
                          </td>
                          <td>{s.expiry}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => locate(s)}
                            >
                              <MapPin size={15} /> Lacak
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {tab === "Simulator" && (
            <>
              <div className="simulator-grid">
                {state.rooms.map((r) => (
                  <Simulator
                    key={r.id}
                    room={r}
                    state={state}
                    act={action}
                    onView={() => goRoom(r.id)}
                  />
                ))}
              </div>
              <section className="card padded" style={{ marginBottom: 24 }}>
                <h3>Riwayat alarm per ruang</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Ruang</th>
                        <th>Waktu</th>
                        <th>Kondisi</th>
                        <th>Keterangan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(state.alerts ?? []).map((a) => (
                        <tr key={a.id}>
                          <td>{a.room}</td>
                          <td>{time(a.openedAt)}</td>
                          <td>
                            <Badge tone={a.severity}>
                              {statusLabels[
                                a.severity as keyof typeof statusLabels
                              ] ?? "Data kedaluwarsa"}
                            </Badge>
                          </td>
                          <td>{a.message}</td>
                          <td>{a.resolvedAt ? "Selesai" : "Aktif"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!state.alerts?.length && (
                    <div className="empty">
                      Belum ada alarm. Pilih skenario alarm pada salah satu
                      ruang.
                    </div>
                  )}
                </div>
              </section>
              <section className="card hardware">
                <div>
                  <h3>PTA8D08-DEMO-01</h3>
                  <p>Modul akuisisi PT100 8 kanal · pemetaan logis sementara</p>
                </div>
                <div className="channels">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className={i < 2 ? "assigned" : ""}>
                      <b>CH{i + 1}</b>
                      <span>{i < 2 ? `CS-0${i + 1}` : "Tersedia"}</span>
                    </div>
                  ))}
                </div>
                <p>
                  PT100 → PTA8D08 → RS485 Modbus RTU → gateway lokal → ingest
                  aman → Supabase → dashboard. Parameter kelistrikan dan
                  register menunggu manual resmi.
                </p>
              </section>
              <button
                className="button danger"
                disabled={mode !== "local"}
                onClick={() => setConfirmReset(true)}
              >
                Reset seluruh data demo
              </button>
            </>
          )}
          {tab === "Operasional" && <Operations state={state} act={action} />}
          {tab === "Pemuatan" && <Loading state={state} act={action} />}
          {tab === "Pengaturan" && (
            <>
              <BackendConnection
                mode={mode}
                role={role}
                connect={connect}
                disconnect={disconnect}
              />
              <Configuration config={state.config} act={action} />
            </>
          )}
          <footer className="page-footer">
            <span>
              CSMS <span>•</span> Cirebon Frozen Food
            </span>
            <span>
              <ShieldCheck size={13} /> Data fiktif ·{" "}
              {mode === "local" ? "Mode demo lokal" : "Supabase terhubung"} ·
              {mode === "local" ? "SIMULATED" : "Sumber sesuai label sensor"}
            </span>
          </footer>
        </main>
        <AIAssistant state={state} mode={mode} />
      </div>
      {confirmReset && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <h2 id="reset-title">Reset seluruh demo?</h2>
            <p>
              Semua perubahan lokal, transaksi, dan pengaturan akan diganti
              dengan 500 karung dan konfigurasi awal. Ekspor data terlebih
              dahulu jika diperlukan.
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setConfirmReset(false)}
              >
                Batal
              </button>
              <button
                className="button danger"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                  setSelectedId(null);
                  setNotice("Data demo berhasil direset.");
                }}
              >
                Ya, reset demo
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  unit,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  sub: string;
}) {
  return (
    <section className="card metric">
      <div>
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>
        {value} <small>{unit}</small>
      </strong>
      <p>{sub}</p>
    </section>
  );
}
function Simulator({
  room,
  state,
  act,
  onView,
}: {
  room: Room;
  state: State;
  act: (a: Action) => Promise<boolean>;
  onView: () => void;
}) {
  const patch = (p: Extract<Action, { type: "room" }>["patch"]) =>
    act({ type: "room", id: room.id, patch: p });
  return (
    <section className="card simulator">
      <RoomCard room={room} state={state} onView={onView} />
      <div className="sim-controls" id={`controls-${room.id}`}>
        <Chart room={room} large />
        <Effectiveness key={`${room.id}-${room.scenario}-${room.target}-${room.warning}-${room.critical}-${room.noise}`} room={room} />
        <div className="form-grid">
          <Field label="Skenario">
            <select
              value={room.scenario}
              onChange={(e) => patch({ scenario: e.target.value as Scenario })}
            >
              {Object.entries(scenarios).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <NumberSetting
            label="Suhu manual (°C)"
            value={room.temperature}
            onSave={(temperature) => patch({ temperature, scenario: "manual" })}
          />
          <NumberSetting
            label="Target (°C)"
            value={room.target}
            onSave={(target) => patch({ target })}
          />
          <NumberSetting
            label="Peringatan (°C)"
            value={room.warning}
            onSave={(warning) => patch({ warning })}
          />
          <NumberSetting
            label="Kritis (°C)"
            value={room.critical}
            onSave={(critical) => patch({ critical })}
          />
          <NumberSetting
            label="Variasi derau (°C)"
            value={room.noise}
            onSave={(noise) => patch({ noise })}
          />
        </div>
        <div className="button-row">
          <button
            className="button primary"
            onClick={() => patch({ running: !room.running })}
          >
            {room.running ? "Jeda" : "Mulai"} simulasi
          </button>
          <button
            className="button secondary"
            onClick={() =>
              patch({
                scenario: room.scenario === "door" ? "recovery" : "door",
              })
            }
          >
            {room.scenario === "door" ? "Tutup" : "Buka"} pintu
          </button>
          <button
            className="button secondary"
            onClick={() =>
              patch({ scenario: room.connected ? "offline" : "normal" })
            }
          >
            {room.connected ? "Putuskan" : "Hubungkan"} sensor
          </button>
          <button
            className="button secondary"
            onClick={() => patch({ scenario: "alarm" })}
          >
            Picu alarm
          </button>
          <button
            className="button secondary"
            onClick={() => act({ type: "resetRoom", id: room.id })}
          >
            Reset ruang
          </button>
        </div>
        <p className="hint">
          {room.running ? "Simulasi berjalan" : "Simulasi dijeda"} ·{" "}
          {scenarios[room.scenario]} · tidak memengaruhi ruang lain.
        </p>
      </div>
    </section>
  );
}
function NumberSetting({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <Field label={label}>
      <div className="input-action">
        <input
          type="number"
          step="0.1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          aria-label={`Simpan ${label}`}
          onClick={() => {
            if (draft.trim()) onSave(Number(draft));
          }}
        >
          <Check size={16} />
        </button>
      </div>
    </Field>
  );
}
function Operations({
  state,
  act,
}: {
  state: State;
  act: (a: Action) => Promise<boolean>;
}) {
  const [batch, setBatch] = useState(state.batches[0]?.id ?? "");
  const [product, setProduct] = useState(products[0]);
  const [owner, setOwner] = useState(owners[0]);
  const [production, setProduction] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [sackId, setSackId] = useState("");
  const [pcs, setPcs] = useState(12);
  const [kg, setKg] = useState(20);
  const [room, setRoom] = useState<RoomId>("CS-01");
  const [rack, setRack] = useState(5);
  const [level, setLevel] = useState(1);
  const [slot, setSlot] = useState(11);
  const [operator, setOperator] = useState("Admin Packing Demo");
  const [batchPcs, setBatchPcs] = useState(120);
  const s = state.sacks.find((s) => s.id === sackId);
  const steps = [
    "Bongkar ABF",
    "Hitung PCS",
    "Verifikasi kantor",
    "Siapkan karung",
    "Kemas",
    "Timbang",
    "Jahit / segel",
    "Penempatan",
    "Siapkan muat",
    "Muat ekspor",
    "Lapor kantor",
    "Konfirmasi kirim",
  ];
  return (
    <>
      <div className="workflow">
        {steps.map((v, i) => (
          <div key={v}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {v}
            {i < steps.length - 1 && <ChevronRight size={14} />}
          </div>
        ))}
      </div>
      <div className="two-col">
        <section className="card padded">
          <h3>1. ABF & verifikasi produksi</h3>
          <p>
            Target ABF {state.config.abfTarget}°C · {state.config.abfHours} jam
            · target konfigurasi tanpa sensor fisik.
          </p>
          <div className="form-grid">
            <Field label="Produk">
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="PCS hasil bongkar">
              <input
                type="number"
                value={batchPcs}
                onChange={(e) => setBatchPcs(Number(e.target.value))}
              />
            </Field>
          </div>
          <button
            className="button primary"
            onClick={async () => {
              const id = `BATCH-${Date.now()}`;
              if (await act({ type: "batch", id, product, pcs: batchPcs }))
                setBatch(id);
            }}
          >
            Catat hasil bongkar
          </button>
          <div className="batch-list">
            {state.batches.map((b) => (
              <div key={b.id}>
                <div>
                  <b>{b.id}</b>
                  <small>
                    {b.product} · {fmt(b.pcs)} PCS
                  </small>
                </div>
                {b.verified ? (
                  <Badge>Terverifikasi</Badge>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() =>
                      act({
                        type: "verify",
                        batch: b.id,
                        operator: "Admin Office Demo",
                      })
                    }
                  >
                    Verifikasi Admin Office
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="card padded">
          <h3>2. Persiapan & pengemasan</h3>
          <p>
            Karung mendapat ID unik, QR, dan tanggal kedaluwarsa sesuai produk.
          </p>
          <div className="form-grid">
            <Field label="Batch terverifikasi">
              <select value={batch} onChange={(e) => setBatch(e.target.value)}>
                {state.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} · {b.product}
                    {!b.verified ? " (belum diverifikasi)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pemilik produk">
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {owners.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal produksi">
              <input
                type="date"
                value={production}
                onChange={(e) => setProduction(e.target.value)}
              />
            </Field>
          </div>
          <button
            className="button primary"
            onClick={async () => {
              const id = `KRG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
              if (
                await act({
                  type: "prepare",
                  id,
                  owner,
                  product:
                    state.batches.find((b) => b.id === batch)?.product ??
                    product,
                  batch,
                  production,
                })
              )
                setSackId(id);
            }}
          >
            Siapkan karung baru
          </button>
          <hr />
          <Field label="Karung dalam proses">
            <select value={sackId} onChange={(e) => setSackId(e.target.value)}>
              <option value="">Pilih karung</option>
              {state.sacks
                .filter(
                  (s) => !["tersimpan", "dimuat", "dikirim"].includes(s.status),
                )
                .map((s) => (
                  <option key={s.id}>{s.id}</option>
                ))}
            </select>
          </Field>
          {s && (
            <>
              <p>
                <Badge>{s.status}</Badge> {s.product} · {s.expiry}
              </p>
              <QR sack={s} />
              <div className="form-grid">
                <Field label="PCS per karung">
                  <input
                    type="number"
                    value={pcs}
                    onChange={(e) => setPcs(Number(e.target.value))}
                  />
                </Field>
                <Field label="Berat bersih (KG)">
                  <input
                    type="number"
                    step=".01"
                    value={kg}
                    onChange={(e) => setKg(Number(e.target.value))}
                  />
                </Field>
                <Field label="Operator">
                  <input
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                  />
                </Field>
              </div>
              <div className="button-row">
                <button
                  className="button primary"
                  disabled={s.status !== "disiapkan"}
                  onClick={() => act({ type: "pack", id: s.id, pcs })}
                >
                  Catat pengemasan
                </button>
                <button
                  className="button secondary"
                  disabled={s.status !== "dikemas"}
                  onClick={() =>
                    void new MockScaleAdapter()
                      .readKg()
                      .then((v) => setKg(v.kg))
                  }
                >
                  Baca timbangan MOCK
                </button>
                <button
                  className="button primary"
                  disabled={s.status !== "dikemas"}
                  onClick={() => act({ type: "weigh", id: s.id, kg })}
                >
                  Simpan berat
                </button>
                <button
                  className="button primary"
                  disabled={s.status !== "ditimbang"}
                  onClick={() => act({ type: "seal", id: s.id, operator })}
                >
                  Jahit & segel
                </button>
              </div>
              <hr />
              <h3>3. Penempatan ruang</h3>
              <div className="form-grid">
                <Field label="Ruang">
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value as RoomId)}
                  >
                    <option>CS-01</option>
                    <option>CS-02</option>
                  </select>
                </Field>
                {(
                  [
                    ["Rak", rack, setRack],
                    ["Level", level, setLevel],
                    ["Slot", slot, setSlot],
                  ] as const
                ).map(([label, value, set]) => (
                  <Field key={label} label={label}>
                    <input
                      type="number"
                      min="1"
                      value={value}
                      onChange={(e) => set(Number(e.target.value))}
                    />
                  </Field>
                ))}
              </div>
              <button
                className="button primary"
                disabled={s.status !== "disegel"}
                onClick={() =>
                  act({
                    type: "putaway",
                    id: s.id,
                    room,
                    rack,
                    level,
                    slot,
                    operator,
                  })
                }
              >
                Tempatkan karung tersegel
              </button>
            </>
          )}
        </section>
      </div>
      <section className="card padded">
        <h3>Riwayat perpindahan & audit demo</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Karung</th>
                <th>Kegiatan</th>
                <th>Operator</th>
                <th>Ruang</th>
                <th>PCS / KG</th>
              </tr>
            </thead>
            <tbody>
              {state.movements.slice(0, 40).map((m) => (
                <tr key={m.id}>
                  <td>{time(m.at)}</td>
                  <td>{m.sackId}</td>
                  <td>{m.kind}</td>
                  <td>{m.operator}</td>
                  <td>{m.room ?? "—"}</td>
                  <td>
                    {m.pcs} / {m.kg}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Loading({
  state,
  act,
}: {
  state: State;
  act: (a: Action) => Promise<boolean>;
}) {
  const [orderId, setOrderId] = useState(state.orders[0]?.id ?? "");
  const [scan, setScan] = useState("");
  const [customer, setCustomer] = useState("");
  const [product, setProduct] = useState(products[0]);
  const [pcs, setPcs] = useState(120);
  const [kg, setKg] = useState(200);
  const o = state.orders.find((o) => o.id === orderId);
  const sacks = state.sacks.filter((s) => o?.sackIds.includes(s.id));
  const scanSack = async () => {
    if (
      o &&
      (await act({
        type: "scan",
        order: o.id,
        input: scan,
        operator: "Admin Loading Demo",
      }))
    )
      setScan("");
  };
  return (
    <div className="two-col">
      <section className="card padded">
        <h3>Rencana pemuatan ekspor</h3>
        <div className="form-grid">
          <Field label="Pelanggan / tujuan">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Nama pelanggan dan tujuan"
            />
          </Field>
          <Field label="Produk">
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              {products.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Kebutuhan PCS">
            <input
              type="number"
              value={pcs}
              onChange={(e) => setPcs(Number(e.target.value))}
            />
          </Field>
          <Field label="Kebutuhan KG">
            <input
              type="number"
              value={kg}
              onChange={(e) => setKg(Number(e.target.value))}
            />
          </Field>
        </div>
        <button
          className="button primary"
          onClick={async () => {
            const id = `EXP-${Date.now()}`;
            if (await act({ type: "order", id, customer, product, pcs, kg }))
              setOrderId(id);
          }}
        >
          Buat rencana
        </button>
        <hr />
        {state.orders.map((order) => (
          <button
            className={`order-item ${order.id === orderId ? "selected" : ""}`}
            key={order.id}
            onClick={() => setOrderId(order.id)}
          >
            <div>
              <b>{order.id}</b>
              <small>{order.customer}</small>
              <small>
                {order.product} · {order.requiredPcs} PCS · {order.requiredKg}{" "}
                KG
              </small>
            </div>
            <Badge>{order.status}</Badge>
          </button>
        ))}
      </section>
      <section className="card padded">
        <h3>Pindai, laporkan, dan konfirmasi</h3>
        {o && (
          <>
            <p>
              {o.id} · {o.product}
            </p>
            <div className="search">
              <Search size={16} />
              <input
                aria-label="Pindai QR pemuatan"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") scanSack();
                }}
                placeholder="Pindai QR / ketik KRG-00001"
                disabled={o.status !== "rencana"}
              />
              <button disabled={o.status !== "rencana"} onClick={scanSack}>
                Validasi
              </button>
            </div>
            <p className="hint">
              Scanner HID: fokus pada kolom, pindai, lalu Enter. Produk wajib
              sesuai pesanan.
            </p>
            <div className="loading-totals">
              <div>
                <b>
                  {fmt(sacks.reduce((a, s) => a + s.pcs, 0))} / {o.requiredPcs}
                </b>
                <small>PCS</small>
              </div>
              <div>
                <b>
                  {fmt(sacks.reduce((a, s) => a + s.kg, 0))} / {o.requiredKg}
                </b>
                <small>KG</small>
              </div>
            </div>
            <p>
              Target PCS dan KG adalah batas minimum. Kelebihan muatan terlihat
              di laporan untuk diperiksa Admin Office.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Karung</th>
                    <th>PCS</th>
                    <th>KG</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sacks.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.pcs}</td>
                      <td>{s.kg}</td>
                      <td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!sacks.length && (
                <div className="empty">Belum ada karung dipindai.</div>
              )}
            </div>
            <div className="button-row">
              <button
                className="button primary"
                disabled={o.status !== "rencana"}
                onClick={() =>
                  act({
                    type: "report",
                    order: o.id,
                    operator: "Admin Loading Demo",
                  })
                }
              >
                Kirim laporan Admin Loading
              </button>
              <button
                className="button primary"
                disabled={o.status !== "dilaporkan"}
                onClick={() =>
                  act({
                    type: "dispatch",
                    order: o.id,
                    operator: "Admin Office Demo",
                  })
                }
              >
                Admin Office: konfirmasi pengiriman
              </button>
            </div>
            {o.reportedBy && <p>Laporan oleh {o.reportedBy}</p>}
            {o.confirmedBy && (
              <p>
                <Badge>Pengiriman dikonfirmasi</Badge> {o.confirmedBy}
              </p>
            )}
            <div className="info-box">
              <ShieldCheck size={18} />
              Stok tetap tercatat saat pemuatan dan berkurang satu kali setelah
              konfirmasi Admin Office.
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function Configuration({
  config,
  act,
}: {
  config: Config;
  act: (a: Action) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(config);
  return (
    <div className="two-col">
      <section className="card padded">
        <h3>Parameter demonstrasi</h3>
        <p>Bukan kapasitas atau spesifikasi operasional pabrik sebenarnya.</p>
        <div className="form-grid">
          {(
            [
              ["abfCount", "Jumlah ABF (belum dikonfirmasi)"],
              ["abfTarget", "Target ABF (°C, tanpa sensor)"],
              ["abfHours", "Durasi siklus ABF (jam)"],
              ["expiryDays", "Masa simpan bawaan (hari)"],
              ["racks", "Rak per ruang"],
              ["levels", "Level per rak"],
              ["slots", "Slot per level"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="number"
                value={draft[key]}
                onChange={(e) =>
                  setDraft({ ...draft, [key]: Number(e.target.value) })
                }
              />
            </Field>
          ))}
          {products.map((p) => (
            <Field key={p} label={`Masa simpan ${p} (hari)`}>
              <input
                type="number"
                value={draft.productExpiry[p] ?? draft.expiryDays}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    productExpiry: {
                      ...draft.productExpiry,
                      [p]: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
        <button
          className="button primary"
          onClick={() => act({ type: "config", config: draft })}
        >
          Simpan konfigurasi
        </button>
      </section>
      <section className="card padded">
        <h3>Kesiapan integrasi</h3>
        <div className="integration-list">
          <div>
            <Check />
            <span>
              <b>Simulator & timbangan mock</b>
              <small>Berfungsi tanpa perangkat keras</small>
            </span>
            <Badge>Aktif</Badge>
          </div>
          <div>
            <Check />
            <span>
              <b>Scanner QR HID</b>
              <small>Input keyboard + Enter</small>
            </span>
            <Badge>Siap</Badge>
          </div>
          <div>
            <Activity />
            <span>
              <b>Supabase PostgreSQL</b>
              <small>
                Migrasi, RLS, dan RPC tersedia di repositori. Hubungkan akun
                staf melalui formulir di atas untuk menggunakan backend.
              </small>
            </span>
            <Badge tone="warning">Perlu konfigurasi</Badge>
          </div>
          <div>
            <Settings2 />
            <span>
              <b>PTA8D08 / RS485</b>
              <small>
                Menunggu manual resmi, parameter terverifikasi, dan gateway
                lokal.
              </small>
            </span>
            <Badge tone="warning">Kerangka</Badge>
          </div>
        </div>
        <div className="info-box">
          Demo disinkronkan antartab pada browser yang sama. Data tidak
          dibagikan lintas perangkat; simulasi berjalan saat halaman terlihat.
          Akses Admin Packing, Loading, dan Office di sini adalah peragaan
          peran.
        </div>
      </section>
    </div>
  );
}
