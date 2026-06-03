/**
 * Typed wrapper over chrome.storage.local. Single source of truth for the persistent config shape.
 */
import type { Rule } from "./rules.js";

export interface HardModeConfig {
  /** Wait countdown in minutes for the "wait" unlock path. */
  waitMinutes: number;
  /** Word count required for the "write" unlock path. */
  requiredWords: number;
  /** How long the temporary allowance lasts once granted (minutes). */
  allowMinutes: number;
  /** If false, popup gets a one-click off switch (soft mode). */
  enabled: boolean;
}

export interface PairInfo {
  /** PWA dashboard origin we paired with (e.g. http://localhost:3000). */
  origin: string;
  /** Pair code (6 letters). */
  code: string;
  /** Secret key (base64url) used to authorize push/pull. */
  key: string;
  pairedAt: number;
}

export interface FokusConfig {
  rules: Rule[];
  hardMode: HardModeConfig;
  /** Temporary domain allowances → expiresAt epoch ms. */
  allowances: Record<string, number>;
  /** Total minutes blocked per UTC day (YYYY-MM-DD → minutes). Used for the dashboard chart. */
  telemetry: Record<string, number>;
  /** Active focus session, if any. */
  session: FokusSession | null;
  pair: PairInfo | null;
}

export interface FokusSession {
  startedAt: number;
  /** Optional auto-stop time. */
  endsAt: number | null;
}

export const DEFAULT_CONFIG: FokusConfig = {
  rules: [],
  hardMode: {
    waitMinutes: 5,
    requiredWords: 200,
    allowMinutes: 10,
    enabled: true,
  },
  allowances: {},
  telemetry: {},
  session: null,
  pair: null,
};

const STORAGE_KEY = "fokus.config.v1";

type StorageArea = {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

function storage(): StorageArea {
  // In tests we can shim chrome.storage.local with an in-memory fake.
  const c = (globalThis as { chrome?: { storage?: { local?: StorageArea } } }).chrome;
  if (!c?.storage?.local) {
    throw new Error("chrome.storage.local unavailable");
  }
  return c.storage.local;
}

export async function loadConfig(): Promise<FokusConfig> {
  const res = await storage().get(STORAGE_KEY);
  const raw = res[STORAGE_KEY] as Partial<FokusConfig> | undefined;
  if (!raw) return structuredClone(DEFAULT_CONFIG);
  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...raw,
    hardMode: { ...DEFAULT_CONFIG.hardMode, ...(raw.hardMode ?? {}) },
  };
}

export async function saveConfig(cfg: FokusConfig): Promise<void> {
  await storage().set({ [STORAGE_KEY]: cfg });
}

export async function updateConfig(
  mut: (cfg: FokusConfig) => FokusConfig | void,
): Promise<FokusConfig> {
  const cfg = await loadConfig();
  const next = mut(cfg) ?? cfg;
  await saveConfig(next);
  return next;
}
