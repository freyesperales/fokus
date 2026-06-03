"use client";
import { useState } from "react";

interface PairResp {
  code: string;
  key: string;
  expiresAt: number;
}

export default function PairCard() {
  const [pair, setPair] = useState<PairResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/pair", { method: "POST" });
      if (res.status === 429) {
        setErr("Too many pair codes. Try again in an hour.");
        return;
      }
      if (!res.ok) {
        setErr(`Server error: ${res.status}`);
        return;
      }
      setPair((await res.json()) as PairResp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-3 text-lg font-semibold">Pair an extension</h2>
      <p className="mb-4 text-xs text-slate-500">
        Generates a 6-letter code valid for 10 minutes. Type it into the extension's options page.
      </p>

      {!pair && (
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {loading ? "Generating…" : "Generate pair code"}
        </button>
      )}

      {pair && (
        <div className="space-y-3">
          <div className="rounded-lg bg-brand py-6 text-center font-mono text-5xl tracking-[0.3em] text-white">
            {pair.code}
          </div>
          <div className="text-xs text-slate-600">
            <div className="font-semibold">Pairing key (paste when prompted):</div>
            <div className="mt-1 break-all rounded bg-slate-100 px-2 py-1 font-mono text-[11px]">
              {pair.key}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => copy(pair.code)}
                className="rounded bg-slate-200 px-3 py-1 text-xs"
              >
                Copy code
              </button>
              <button
                onClick={() => copy(pair.key)}
                className="rounded bg-slate-200 px-3 py-1 text-xs"
              >
                Copy key
              </button>
              <button
                onClick={() => setPair(null)}
                className="ml-auto rounded bg-slate-100 px-3 py-1 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </section>
  );
}
