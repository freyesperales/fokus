"use client";
import { useEffect, useState } from "react";
import { DEFAULT_CONFIG, type FokusConfig, type Rule, type RuleType } from "@/lib/types";
import BlocklistEditor from "@/components/BlocklistEditor";
import HardModeToggle from "@/components/HardModeToggle";
import PairCard from "@/components/PairCard";
import ScheduleEditor from "@/components/ScheduleEditor";

const LS_KEY = "fokus.dashboard.v1";

function load(): FokusConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<FokusConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default function Dashboard() {
  const [config, setConfig] = useState<FokusConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConfig(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(LS_KEY, JSON.stringify(config));
  }, [config, ready]);

  function addRule(pattern: string, type: RuleType) {
    const r: Rule = {
      id: Math.random().toString(36).slice(2, 10),
      pattern,
      type,
      enabled: true,
    };
    setConfig((c) => ({ ...c, rules: [...c.rules, r] }));
  }

  function updateRule(id: string, patch: Partial<Rule>) {
    setConfig((c) => ({
      ...c,
      rules: c.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function removeRule(id: string) {
    setConfig((c) => ({ ...c, rules: c.rules.filter((r) => r.id !== id) }));
  }

  const last7 = (() => {
    const out: { day: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key.slice(5), minutes: config.telemetry[key] ?? 0 });
    }
    return out;
  })();
  const max = Math.max(1, ...last7.map((x) => x.minutes));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-brand">fokus</h1>
        <p className="mt-1 text-slate-600">Focus mode dashboard.</p>
      </header>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Last 7 days</h2>
        <div className="flex items-end gap-2 h-32">
          {last7.map((d) => (
            <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-full bg-brand/80 rounded-t"
                style={{ height: `${(d.minutes / max) * 100}%`, minHeight: 2 }}
                title={`${d.minutes} min`}
              />
              <span className="text-xs text-slate-500">{d.day}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Minutes during which at least one rule was actively blocking. Pair an extension to start
          recording.
        </p>
      </section>

      <BlocklistEditor
        rules={config.rules}
        onAdd={addRule}
        onUpdate={updateRule}
        onRemove={removeRule}
      />

      <ScheduleEditor
        rules={config.rules}
        onUpdate={updateRule}
      />

      <HardModeToggle
        value={config.hardMode}
        onChange={(hardMode) => setConfig((c) => ({ ...c, hardMode }))}
      />

      <PairCard />

      <footer className="mt-12 text-center text-xs text-slate-400">
        fokus v0.1 · MIT licensed
      </footer>
    </main>
  );
}
