"use client";
import type { HardModeConfig } from "@/lib/types";

interface Props {
  value: HardModeConfig;
  onChange: (next: HardModeConfig) => void;
}

export default function HardModeToggle({ value, onChange }: Props) {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-3 text-lg font-semibold">Hard mode</h2>
      <p className="mb-4 text-xs text-slate-500">
        How painful is unblocking mid-session?
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Hard mode enabled (off = soft, one-click disable allowed)
      </label>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <label className="block">
          <span className="text-xs text-slate-500">Wait minutes</span>
          <input
            type="number"
            min={1}
            max={120}
            value={value.waitMinutes}
            onChange={(e) =>
              onChange({ ...value, waitMinutes: Math.max(1, Number(e.target.value) || 5) })
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Required words</span>
          <input
            type="number"
            min={50}
            max={1000}
            value={value.requiredWords}
            onChange={(e) =>
              onChange({ ...value, requiredWords: Math.max(50, Number(e.target.value) || 200) })
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Allowance (min)</span>
          <input
            type="number"
            min={1}
            max={120}
            value={value.allowMinutes}
            onChange={(e) =>
              onChange({ ...value, allowMinutes: Math.max(1, Number(e.target.value) || 10) })
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
      </div>
    </section>
  );
}
