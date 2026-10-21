"use client";
import { supabaseClient } from "@/lib/adapters";
import { useEffect, useRef, useState } from "react";
import { Room, scenarios } from "@/lib/domain";
import {
  effectiveness,
  EvaluationInput,
  Observation,
} from "@/lib/effectiveness";

type Report = {
  metrics: ReturnType<typeof effectiveness>;
  analysis: { summary: string; recommendations: string[]; limitations: string };
  model: string;
  evaluatedAt: string;
  scenarioLabel?: string;
  comparisons?: {
    scenario: keyof typeof scenarios;
    score: number;
    criticalSeconds: number;
  }[];
};
export default function Effectiveness({ room }: { room: Room }) {
  const current = useRef(room);
  current.current = room;
  const [samples, setSamples] = useState<Observation[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [saved, setSaved] = useState<
    { scenario: string; score: number | null; at: string; report?: Report }[]
  >([]);
  const controller = useRef<AbortController | null>(null);
  const storageKey = `csms-evaluations-${room.id}`;
  useEffect(() => {
    try {
      const history = JSON.parse(
        localStorage.getItem(storageKey) || "[]",
      ).slice(0, 5);
      setSaved(history);
      if (history[0]?.report?.analysis) setReport(history[0].report);
    } catch {
      /* optional local history */
    }
    return () => controller.current?.abort();
  }, [storageKey]);
  useEffect(() => {
    if (!collecting) return;
    const timer = setInterval(() => {
      const r = current.current;
      if (!r.running) {
        setCollecting(false);
        return;
      }
      setSamples((previous) => {
        if (previous.length >= 300) return previous;
        return [
          ...previous,
          {
            at: Date.now(),
            temperature: r.temperature,
            valid:
              r.connected &&
              r.quality === "baik" &&
              Date.now() - Date.parse(r.lastUpdate) < 15000,
          },
        ];
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [collecting]);
  useEffect(() => {
    if (samples.length >= 300) setCollecting(false);
  }, [samples.length]);
  const input: EvaluationInput = {
    roomId: room.id,
    scenario: room.scenario,
    target: room.target,
    warning: room.warning,
    critical: room.critical,
    samples,
  };
  const metrics = effectiveness(input);
  async function evaluate() {
    setBusy(true);
    setError("");
    setReport(null);
    controller.current = new AbortController();
    try {
      const session = await supabaseClient()?.auth.getSession();
      const accessToken = session?.data.session?.access_token;
      const response = await fetch("/api/effectiveness", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(input),
        signal: controller.current.signal,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Evaluasi gagal");
      result.scenarioLabel = scenarios[room.scenario];
      setReport(result);
      const next = [
        {
          scenario: scenarios[room.scenario],
          score: result.metrics.score,
          at: result.evaluatedAt,
          report: result,
        },
        ...saved,
      ].slice(0, 5);
      setSaved(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* report remains visible */
      }
    } catch (e) {
      if (!controller.current?.signal.aborted)
        setError(e instanceof Error ? e.message : "Evaluasi gagal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="effectiveness-panel">
      <div className="effectiveness-heading">
        <div>
          <span className="eyebrow">EVALUASI SIMULASI</span>
          <h3>Efektivitas pendinginan</h3>
        </div>
        <strong className="effectiveness-score">
          {metrics.score ?? "—"}
          <small>/100</small>
        </strong>
      </div>
      <p>
        Rekam sesi untuk menilai {scenarios[room.scenario].toLowerCase()}. Skor
        mengukur kondisi pendinginan; skenario gangguan dapat menghasilkan skor
        rendah.
      </p>
      <div className="effectiveness-metrics">
        <span>
          Durasi <b>{metrics.seconds} dtk</b>
        </span>
        <span>
          Data tersedia <b>{metrics.availabilityPct}%</b>
        </span>
        <span>
          Di bawah peringatan <b>{metrics.safePct}%</b>
        </span>
        <span>
          Suhu kritis <b>{metrics.criticalSeconds} dtk</b>
        </span>
      </div>
      <div className="button-row">
        <button
          className="button secondary"
          disabled={busy || (!collecting && !room.running)}
          onClick={() => {
            if (collecting) setCollecting(false);
            else {
              setSamples([]);
              setReport(null);
              setError("");
              setCollecting(true);
            }
          }}
        >
          {collecting ? "Selesaikan sesi" : "Rekam sesi baru"}
        </button>
        <button
          className="button primary"
          disabled={collecting || busy || metrics.seconds < 20}
          onClick={evaluate}
        >
          {busy ? "Agent membandingkan intervensi…" : "Evaluasi dengan AI"}
        </button>
      </div>
      <p className="hint">
        {collecting
          ? "Merekam setiap 2 detik, maksimal 10 menit."
          : "Minimal 20 detik; disarankan 60 detik. Mulai simulasi sebelum merekam."}{" "}
        Sesi baru saat skenario atau ambang berubah. {metrics.confidence}.
      </p>
      <details>
        <summary>Cara menghitung skor</summary>
        <p>
          Ketersediaan data × (60% waktu di bawah ambang peringatan + 25%
          kedekatan ke target + 15% ketersediaan). Kedekatan turun sampai nol
          saat deviasi rata-rata mencapai jarak target ke peringatan. Waktu
          dihitung dari interval pengamatan; data terputus atau lebih dari 15
          detik tidak memberi nilai. Ini skor heuristik demo, bukan ukuran
          energi atau sertifikasi keamanan produk.
        </p>
      </details>
      {error && <p role="alert">{error}</p>}
      {report && (
        <div className="effectiveness-report">
          <h3>Insight AI · {report.metrics.score}/100</h3>
          <p>
            {report.scenarioLabel || "Sesi tersimpan"} ·{" "}
            {report.metrics.seconds} detik pengamatan · Hasil sesi pada{" "}
            {new Date(report.evaluatedAt).toLocaleString("id-ID")}
          </p>
          <p>{report.analysis.summary}</p>
          <b>Rekomendasi tindakan</b>
          <ol>
            {report.analysis.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
          {!!report.comparisons?.length && (
            <>
              <b>Perbandingan intervensi · proyeksi simulator 120 detik</b>
              <table>
                <thead>
                  <tr>
                    <th>Intervensi</th>
                    <th>Skor proyeksi</th>
                    <th>Durasi kritis</th>
                  </tr>
                </thead>
                <tbody>
                  {report.comparisons.map((c) => (
                    <tr key={c.scenario}>
                      <td>{scenarios[c.scenario]}</td>
                      <td>{c.score}/100</td>
                      <td>{c.criticalSeconds} dtk</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">
                Proyeksi memakai sensor pulih dan derau nol, bukan hasil
                pengujian perangkat.
              </p>
            </>
          )}
          <p className="hint">{report.analysis.limitations}</p>
          <small>
            {report.model} ·{" "}
            {new Date(report.evaluatedAt).toLocaleString("id-ID")} · Agent
            membaca metrik → menjalankan perbandingan 3 intervensi → menyusun
            rekomendasi. Kontrol ruang tetap manual.
          </small>
        </div>
      )}
      {saved.length > 0 && (
        <details>
          <summary>5 evaluasi AI terakhir · {room.id}</summary>
          {saved.map((r, i) => (
            <p key={i}>
              {r.scenario} · <b>{r.score}/100</b> ·{" "}
              {new Date(r.at).toLocaleString("id-ID")}
              {r.report && (
                <button
                  className="button secondary"
                  onClick={() => setReport(r.report!)}
                >
                  Buka insight
                </button>
              )}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
