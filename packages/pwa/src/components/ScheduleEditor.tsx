"use client";
import type { Rule } from "@/lib/types";

interface Props {
  rules: Rule[];
  onUpdate: (id: string, patch: Partial<Rule>) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parse(s: string): number {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export default function ScheduleEditor({ rules, onUpdate }: Props) {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-3 text-lg font-semibold">Schedules</h2>
      <p className="mb-3 text-xs text-slate-500">
        Rules with a schedule block during that window even without an active focus session.
      </p>
      {rules.length === 0 && <p className="text-sm text-slate-400">Add rules first.</p>}
      <div className="space-y-3">
        {rules.map((r) => {
          const sch = r.schedule;
          const hasSchedule = !!sch;
          return (
            <div key={r.id} className="rounded border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{r.pattern}</span>
                <label className="text-xs">
                  <input
                    type="checkbox"
                    checked={hasSchedule}
                    onChange={(e) =>
                      onUpdate(r.id, {
                        schedule: e.target.checked
                          ? { days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 17 * 60 }
                          : undefined,
                      })
                    }
                  />{" "}
                  Use schedule
                </label>
              </div>
              {sch && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex gap-1">
                    {DAY_LABELS.map((d, i) => {
                      const on = sch.days.includes(i);
                      return (
                        <button
                          key={d}
                          onClick={() =>
                            onUpdate(r.id, {
                              schedule: {
                                ...sch,
                                days: on
                                  ? sch.days.filter((x) => x !== i)
                                  : [...sch.days, i].sort(),
                              },
                            })
                          }
                          className={`rounded px-2 py-1 ${
                            on ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <span>from</span>
                  <input
                    type="time"
                    value={fmt(sch.startMin)}
                    onChange={(e) =>
                      onUpdate(r.id, { schedule: { ...sch, startMin: parse(e.target.value) } })
                    }
                    className="rounded border border-slate-300 px-2 py-1"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={fmt(sch.endMin)}
                    onChange={(e) =>
                      onUpdate(r.id, { schedule: { ...sch, endMin: parse(e.target.value) } })
                    }
                    className="rounded border border-slate-300 px-2 py-1"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
