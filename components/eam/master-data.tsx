"use client";
import { useRef, useState } from "react";
import { allowed, Command, EamState, Role } from "@/lib/eam/engine";
import SearchSelect from "./search-select";
export default function MasterData({
  state,
  role,
  busy,
  submit,
}: {
  state: EamState;
  role: Role;
  busy: boolean;
  submit: (c: Command) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"produk" | "pemilik" | "batch">("produk"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<EamState["products"][number] | null>(null),
    [product, setProduct] = useState(""),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const matches = (v: string) => v.toLowerCase().includes(query.toLowerCase());
  function open(p: EamState["products"][number] | null = null) {
    setEditing(p);
    setError("");
    setProduct(state.products.find((p) => p.active)?.id || "");
    dialog.current?.showModal();
  }
  const products = state.products.filter((p) => matches(p.id + " " + p.name));
  const owners = state.owners.filter(matches);
  const batches = state.batches.filter((b) => matches(b.id + " " + b.product));
  async function save(form: HTMLFormElement) {
    const f = new FormData(form);
    let command: Command;
    if (tab === "produk") {
      const id = String(f.get("id")).trim();
      if (!editing && state.products.some((p) => p.id === id)) {
        setError(
          "Kode produk sudah digunakan. Gunakan Edit pada produk tersebut.",
        );
        return;
      }
      command = {
        type: "product",
        id,
        name: String(f.get("name")).trim(),
        pcs: Number(f.get("pcs")),
        months: Number(f.get("months")),
        active: f.get("active") === "on",
      };
    } else if (tab === "pemilik")
      command = { type: "ownerCreate", name: String(f.get("name")).trim() };
    else
      command = {
        type: "batchCreate",
        id: String(f.get("id")).trim(),
        product,
      };
    if (await submit(command)) {
      dialog.current?.close();
      form.reset();
    } else
      setError(
        "Belum tersimpan. Periksa isian dan pesan kesalahan pada halaman.",
      );
  }
  return (
    <section className="eam-card eam-master">
      <h2>Master Data</h2>
      <p>Kelola produk, pemilik barang, dan batch produksi.</p>
      <div className="master-tabs">
        {(["produk", "pemilik", "batch"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setQuery("");
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}{" "}
            <span>
              {t === "produk"
                ? state.products.length
                : t === "pemilik"
                  ? state.owners.length
                  : state.batches.length}
            </span>
          </button>
        ))}
      </div>
      <div className="master-toolbar">
        <input
          aria-label="Cari master"
          placeholder={`Cari kode atau nama ${tab}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="master-primary"
          disabled={
            busy ||
            !allowed(
              role,
              tab === "produk"
                ? "product"
                : tab === "pemilik"
                  ? "ownerCreate"
                  : "batchCreate",
            )
          }
          onClick={() => open()}
        >
          + Tambah {tab}
        </button>
      </div>
      <div className="eam-table">
        <table>
          <thead>
            <tr>
              {(tab === "produk"
                ? [
                    "Kode produk",
                    "Nama produk",
                    "PCS / karung",
                    "Masa simpan",
                    "Status",
                    "Aksi",
                  ]
                : tab === "pemilik"
                  ? ["No.", "Nama pemilik", "Jumlah karung"]
                  : ["Kode batch", "Produk", "Status ABF", "Verifikasi", "Aksi"]
              ).map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab === "produk" &&
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.id}</b>
                  </td>
                  <td>{p.name}</td>
                  <td>{p.pcs} PCS</td>
                  <td>{p.months} bulan</td>
                  <td>
                    <span
                      className={`master-status ${p.active ? "" : "muted"}`}
                    >
                      {p.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    <button
                      disabled={busy || !allowed(role, "product")}
                      onClick={() => open(p)}
                      aria-label={`Edit ${p.id}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            {tab === "pemilik" &&
              owners.map((o, i) => (
                <tr key={o}>
                  <td>{i + 1}</td>
                  <td>{o}</td>
                  <td>{state.sacks.filter((s) => s.owner === o).length}</td>
                </tr>
              ))}
            {tab === "batch" &&
              batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b>{b.id}</b>
                  </td>
                  <td>
                    {state.products.find((p) => p.id === b.product)?.name ||
                      b.product}
                    <small className="master-code">{b.product}</small>
                  </td>
                  <td>{b.completed ? "Selesai" : "Dalam proses"}</td>
                  <td>
                    <span
                      className={`master-status ${b.verified ? "" : "muted"}`}
                    >
                      {b.verified ? "Terverifikasi" : "Belum diverifikasi"}
                    </span>
                  </td>
                  <td>
                    {!b.completed ? (
                      <button
                        disabled={busy || !allowed(role, "batchComplete")}
                        onClick={() =>
                          void submit({ type: "batchComplete", id: b.id })
                        }
                      >
                        Selesaikan ABF
                      </button>
                    ) : !b.verified ? (
                      <button
                        disabled={busy || !allowed(role, "verify")}
                        onClick={() =>
                          void submit({ type: "verify", batch: b.id })
                        }
                      >
                        Verifikasi
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            {(tab === "produk"
              ? products.length
              : tab === "pemilik"
                ? owners.length
                : batches.length) === 0 && (
              <tr>
                <td colSpan={6} className="master-empty">
                  Tidak ada {tab} yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="master-footnote">
        {tab === "produk"
          ? "Perubahan PCS dan masa simpan berlaku untuk packing baru. Data karung sebelumnya tetap tersimpan."
          : "Data master digunakan pada pilihan form operasional."}
      </p>
      <dialog
        ref={dialog}
        className="master-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form
          key={`${tab}-${editing?.id || "new"}`}
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
        >
          <header>
            <div>
              <small>MASTER DATA</small>
              <h2>
                {editing ? "Edit" : "Tambah"} {tab}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Tutup form"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              ✕
            </button>
          </header>
          <div className="master-form-body">
            {error && (
              <p role="alert" className="master-error">
                {error}
              </p>
            )}
            {tab !== "pemilik" && (
              <label>
                Kode {tab}
                <input
                  autoFocus
                  name="id"
                  required
                  maxLength={80}
                  readOnly={!!editing}
                  defaultValue={editing?.id || ""}
                  placeholder={
                    tab === "produk" ? "Contoh: PRD-031" : "Contoh: BATCH-003"
                  }
                />
              </label>
            )}
            {tab !== "batch" && (
              <label>
                Nama {tab}
                <input
                  autoFocus={tab === "pemilik"}
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={editing?.name || ""}
                  placeholder={
                    tab === "produk"
                      ? "Masukkan nama produk"
                      : "Masukkan nama pemilik"
                  }
                />
              </label>
            )}
            {tab === "produk" && (
              <>
                <div className="master-form-grid">
                  <label>
                    PCS standar per karung
                    <input
                      name="pcs"
                      required
                      type="number"
                      min={1}
                      step={1}
                      defaultValue={editing?.pcs || ""}
                      placeholder="Contoh: 30"
                    />
                  </label>
                  <label>
                    Masa simpan (bulan)
                    <input
                      name="months"
                      required
                      type="number"
                      min={1}
                      step={1}
                      defaultValue={editing?.months || 12}
                    />
                  </label>
                </div>
                <label className="master-check">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={editing?.active ?? true}
                  />{" "}
                  Produk aktif untuk packing
                </label>
                <p className="master-footnote">
                  Tanggal expired dihitung dari tanggal produksi dan masa simpan
                  ini.
                </p>
              </>
            )}
            {tab === "batch" && (
              <SearchSelect
                label="Produk batch"
                value={product}
                onChange={setProduct}
                options={state.products
                  .filter((p) => p.active)
                  .map((p) => ({ value: p.id, label: `${p.id} · ${p.name}` }))}
              />
            )}
          </div>
          <footer>
            <button
              type="button"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Batal
            </button>
            <button
              className="master-primary"
              disabled={busy || (tab === "batch" && !product)}
            >
              {busy ? "Menyimpan…" : "Simpan " + tab}
            </button>
          </footer>
        </form>
      </dialog>
    </section>
  );
}
