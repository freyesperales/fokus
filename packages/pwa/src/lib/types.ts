/**
 * Shared types — mirrors @fokus/extension's storage types so the JSON config can round-trip.
 */

export type RuleType = "domain" | "regex" | "prefix";

export interface Schedule {
  days: number[];
  startMin: number;
  endMin: number;
}

export interface Rule {
  id: string;
  pattern: string;
  type: RuleType;
  enabled: boolean;
  schedule?: Schedule;
}

export interface HardModeConfig {
  waitMinutes: number;
  requiredWords: number;
  allowMinutes: number;
  enabled: boolean;
}

export interface FokusSession {
  startedAt: number;
  endsAt: number | null;
}

export interface PairInfo {
  origin: string;
  code: string;
  key: string;
  pairedAt: number;
}

export interface FokusConfig {
  rules: Rule[];
  hardMode: HardModeConfig;
  allowances: Record<string, number>;
  telemetry: Record<string, number>;
  session: FokusSession | null;
  pair: PairInfo | null;
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
