"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { Action, createDemo, State, transition } from "./domain";
import { supabaseClient } from "./adapters";
const KEY = "csms-demo-v1";
export function useCSMS() {
  const [state, setState] = useState<State | null>(null);
  const ref = useRef<State | null>(null);
  const [error, setError] = useState("");
  const client = useRef<SupabaseClient | null>(null);
  const [mode, setMode] = useState<"local" | "supabase">("local");
  const modeRef = useRef<"local" | "supabase">("local");
  const [role, setRole] = useState("demo");
  const loadRemote = useCallback(async () => {
    const c = client.current;
    if (!c) return;
    const { data, error } = await c.rpc("csms_snapshot");
    if (error) throw error;
    const next = data as State;
    if (!next?.config || next.rooms.length !== 2)
      throw Error(
        "Jalankan migrasi dan seed: diperlukan dua ruang dan konfigurasi fasilitas.",
      );
    ref.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    client.current = supabaseClient();
    try {
      const stored = localStorage.getItem(KEY);
      const next = stored ? (JSON.parse(stored) as State) : createDemo();
      if (next.version !== 1) throw Error("Versi data tidak sesuai");
      ref.current = next;
      setState(next);
    } catch {
      const next = createDemo();
      ref.current = next;
      setState(next);
      setError("Data demo lokal tidak dapat dibaca; demo baru dimuat.");
    }
    const sync = (e: StorageEvent) => {
      if (modeRef.current === "local" && e.key === KEY && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as State;
          ref.current = next;
          setState(next);
        } catch {
          setError("Sinkronisasi data gagal.");
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const commit = useCallback((next: State) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    ref.current = next;
    setState(next);
  }, []);
  const act = useCallback(
    async (action: Action) => {
      try {
        if (!ref.current) return false;
        if (modeRef.current === "supabase") {
          const { error } = await client.current!.rpc("csms_operate", {
            a: action,
          });
          if (error) throw error;
          await loadRemote();
        } else {
          await navigator.locks.request("csms-demo-write", () => {
            const stored = localStorage.getItem(KEY);
            const current = stored
              ? (JSON.parse(stored) as State)
              : ref.current!;
            commit(transition(current, action));
          });
        }
        setError("");
        return true;
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : ((e as { message?: string }).message ?? "Operasi gagal"),
        );
        return false;
      }
    },
    [commit, loadRemote],
  );
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (modeRef.current === "supabase") {
        if (role === "admin")
          void client.current!.rpc("tick_csms_simulator").then(({ error }) => {
            if (error) setError(error.message);
            else void loadRemote().catch((e) => setError(String(e.message)));
          });
        return;
      }
      void navigator.locks.request(
        "csms-demo-write",
        { ifAvailable: true },
        (lock) => {
          if (!lock) return;
          try {
            const stored = localStorage.getItem(KEY);
            const current = stored
              ? (JSON.parse(stored) as State)
              : ref.current;
            if (!current) return;
            const latest = Math.max(
              ...current.rooms
                .filter(
                  (r) =>
                    r.running && !["offline", "stale"].includes(r.scenario),
                )
                .map((r) => new Date(r.lastUpdate).getTime()),
            );
            if (Number.isFinite(latest) && Date.now() - latest < 2500) return;
            commit(
              transition(current, {
                type: "tick",
                now: new Date().toISOString(),
              }),
            );
          } catch {
            setError("Penyimpanan simulator gagal.");
          }
        },
      );
    }, 3000);
    return () => clearInterval(id);
  }, [commit, loadRemote, role]);
  useEffect(() => {
    if (mode !== "supabase" || !client.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const c = client.current;
    const channel = c
      .channel("csms-live")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        clearTimeout(timer);
        timer = setTimeout(
          () => void loadRemote().catch((e) => setError(String(e.message))),
          200,
        );
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void c.removeChannel(channel);
    };
  }, [mode, loadRemote]);
  const connect = async (email: string, password: string) => {
    try {
      const c = client.current;
      if (!c)
        throw Error(
          "Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY, kemudian jalankan ulang server.",
        );
      const { data, error } = await c.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const profile = await c
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profile.error) throw profile.error;
      await loadRemote();
      setRole(profile.data.role);
      modeRef.current = "supabase";
      setMode("supabase");
      setError("");
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : (e as { message: string }).message,
      );
      return false;
    }
  };
  const disconnect = async () => {
    await client.current?.auth.signOut();
    modeRef.current = "local";
    setMode("local");
    setRole("demo");
    const stored = localStorage.getItem(KEY);
    const next = stored ? (JSON.parse(stored) as State) : createDemo();
    ref.current = next;
    setState(next);
  };
  const reset = () => {
    if (modeRef.current !== "local") {
      setError("Reset global hanya tersedia untuk demo lokal.");
      return;
    }
    try {
      commit(createDemo());
      setError("");
    } catch {
      setError("Reset gagal disimpan.");
    }
  };
  return {
    state,
    act,
    reset,
    error,
    setError,
    mode,
    role,
    connect,
    disconnect,
  };
}
