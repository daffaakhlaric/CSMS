"use client";
import { supabaseClient } from "@/lib/adapters";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { State } from "@/lib/domain";
import { assistantContext } from "@/lib/assistant-context";
type Message = { role: "user" | "assistant"; content: string };
export default function AIAssistant({
  state,
  mode,
}: {
  state: State;
  mode: string;
}) {
  const [open, setOpen] = useState(false),
    [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  useEffect(() => {
    setMessages([]);
    setError("");
  }, [mode]);
  async function send(text = question) {
    if (!text.trim() || busy) return;
    const next: Message[] = [
      ...messages,
      { role: "user" as const, content: text.trim() },
    ].slice(-11);
    setMessages(next);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const evaluations = state.rooms.map((r) => {
        try {
          return {
            room: r.id,
            reports: JSON.parse(
              localStorage.getItem(`csms-evaluations-${r.id}`) || "[]",
            ).slice(0, 1),
          };
        } catch {
          return { room: r.id, reports: [] };
        }
      });
      const session = await supabaseClient()?.auth.getSession();
      const accessToken = session?.data.session?.access_token;
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({
          messages: next,
          context: {
            ...assistantContext(
              state,
              next
                .filter((m) => m.role === "user")
                .map((m) => m.content)
                .join(" "),
              mode,
            ),
            evaluations,
          },
        }),
        signal: AbortSignal.timeout(50000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setMessages([...next, { role: "assistant", content: result.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan");
      setQuestion(text);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ai-assistant">
      {open && (
        <section className="ai-chat" role="dialog" aria-label="Asisten AI CSMS">
          <header>
            <div>
              <b>Asisten AI CSMS</b>
              <small>Inventori · suhu · insight simulasi</small>
            </div>
            <button aria-label="Tutup asisten" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </header>
          <p className="ai-context">
            {mode === "local" ? "Data demo lokal" : "Data sesi Supabase"} ·
            Snapshot diperbarui setiap pesan · Akses baca
          </p>
          <div className="ai-messages" role="log" aria-live="polite">
            {!messages.length && (
              <div>
                <p>
                  Tanyakan kondisi ruang, jumlah barang, atau lokasi karung.
                  Saya juga bisa menjelaskan hasil evaluasi AI yang tersimpan.
                </p>
                <div className="ai-suggestions">
                  {[
                    "Bagaimana suhu kedua ruang sekarang?",
                    "Berapa stok barang per ruang?",
                    "Di mana KRG-00001?",
                    "Jelaskan insight evaluasi terakhir",
                  ].map((q) => (
                    <button key={q} onClick={() => send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-message ${m.role}`}>
                <small>{m.role === "user" ? "Anda" : "Asisten AI"}</small>
                <p>{m.content}</p>
              </div>
            ))}
            {busy && <p role="status">Membaca data dan menyusun jawaban…</p>}
            {error && <p role="alert">{error}</p>}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="ai-question">
              Pertanyaan untuk asisten
            </label>
            <input
              id="ai-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={2000}
              placeholder="Tanya barang, suhu, atau hasil simulasi…"
              disabled={busy}
            />
            <button
              className="button primary"
              disabled={busy || !question.trim()}
              aria-label="Kirim pertanyaan"
            >
              <Send size={18} />
            </button>
          </form>
          <small className="ai-footnote">
            Ringkasan data dikirim ke OpenAI saat Anda mengirim pesan.
          </small>
        </section>
      )}
      <button
        className="button primary ai-launcher"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <MessageCircle size={20} /> Tanya Asisten AI
      </button>
    </div>
  );
}
