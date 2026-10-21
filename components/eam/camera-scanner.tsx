"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
export default function CameraScanner({
  title,
  onDetected,
  onClose,
}: {
  title: string;
  onDetected: (code: string) => string | null | Promise<string | null>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    video = useRef<HTMLVideoElement>(null),
    callback = useRef(onDetected);
  callback.current = onDetected;
  const [device, setDevice] = useState(""),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Meminta akses kamera…"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let disposed = false,
      stream: MediaStream | undefined,
      controls: IScannerControls | undefined,
      accepted = false,
      processing = false,
      last = "",
      lastAt = 0;
    const stop = () => {
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
    const hidden = () => {
      if (document.hidden) {
        disposed = true;
        stop();
        setStatus(
          "Kamera dihentikan saat aplikasi tidak aktif. Klik Coba lagi.",
        );
      }
    };
    document.addEventListener("visibilitychange", hidden);
    async function start() {
      setError("");
      setStatus("Meminta akses kamera…");
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw Error(
            "Kamera membutuhkan HTTPS atau localhost. Gunakan alamat HTTPS saat membuka dari ponsel.",
          );
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (disposed) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: device
            ? { deviceId: { exact: device } }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        });
        if (disposed) {
          stop();
          return;
        }
        const available = await navigator.mediaDevices.enumerateDevices();
        if (disposed) {
          stop();
          return;
        }
        setDevices(available.filter((d) => d.kind === "videoinput"));
        const reader = new BrowserMultiFormatReader();
        setStatus(
          "Arahkan QR / barcode ke kamera. Pastikan label terang dan terlihat utuh.",
        );
        controls = await reader.decodeFromStream(
          stream,
          video.current!,
          async (result) => {
            if (disposed || accepted || processing || !result) return;
            const code = result.getText().trim(),
              now = Date.now();
            if (code === last && now - lastAt < 2000) return;
            last = code;
            lastAt = now;
            processing = true;
            let issue: string | null;
            try {
              issue = await callback.current(code);
            } catch {
              issue = "Scan gagal diproses. Coba lagi.";
            } finally {
              processing = false;
            }
            if (disposed) return;
            if (issue) {
              setError(issue);
              return;
            }
            accepted = true;
            stop();
          },
        );
        if (disposed || accepted) stop();
      } catch (e) {
        stop();
        if (disposed) return;
        const name = e instanceof Error ? e.name : "";
        setStatus("Kamera belum aktif.");
        setError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Izinkan kamera pada pengaturan situs lalu coba lagi."
            : name === "NotFoundError"
              ? "Kamera tidak ditemukan. Hubungkan kamera atau gunakan input kode manual."
              : name === "NotReadableError"
                ? "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi."
                : e instanceof Error
                  ? e.message
                  : "Kamera gagal dibuka. Coba lagi atau gunakan input manual.",
        );
      }
    }
    void start();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", hidden);
      stop();
    };
  }, [device, retry]);
  return (
    <dialog
      ref={dialog}
      className="master-dialog eam-camera"
      aria-labelledby="camera-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <small>SCAN KAMERA</small>
          <h2 id="camera-title">{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Tutup kamera">
          ✕
        </button>
      </header>
      <div className="master-form-body">
        <div className="camera-preview">
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="Pratinjau kamera"
          />
          <div className="camera-guide" />
        </div>
        <p role="status">{status}</p>
        {error && (
          <p className="master-error" role="alert">
            {error}
          </p>
        )}
        {devices.length > 1 && (
          <label>
            Pilih kamera
            <select value={device} onChange={(e) => setDevice(e.target.value)}>
              <option value="">Otomatis / kamera belakang</option>
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Kamera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="master-footnote">
          Scan loading / isi palet langsung menyimpan barang ke order atau palet
          yang dipilih. Video diproses di perangkat dan tidak dikirim ke server.
        </p>
      </div>
      <footer>
        <button onClick={() => setRetry((r) => r + 1)}>Coba lagi</button>
        <button onClick={onClose}>Tutup / input manual</button>
      </footer>
    </dialog>
  );
}
