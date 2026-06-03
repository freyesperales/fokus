"use client";
import { useState } from "react";
import type { Rule, RuleType } from "@/lib/types";

interface Props {
  rules: Rule[];
  onAdd: (pattern: string, type: RuleType) => void;
  onUpdate: (id: string, patch: Partial<Rule>) => void;
  onRemove: (id: string) => void;
}

export default function BlocklistEditor({ rules, onAdd, onUpdate, onRemove }: Props) {
  const [pattern, setPattern] = useState("");
  const [type, setType] = useState<RuleType>("domain");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim()) return;
    onAdd(pattern.trim(), type);
    setPattern("");
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-3 text-lg font-semibold">Blocked sites</h2>

      <ul className="divide-y divide-slate-100">
        {rules.length === 0 && (
          <li className="py-3 text-sm text-slate-400">No rules yet. Add one below.</li>
        )}
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => onUpdate(r.id, { enabled: e.target.checked })}
              className="h-4 w-4"
              aria-label={`Enable ${r.pattern}`}
            />
            <span className="flex-1 font-mono text-sm">{r.pattern}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.type}</span>
            <button
              onClick={() => onRemove(r.id)}
              className="text-xs text-rose-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="example.com"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as RuleType)}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="domain">domain</option>
          <option value="prefix">prefix</option>
          <option value="regex">regex</option>
        </select>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
          Add
        </button>
      </form>
    </section>
  );
}
