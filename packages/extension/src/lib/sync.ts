/**
 * Pair the extension with a PWA dashboard via a 6-letter code.
 *
 * Flow:
 *   1. PWA: POST /api/pair → { code, key }. User reads "ABCDEF" off the screen.
 *   2. Extension options: user types the code + origin. We call POST /api/pair/[code] with
 *      Authorization: Bearer <key>, action="claim". Server returns the config.
 *   3. Later, either side can pull/push by re-using { code, key }.
 *
 * Keys are stored locally only; the PWA only ever holds the hash (in its sqlite db).
 */
import { loadConfig, saveConfig, type FokusConfig, type PairInfo } from "./storage.js";

export interface PairResponse {
  code: string;
  key: string;
  expiresAt: number;
}

export async function generatePair(origin: string): Promise<PairResponse> {
  const res = await fetch(new URL("/api/pair", origin).toString(), { method: "POST" });
  if (!res.ok) throw new Error(`Pair init failed: ${res.status}`);
  return (await res.json()) as PairResponse;
}

export async function claimPair(
  origin: string,
  code: string,
  key: string,
): Promise<FokusConfig | null> {
  const url = new URL(`/api/pair/${encodeURIComponent(code)}`, origin).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ action: "claim" }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Pair claim failed: ${res.status}`);
  const data = (await res.json()) as { config: FokusConfig | null };
  return data.config;
}

export async function pushConfig(pair: PairInfo, config: FokusConfig): Promise<void> {
  const url = new URL(`/api/pair/${encodeURIComponent(pair.code)}`, pair.origin).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pair.key}`,
    },
    body: JSON.stringify({ action: "push", config }),
  });
  if (!res.ok) throw new Error(`Push failed: ${res.status}`);
}

export async function pullConfig(pair: PairInfo): Promise<FokusConfig | null> {
  const url = new URL(`/api/pair/${encodeURIComponent(pair.code)}`, pair.origin).toString();
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${pair.key}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
  const data = (await res.json()) as { config: FokusConfig | null };
  return data.config;
}

export async function pairWith(origin: string, code: string, key: string): Promise<void> {
  const remote = await claimPair(origin, code, key);
  const cfg = await loadConfig();
  cfg.pair = { origin, code, key, pairedAt: Date.now() };
  if (remote) {
    cfg.rules = remote.rules;
    cfg.hardMode = remote.hardMode;
  } else {
    // Push our local config so the PWA can start with something.
    await pushConfig(cfg.pair, cfg);
  }
  await saveConfig(cfg);
}
