/**
 * URL matching for blocklist rules.
 *
 * Three rule types:
 *  - domain: matches a host and any subdomain ("example.com" → example.com, www.example.com, a.b.example.com)
 *            but NOT "youtu.be?ref=example.com". Wildcard form "*.example.com" matches only subdomains
 *            (not the apex).
 *  - prefix: domain + path prefix, e.g. "example.com/news" → blocks any URL on example.com whose path
 *            starts with /news.
 *  - regex:  raw regex tested against the full URL. User's responsibility to anchor it.
 *
 * Inactive rules never match.
 */

export type RuleType = "domain" | "regex" | "prefix";

export interface Rule {
  id: string;
  pattern: string;
  type: RuleType;
  enabled: boolean;
  /**
   * Optional schedule. If present, the rule only blocks when "now" is within the window.
   * Windows are local-time, weekly. days = 0..6 (Sun..Sat). startMin/endMin = minutes from midnight.
   */
  schedule?: Schedule;
}

export interface Schedule {
  days: number[];
  startMin: number;
  endMin: number;
}

function safeUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function hostMatchesDomain(urlHost: string, pattern: string): boolean {
  const host = urlHost.toLowerCase();
  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2).toLowerCase();
    // Subdomain-only match: base itself must NOT match.
    return host.endsWith("." + base) && host !== base;
  }
  const p = pattern.toLowerCase();
  return host === p || host.endsWith("." + p);
}

/**
 * Returns true if the URL should be blocked by this rule, ignoring schedule.
 */
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
    // "example.com/path" → split into host + path.
    const trimmed = rule.pattern.trim();
    const slash = trimmed.indexOf("/");
    if (slash === -1) {
      return hostMatchesDomain(u.hostname, trimmed);
    }
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
  // Overnight window (e.g. 22:00 → 06:00).
  return min >= schedule.startMin || min < schedule.endMin;
}

/**
 * Full match: respects enabled + schedule + pattern.
 */
export function matches(url: string, rule: Rule, now: Date = new Date()): boolean {
  if (!rule.enabled) return false;
  if (rule.schedule && !isScheduleActive(rule.schedule, now)) return false;
  return matchesPattern(url, rule);
}

/**
 * Picks the first matching rule. Useful for "why was this blocked?" UI.
 */
export function firstMatch(url: string, rules: Rule[], now: Date = new Date()): Rule | null {
  for (const r of rules) {
    if (matches(url, r, now)) return r;
  }
  return null;
}

export { normalizeHost };
