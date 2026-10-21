"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import Image from "next/image";
import { EamState } from "@/lib/eam/engine";
export type PrintJob = { kind: "sack" | "pallet" | "delivery"; id: string };
const date = (v: string) =>
  new Date(v.length === 10 ? v + "T00:00:00Z" : v).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
  });
export default function PrintDocument({
  state,
  job,
  close,
}: {
  state: EamState;
  job: PrintJob;
  close: () => void;
}) {
  const [qr, setQr] = useState("");
  const sack = state.sacks.find((s) => s.id === job.id),
    pallet = state.pallets.find((p) => p.id === job.id),
    order = state.orders.find((o) => o.id === job.id);
  const code =
    job.kind === "sack"
      ? sack?.qr
      : job.kind === "pallet"
        ? pallet?.qr
        : undefined;
  useEffect(() => {
    setQr("");
    let active = true;
    if (code)
      void QRCode.toDataURL(code, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: "M",
      }).then((s) => {
        if (active) setQr(s);
      });
    return () => {
      active = false;
    };
  }, [code]);
  const members =
    job.kind === "pallet" ? state.sacks.filter((s) => s.pallet === job.id) : [];
  const items =
    order?.items
      .filter((i) => !i.cancelled)
      .map((i) => state.sacks.find((s) => s.id === i.sack)!)
      .filter(Boolean) || [];
  return createPortal(
    <div id="eam-print-root" className={`eam-print-root ${job.kind}`}>
      <div className="eam-print-toolbar">
        <b>Pratinjau {job.kind === "delivery" ? "surat jalan" : "label"}</b>
        <span>
          {job.kind === "delivery"
            ? "A4 landscape"
            : "Label 100 × 70 mm · skala cetak 100%"}
        </span>
        <button
          disabled={job.kind !== "delivery" && !qr}
          onClick={() => window.print()}
        >
          Cetak / Simpan PDF
        </button>
        <button onClick={close}>Tutup</button>
      </div>
      <style>{`@media print { @page { size: ${job.kind === "delivery" ? "A4 landscape" : "100mm 70mm"}; margin: ${job.kind === "delivery" ? "10mm" : "3mm"}; } }`}</style>
      <article className="eam-print-paper">
        <header>
          <div>
            <strong>EAM</strong>
            <p>PT Ender Agro Mitra</p>
          </div>
          <b>
            {job.kind === "sack"
              ? "LABEL KARUNG"
              : job.kind === "pallet"
                ? "LABEL PALET"
                : "SURAT JALAN"}
          </b>
        </header>
        {job.kind === "sack" && sack && (
          <>
            <div className="label-body">
              <div>
                <small>OWNER</small>
                <b>{sack.owner}</b>
                <small>PRODUK / ISI</small>
                <b>{state.products.find((p) => p.id === sack.product)?.name}</b>
                <small>KODE PRODUK</small>
                <b>{sack.product}</b>
                <small>NO. KARUNG</small>
                <b>{sack.id}</b>
              </div>
              <div>
                {qr && (
                  <Image
                    unoptimized
                    src={qr}
                    width={170}
                    height={170}
                    alt={`QR karung ${sack.id}`}
                  />
                )}
                <small>{sack.qr}</small>
              </div>
            </div>
            <div className="label-totals">
              <div>
                <small>JUMLAH</small>
                <b>{sack.pcs} PCS</b>
              </div>
              <div>
                <small>BERAT BERSIH</small>
                <b>
                  {sack.kg.toLocaleString("id-ID", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  KG
                </b>
              </div>
            </div>
            <div className="label-dates">
              <div>
                <small>TANGGAL PRODUKSI</small>
                <b>{date(sack.production)}</b>
              </div>
              <div>
                <small>EXPIRED</small>
                <b>{date(sack.expiry)}</b>
              </div>
            </div>
          </>
        )}
        {job.kind === "pallet" && pallet && (
          <>
            <div className="label-body">
              <div>
                <small>NO. PALET</small>
                <b>{pallet.id}</b>
                <small>LOKASI</small>
                <b>{pallet.location || "Belum ditempatkan"}</b>
                <small>ISI AKTIF</small>
                <b>{members.length} KARUNG</b>
              </div>
              <div>
                {qr && (
                  <Image
                    unoptimized
                    src={qr}
                    width={170}
                    height={170}
                    alt={`QR palet ${pallet.id}`}
                  />
                )}
                <small>{pallet.qr}</small>
              </div>
            </div>
            <div className="label-totals">
              <b>{members.reduce((n, s) => n + s.pcs, 0)} PCS</b>
              <b>{members.reduce((n, s) => n + s.kg, 0).toFixed(2)} KG</b>
            </div>
            <p>
              Dicetak sebagai snapshot isi palet, bukan QR untuk loading karung.
            </p>
          </>
        )}
        {job.kind === "delivery" && order?.document && (
          <>
            <div className="delivery-meta">
              <div>
                <p>
                  No: <b>{order.document.number}</b>
                </p>
                <p>
                  Kepada: <b>{order.owner}</b>
                </p>
                <p>Tujuan: {order.destination}</p>
              </div>
              <div>
                <p>Tanggal: {date(order.document.at)}</p>
                <p>
                  No. kendaraan: <b>{order.truck}</b>
                </p>
                <p>Persetujuan: {order.document.approvedBy}</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Nama barang</th>
                  <th>Kode karung</th>
                  <th>Jumlah PCS</th>
                  <th>Berat KG</th>
                  <th>Satuan</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>
                      {state.products.find((p) => p.id === s.product)?.name}
                    </td>
                    <td>{s.id}</td>
                    <td>{s.pcs}</td>
                    <td>{s.kg.toFixed(2)}</td>
                    <td>Karung</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>Total {order.document.sacks} karung</th>
                  <th>{order.document.pcs}</th>
                  <th>{order.document.kg.toFixed(2)}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
            <p>
              Catatan: barang sesuai daftar dispatch yang disetujui. Dokumen ini
              tidak dapat membatalkan pengiriman.
            </p>
            <div className="delivery-signatures">
              {["Kepala Gudang", "Mengetahui", "Pengirim", "Penerima"].map(
                (t) => (
                  <div key={t}>
                    {t}
                    <p>(_____________________)</p>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </article>
    </div>,
    document.body,
  );
}
