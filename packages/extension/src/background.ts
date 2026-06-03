/**
 * Background service worker.
 *
 * Responsibilities:
 *  - Translate user blocklist rules + allowances + active session into declarativeNetRequest
 *    redirect rules pointing at blocked.html.
 *  - Tick once per minute to expire allowances and re-evaluate schedules.
 *  - Track minutes-blocked telemetry.
 *  - Sync with PWA on relevant changes.
 */
import { isScheduleActive, type Rule } from "./lib/rules.js";
import {
  loadConfig,
  saveConfig,
  updateConfig,
  type FokusConfig,
} from "./lib/storage.js";
import { pushConfig } from "./lib/sync.js";

const ALARM_TICK = "fokus.tick";
const RULE_ID_OFFSET = 1000; // DNR rule IDs must be >= 1.

function ruleIdFor(index: number): number {
  return RULE_ID_OFFSET + index;
}

function dnrRedirectUrl(reasonRuleId: string): string {
  return chrome.runtime.getURL(`blocked.html?rule=${encodeURIComponent(reasonRuleId)}`);
}

/**
 * Build DNR rules from the FokusConfig. Returns an array of dynamic rule objects.
 */
function buildDnrRules(cfg: FokusConfig, now: Date): chrome.declarativeNetRequest.Rule[] {
  // Session must be active OR rule schedule must say so.
  const sessionActive = cfg.session !== null;
  const dnrRules: chrome.declarativeNetRequest.Rule[] = [];
  const allowedHosts = new Set(
    Object.entries(cfg.allowances)
      .filter(([, exp]) => exp > now.getTime())
      .map(([host]) => host.toLowerCase()),
  );

  let i = 0;
  for (const rule of cfg.rules) {
    if (!rule.enabled) continue;
    if (rule.schedule) {
      if (!isScheduleActive(rule.schedule, now)) continue;
    } else if (!sessionActive) {
      // No schedule + no session = nothing to enforce.
      continue;
    }

    const condition = ruleToDnrCondition(rule);
    if (!condition) continue;

    dnrRules.push({
      id: ruleIdFor(i++),
      priority: 1,
      action: {
        type: "redirect" as chrome.declarativeNetRequest.RuleActionType,
        redirect: { url: dnrRedirectUrl(rule.id) },
      },
      condition: {
        ...condition,
        resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType],
      },
    });
  }

  // Layer allowances: higher-priority allow rules for whitelisted hosts.
  let j = 0;
  for (const host of allowedHosts) {
    dnrRules.push({
      id: ruleIdFor(500 + j++),
      priority: 100,
      action: { type: "allow" as chrome.declarativeNetRequest.RuleActionType },
      condition: {
        requestDomains: [host],
        resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType],
      },
    });
  }

  return dnrRules;
}

function ruleToDnrCondition(
  rule: Rule,
): chrome.declarativeNetRequest.RuleCondition | null {
  if (rule.type === "domain") {
    const pattern = rule.pattern.trim().replace(/^\*\./, "");
    return { requestDomains: [pattern.toLowerCase()] };
  }
  if (rule.type === "prefix") {
    const slash = rule.pattern.indexOf("/");
    if (slash === -1) {
      return { requestDomains: [rule.pattern.trim().toLowerCase()] };
    }
    const host = rule.pattern.slice(0, slash).trim().toLowerCase();
    const path = rule.pattern.slice(slash);
    return {
      requestDomains: [host],
      urlFilter: `||${host}${path}`,
    };
  }
  if (rule.type === "regex") {
    return { regexFilter: rule.pattern };
  }
  return null;
}

async function reconcileDnr(): Promise<void> {
  const cfg = await loadConfig();
  const wanted = buildDnrRules(cfg, new Date());
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: wanted,
  });
}

async function bumpTelemetry(): Promise<void> {
  // Crude: if any rule would block at least one site right now, count this minute.
  const cfg = await loadConfig();
  const wanted = buildDnrRules(cfg, new Date());
  if (wanted.length === 0) return;
  const day = new Date().toISOString().slice(0, 10);
  await updateConfig((c) => {
    c.telemetry[day] = (c.telemetry[day] ?? 0) + 1;
  });
}

async function maybeAutoStop(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg.session) return;
  if (cfg.session.endsAt && cfg.session.endsAt <= Date.now()) {
    cfg.session = null;
    await saveConfig(cfg);
  }
}

async function expireAllowances(): Promise<void> {
  const cfg = await loadConfig();
  const now = Date.now();
  let changed = false;
  for (const [host, exp] of Object.entries(cfg.allowances)) {
    if (exp <= now) {
      delete cfg.allowances[host];
      changed = true;
    }
  }
  if (changed) await saveConfig(cfg);
}

async function syncToPwa(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg.pair) return;
  try {
    await pushConfig(cfg.pair, cfg);
  } catch {
    // Silent — PWA may be offline.
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await reconcileDnr();
  await chrome.alarms.create(ALARM_TICK, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  await reconcileDnr();
  await chrome.alarms.create(ALARM_TICK, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_TICK) return;
  await expireAllowances();
  await maybeAutoStop();
  await reconcileDnr();
  await bumpTelemetry();
});

chrome.storage.onChanged.addListener(async (_changes, area) => {
  if (area !== "local") return;
  await reconcileDnr();
  await syncToPwa();
});

// Message API for popup/options/blocked pages.
type Msg =
  | { kind: "start-session"; minutes?: number }
  | { kind: "stop-session" }
  | { kind: "grant-allowance"; host: string; minutes: number }
  | { kind: "reconcile" };

chrome.runtime.onMessage.addListener(
  (msg: Msg, _sender, sendResponse: (r: { ok: true } | { ok: false; error: string }) => void) => {
    (async () => {
      try {
        if (msg.kind === "start-session") {
          await updateConfig((c) => {
            c.session = {
              startedAt: Date.now(),
              endsAt: msg.minutes ? Date.now() + msg.minutes * 60_000 : null,
            };
          });
        } else if (msg.kind === "stop-session") {
          await updateConfig((c) => {
            c.session = null;
          });
        } else if (msg.kind === "grant-allowance") {
          await updateConfig((c) => {
            c.allowances[msg.host.toLowerCase()] = Date.now() + msg.minutes * 60_000;
          });
        }
        await reconcileDnr();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  },
);
