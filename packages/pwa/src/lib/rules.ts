/**
 * URL matching for blocklist rules. Duplicated from @fokus/extension/src/lib/rules.ts
 * by design — the PWA and extension intentionally don't share runtime code; instead
 * the file is copy-synced. Keep these two files in sync.
 */
import type { Rule, Schedule } from "./types.js";

function safeUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function hostMatchesDomain(urlHost: string, pattern: string): boolean {
  const host = urlHost.toLowerCase();
  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2).toLowerCase();
    return host.endsWith("." + base) && host !== base;
  }
  const p = pattern.toLowerCase();
  return host === p || host.endsWith("." + p);
}

export function matchesPattern(url: string, rule: Pick<Rule, "pattern" | "type">): boolean {
  if (!rule.pattern) return false;
  if (rule.type === "regex") {
    try {
      return new RegExp(rule.pattern).test(url);
    } catch {
      return false;
    }
  }
  const u = safeUrl(url);
  if (!u) return false;
  if (rule.type === "domain") {
    return hostMatchesDomain(u.hostname, rule.pattern.trim());
  }
  if (rule.type === "prefix") {
    const trimmed = rule.pattern.trim();
    const slash = trimmed.indexOf("/");
    if (slash === -1) return hostMatchesDomain(u.hostname, trimmed);
    const host = trimmed.slice(0, slash);
    const path = trimmed.slice(slash);
    return hostMatchesDomain(u.hostname, host) && u.pathname.startsWith(path);
  }
  return false;
}

export function isScheduleActive(schedule: Schedule, now: Date): boolean {
  if (!schedule.days.includes(now.getDay())) return false;
  const min = now.getHours() * 60 + now.getMinutes();
  if (schedule.startMin <= schedule.endMin) {
    return min >= schedule.startMin && min < schedule.endMin;
  }
  return min >= schedule.startMin || min < schedule.endMin;
}
