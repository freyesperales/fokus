import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LEN,
  generateCode,
  generateKey,
  hashKey,
  isValidCode,
} from "../src/lib/codes.js";

describe("generateCode", () => {
  it("produces a 6-letter code", () => {
    const c = generateCode();
    expect(c).toHaveLength(CODE_LEN);
  });

  it("only uses letters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCode();
      for (const ch of c) {
        expect(CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("never uses ambiguous I or O", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCode();
      expect(c).not.toMatch(/[IO]/);
    }
  });

  it("has reasonable distribution (no constant output)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateCode());
    // With ~191M possible codes, 500 samples should be effectively unique.
    expect(seen.size).toBeGreaterThan(490);
  });
});

describe("isValidCode", () => {
  it("accepts valid codes", () => {
    expect(isValidCode("ABCDEF")).toBe(true);
    expect(isValidCode(generateCode())).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isValidCode("ABC")).toBe(false);
    expect(isValidCode("ABCDEFG")).toBe(false);
    expect(isValidCode("")).toBe(false);
  });

  it("rejects ambiguous letters", () => {
    expect(isValidCode("ABCDEI")).toBe(false);
    expect(isValidCode("ABCDEO")).toBe(false);
  });

  it("rejects lowercase and non-letters", () => {
    expect(isValidCode("abcdef")).toBe(false);
    expect(isValidCode("ABCD12")).toBe(false);
  });
});

describe("generateKey + hashKey", () => {
  it("generates distinct base64url keys", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashKey is deterministic", () => {
    const k = generateKey();
    expect(hashKey(k)).toBe(hashKey(k));
  });

  it("hashKey produces 64 hex chars", () => {
    expect(hashKey("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
