import { describe, expect, it } from "vitest";
import { firstMatch, isScheduleActive, matches, matchesPattern } from "../src/lib/rules.js";
import type { Rule } from "../src/lib/rules.js";

function rule(partial: Partial<Rule> & Pick<Rule, "pattern" | "type">): Rule {
  return { id: "r", enabled: true, ...partial };
}

describe("matchesPattern — domain rules", () => {
  it("blocks the apex domain", () => {
    expect(matchesPattern("https://example.com/", rule({ pattern: "example.com", type: "domain" })))
      .toBe(true);
  });

  it("blocks any subdomain", () => {
    expect(matchesPattern("https://www.example.com/x", rule({ pattern: "example.com", type: "domain" })))
      .toBe(true);
    expect(matchesPattern("https://a.b.example.com/x", rule({ pattern: "example.com", type: "domain" })))
      .toBe(true);
  });

  it("does not over-match: youtube.com rule does NOT block youtu.be?ref=youtube.com", () => {
    const r = rule({ pattern: "youtube.com", type: "domain" });
    expect(matchesPattern("https://youtu.be/foo?ref=youtube.com", r)).toBe(false);
  });

  it("does not match unrelated hosts that contain the pattern as a substring", () => {
    const r = rule({ pattern: "face.com", type: "domain" });
    expect(matchesPattern("https://typeface.com/x", r)).toBe(false);
    expect(matchesPattern("https://about.face.com/", r)).toBe(true);
  });

  it("is case-insensitive on host", () => {
    expect(matchesPattern("https://WWW.EXAMPLE.COM/", rule({ pattern: "Example.com", type: "domain" })))
      .toBe(true);
  });

  it("wildcard *.example.com matches subdomains but NOT apex", () => {
    const r = rule({ pattern: "*.example.com", type: "domain" });
    expect(matchesPattern("https://api.example.com/", r)).toBe(true);
    expect(matchesPattern("https://example.com/", r)).toBe(false);
  });

  it("returns false for malformed URLs", () => {
    expect(matchesPattern("not a url", rule({ pattern: "example.com", type: "domain" })))
      .toBe(false);
  });

  it("matches the path-less domain when given just a host with a port", () => {
    expect(matchesPattern("http://example.com:8080/y", rule({ pattern: "example.com", type: "domain" })))
      .toBe(true);
  });
});

describe("matchesPattern — prefix rules", () => {
  it("blocks only the specified path prefix on the host", () => {
    const r = rule({ pattern: "reddit.com/r/programming", type: "prefix" });
    expect(matchesPattern("https://reddit.com/r/programming", r)).toBe(true);
    expect(matchesPattern("https://reddit.com/r/programming/top", r)).toBe(true);
    expect(matchesPattern("https://reddit.com/r/news", r)).toBe(false);
  });

  it("falls back to domain match when no slash in pattern", () => {
    const r = rule({ pattern: "reddit.com", type: "prefix" });
    expect(matchesPattern("https://reddit.com/", r)).toBe(true);
    expect(matchesPattern("https://www.reddit.com/r/x", r)).toBe(true);
  });
});

describe("matchesPattern — regex rules", () => {
  it("treats pattern as regex against the whole URL", () => {
    const r = rule({ pattern: "^https://(www\\.)?news\\.ycombinator\\.com/?$", type: "regex" });
    expect(matchesPattern("https://news.ycombinator.com/", r)).toBe(true);
    expect(matchesPattern("https://news.ycombinator.com/item?id=1", r)).toBe(false);
  });

  it("returns false on invalid regex", () => {
    expect(matchesPattern("https://x.com", rule({ pattern: "(((unclosed", type: "regex" })))
      .toBe(false);
  });
});

describe("matches — enabled + schedule gating", () => {
  it("returns false when rule is disabled", () => {
    expect(matches("https://example.com", rule({ pattern: "example.com", type: "domain", enabled: false })))
      .toBe(false);
  });

  it("respects schedule windows", () => {
    const r = rule({
      pattern: "example.com",
      type: "domain",
      schedule: { days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 17 * 60 },
    });
    // Monday 2026-06-01 at 10:00 — Date.getDay() = 1.
    const inside = new Date(2026, 5, 1, 10, 0);
    const outside = new Date(2026, 5, 1, 8, 0);
    const weekend = new Date(2026, 5, 6, 10, 0); // Saturday
    expect(matches("https://example.com", r, inside)).toBe(true);
    expect(matches("https://example.com", r, outside)).toBe(false);
    expect(matches("https://example.com", r, weekend)).toBe(false);
  });

  it("isScheduleActive handles overnight windows", () => {
    const s = { days: [0, 1, 2, 3, 4, 5, 6], startMin: 22 * 60, endMin: 6 * 60 };
    expect(isScheduleActive(s, new Date(2026, 5, 1, 23, 0))).toBe(true);
    expect(isScheduleActive(s, new Date(2026, 5, 1, 5, 0))).toBe(true);
    expect(isScheduleActive(s, new Date(2026, 5, 1, 12, 0))).toBe(false);
  });
});

describe("firstMatch", () => {
  it("returns the first matching rule, in order", () => {
    const rules: Rule[] = [
      rule({ id: "a", pattern: "twitter.com", type: "domain" }),
      rule({ id: "b", pattern: "example.com", type: "domain" }),
    ];
    expect(firstMatch("https://example.com", rules)?.id).toBe("b");
    expect(firstMatch("https://nothing.org", rules)).toBe(null);
  });
});
