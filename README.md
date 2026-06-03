# fokus

> Hard-mode website blocker. Browser extension + PWA dashboard, paired with a 6-letter code.

A focus-mode blocker for Chrome, Firefox, and Edge with a Next.js dashboard you can install as a PWA. The differentiator: **hard mode**. Unblocking a site mid-session means typing a 200-word reflection or waiting 5 minutes. No one-click off switch.

![status](https://img.shields.io/badge/status-alpha-yellow) ![license](https://img.shields.io/badge/license-MIT-green) ![manifest](https://img.shields.io/badge/manifest-v3-blue)

---

## What this is and is not

**It IS** a self-discipline tool:

- A Manifest V3 browser extension that blocks URLs via `declarativeNetRequest` redirect rules pointing at an in-extension `blocked.html`.
- A Next.js PWA dashboard you can install on phone or desktop to manage rules, schedules, and hard-mode settings remotely.
- A 6-letter pairing handshake so the extension and PWA share config without an account.
- Domain / domain-wildcard / URL-prefix / regex rule types with weekly time-window schedules.
- Hard-mode unlock that requires a typed reflection (≥ 200 words) or a wait countdown (default 5 min).

**It is NOT** a security boundary:

- A determined user with **DevTools** can rewrite the in-page unlock logic and click submit immediately.
- `chrome://extensions` lets you disable or remove the extension in two clicks.
- `chrome.storage.local` is editable from the DevTools Application panel — set every rule's `enabled: false` and you're done.
- **A different browser** that the extension isn't installed in bypasses everything.
- **Incognito mode** without the extension explicitly allowed bypasses it too.

That's five trivial bypasses, and we list them on purpose. fokus is built for the moment you reach for YouTube on autopilot — it inserts friction, not a wall. If you need actual lockdown (kids, employees, court-ordered abstinence) you want OS-level parental controls, MDM, or DNS filtering — not a browser extension.

---

## How it works

```
  ┌──────────────────┐                ┌────────────────────┐
  │  PWA dashboard   │  pair handshake│  Browser extension │
  │  (Next.js)       │ ◄────────────► │  (Manifest V3)     │
  │                  │   6-letter code│                    │
  │ • SQLite store   │   + 256-bit key│ • DNR rules        │
  │ • Rules editor   │                │ • blocked.html     │
  │ • Telemetry view │                │ • background tick  │
  └──────────────────┘                └──────────┬─────────┘
                                                 │ chrome.declarativeNetRequest
                                                 ▼
                              ┌─────────────────────────────┐
                              │ Browser network stack       │
                              │ blocked URL → redirect to   │
                              │ blocked.html?rule=<id>      │
                              └─────────────────────────────┘
```

**Rule emission.** The background service worker (`packages/extension/src/background.ts`) translates the user's `FokusConfig` into a list of `chrome.declarativeNetRequest.Rule` objects, then calls `updateDynamicRules` to reconcile. Blocked requests are redirected to `chrome.runtime.getURL("blocked.html?rule=<id>")`. Allowances (temporary unblocks) are higher-priority `allow` rules with `priority: 100`. A `chrome.alarms` tick runs every minute to expire allowances, auto-stop sessions, re-emit DNR rules, and bump telemetry counters.

**Unlock flow.** `blocked.html` shows two paths: a wait timer (default 5 min) and a textarea that enables submission at ≥ 200 words. Either grants a temporary `allowance` (default 10 min) for that host. The service worker re-reconciles DNR rules, the user lands on the original URL, and the allowance expires on the next minute-tick.

**Pairing.** The PWA generates a 6-letter code (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ` — no I/O ambiguity) and a 256-bit base64url key (`packages/pwa/src/lib/codes.ts`). The server stores `code → SHA-256(key)`. The extension claims the code by presenting the plaintext key; the server verifies the hash and returns the config blob. Unclaimed codes expire in 10 minutes (`CODE_TTL_MS`). Claimed pairs live until deleted.

---

## Repository layout

```
fokus/
├── packages/
│   ├── extension/   Manifest V3 extension (Vite build → dist/)
│   │   └── src/    background.ts, blocked.html/.ts, popup, options, lib/{rules,storage,sync}
│   └── pwa/         Next.js dashboard + pairing API
│       └── src/    app/, lib/{codes,db,rules,types}
├── package.json     workspaces root
└── tsconfig.base.json
```

---

## Install / run

### Develop locally

```bash
# from the repo root
npm install

# build the extension (output: packages/extension/dist/)
npm --workspace @fokus/extension run build

# start the PWA at http://localhost:3000
npm --workspace @fokus/pwa run dev

# run all tests
npm test --workspaces
```

### Load the extension in Chrome / Edge

1. Build it: `npm --workspace @fokus/extension run build`.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** → select `packages/extension/dist/`.

### Load in Firefox

1. Build it.
2. Visit `about:debugging#/runtime/this-firefox`.
3. **Load Temporary Add-on…** → select `packages/extension/dist/manifest.json`.

Firefox unloads temporary add-ons on restart. For persistent dev, use Firefox Developer Edition or sign through Mozilla's AMO.

### Pair the extension with the PWA

1. Run the PWA (`npm --workspace @fokus/pwa run dev`).
2. Open `http://localhost:3000` → **Generate pair code**. Copy the 6-letter code and the base64url key.
3. In the extension's options page: paste your PWA origin (`http://localhost:3000`), the code, then the key when prompted.
4. The extension fetches the dashboard config and starts pushing telemetry.

---

## URL matching

Rules have three types. The canonical implementation lives in `packages/extension/src/lib/rules.ts` and is mirrored in `packages/pwa/src/lib/rules.ts` for preview in the dashboard — there's a header note in both files to keep them in sync.

| type | example | matches |
|---|---|---|
| `domain` | `youtube.com` | `youtube.com`, `www.youtube.com`, `m.youtube.com`. **Not** `youtu.be?ref=youtube.com`. |
| `domain` | `*.youtube.com` | Subdomains only — `m.youtube.com`. **Not** `youtube.com` itself. |
| `prefix` | `reddit.com/r/programming` | `reddit.com/r/programming/…` only. |
| `regex` | `^https://news\.ycombinator\.com/?$` | Full-URL regex; anchor it yourself. |

Each rule can carry a weekly `schedule` (`{ days: 0..6, startMin, endMin }`, local time). With no schedule, the rule only applies during an active focus `session`.

---

## Hard mode

Default config (`packages/extension/src/lib/storage.ts → DEFAULT_CONFIG`):

```ts
hardMode: {
  enabled: true,
  waitMinutes: 5,
  requiredWords: 200,
  allowMinutes: 10,
}
```

When a blocked URL is redirected to `blocked.html`, the user sees two unlock paths:

1. **Wait it out** — countdown starts at `waitMinutes`. Hits zero → host gets `allowMinutes` of allowance → page reloads to the original URL.
2. **Write to unblock** — textarea. Submit enables at `requiredWords` words. Same allowance granted on submit.

Lower both numbers — or disable hard mode entirely — in the options page. Soft mode adds a one-click off switch to the popup. Allowances expire on the next minute-tick of the background `chrome.alarms` worker, and the DNR ruleset reconciles.

---

## Threat model

fokus targets **one specific failure mode**: you reach for a distracting site on autopilot, before your conscious self can intervene. The friction of "type 200 words or wait 5 minutes" gives the deliberative part of your brain time to take over.

### Defends against

- Impulse browsing during a declared focus session.
- Habitual visits to sites on the blocklist within scheduled windows (e.g. work hours).
- Accidental clicks from autocomplete / new-tab page shortcuts (the redirect catches them).
- Soft mode lets you opt-in to lighter friction for sites where hard mode is overkill.

### Does NOT defend against — five trivial bypasses

1. **DevTools.** Open the unlock page DevTools, change `disabled` on the submit button, click it. Bypass takes 5 seconds.
2. **`chrome://extensions`.** Toggle fokus off. Or remove it entirely. Two clicks.
3. **`chrome.storage.local` edit.** DevTools → Application → Storage → flip `enabled: false` on each rule. Saves immediately, DNR re-emits with zero rules.
4. **Another browser.** Open Firefox/Safari/Edge without the extension. Visit anything.
5. **Incognito / private mode.** Unless the extension is explicitly enabled in private windows, it doesn't load.

We list these because pretending otherwise would make every other claim in this README less trustworthy. fokus is a commitment device, not a jail.

### Not a substitute for

- **Parental controls.** Use Google Family Link, Apple Screen Time, or a Pi-hole.
- **Workplace lockdown.** Use MDM (Intune, Jamf) with a managed browser policy.
- **Court-ordered abstinence software** like Covenant Eyes / Net Nanny — those operate at the OS level with active anti-tamper.
- **Android app blocking.** Use Android's built-in Digital Wellbeing / Focus Mode for native apps. fokus only blocks inside the browsers it's installed in.

---

## Data inventory

### Extension (per-browser, `chrome.storage.local`)

Single key: `fokus.config.v1` containing a `FokusConfig`:

| Field | Contents |
|---|---|
| `rules` | Array of `Rule` objects (id, pattern, type, enabled, optional schedule). |
| `hardMode` | `{ waitMinutes, requiredWords, allowMinutes, enabled }`. |
| `allowances` | `{ "youtube.com": <epoch ms> }` — temporary unblocks. |
| `telemetry` | `{ "2026-06-03": <minutes-blocked> }`. Local daily counter. |
| `session` | `{ startedAt, endsAt }` or `null`. |
| `pair` | `{ origin, code, key, pairedAt }` or `null`. **Contains the plaintext key** — anyone with read access to your chrome profile can read it. |

### PWA (`better-sqlite3` at `packages/pwa/fokus.db`, override with `FOKUS_DB`)

| Table | Columns | Purpose |
|---|---|---|
| `pairs` | `code PK, key_hash, created_at, config` | One row per pairing. Key is stored as SHA-256, not plaintext. `config` is a JSON blob updated by extension pushes. Unclaimed (`config IS NULL`) rows expire after 10 min. |
| `rate` | `ip, ts` | Per-IP rate limit for pair-create endpoint. Rows older than 1 hour are purged. |

**No accounts, no email, no analytics, no third-party data flows.** Telemetry is per-day minute counters held locally; the extension pushes the same blob to the paired PWA. There is no telemetry server.

---

## Operational

### Verifying it's working

1. After installing the extension and adding a rule (e.g. `domain: youtube.com`), start a session from the popup.
2. Visit `https://youtube.com`. You should land on the in-extension blocked page with the hard-mode prompt.
3. Try the wait countdown OR type 200+ words and submit. Confirm you're redirected to the original URL and that re-visiting within `allowMinutes` is allowed.
4. After `allowMinutes` elapses (check the minute-tick alarm), the next visit should be blocked again.

### Troubleshooting

**Rule added but site still loads.** Check: (a) is the rule enabled? (b) is a session active or does the rule carry a schedule that matches "now"? (c) is the host already in `allowances` (Application tab → `fokus.config.v1` → `allowances`)? (d) is the URL matched — `prefix` rules are strict on path.

**Extension installed but nothing happens.** Confirm `declarativeNetRequest` and `host_permissions: <all_urls>` are granted (Chrome should not have prompted — DNR is automatic). Check the service worker is alive: `chrome://extensions` → fokus → **Service Worker (inspect)**.

**Pairing fails with "expired".** Codes live 10 minutes unclaimed. Generate a fresh one.

**Pairing fails with "wrong key".** The PWA stores `SHA-256(key)`; if the key you paste doesn't hash to the stored value, the claim is rejected. Regenerate.

**PWA dashboard shows stale config.** The extension pushes config on `chrome.storage.onChanged`. If the PWA is offline at push time, the push is silently dropped. Open the dashboard and trigger a manual pull (or restart the service worker).

**Firefox extension disappeared after restart.** Temporary add-ons are unloaded on browser restart. Use AMO signing for persistence.

### Uninstalling cleanly

**Extension.**
1. `chrome://extensions` → Remove. This drops `chrome.storage.local` automatically.
2. To be thorough: DevTools on any tab → Application → Storage → confirm `fokus.config.v1` is gone.

**PWA.**
1. Stop the dev server.
2. Delete `packages/pwa/fokus.db` (or whatever `FOKUS_DB` points at).
3. If deployed, drop the SQLite volume.

---

## Deploy

### PWA → Vercel

```bash
cd packages/pwa
vercel deploy --prod
```

Set `FOKUS_DB` to a path on a persistent volume (Vercel's filesystem is ephemeral — use a Postgres or Cloudflare KV migration for prod, or self-host on Fly.io with a mounted volume).

### Extension → Chrome Web Store

Zip the contents of `packages/extension/dist/`. Upload at `chrome.google.com/webstore/devconsole`. $5 one-time developer fee. Privacy questionnaire: "Stores data locally + on a user-paired PWA. No third-party data flows." (true.)

### Extension → Firefox Add-ons

Same zip, submit at `addons.mozilla.org/developers/`. Reviewers may request source — point them at this repo. No fee.

---

## Roadmap

- **Android via Capacitor.** Wrap the PWA + add a native `AccessibilityService` to block app launches by package name (`TYPE_WINDOW_STATE_CHANGED` → `performGlobalAction(GLOBAL_ACTION_HOME)` on blocklist match). Onboarding explains the sketchy-looking accessibility-permission dialog honestly.
- **iOS:** no good story. Screen Time API is too restrictive. Probably stays "use the PWA + Screen Time" forever.
- **Settings sync across devices** via the existing pair endpoint — multi-device paired to one dashboard.
- **Better telemetry pull** so the dashboard isn't blind when extensions are offline.
- **Group blocklists / shareable presets**, and a Cloudflare KV / Postgres backend instead of SQLite for multi-region.

---

## Contributing

PRs welcome. Keep `packages/extension/src/lib/rules.ts` and `packages/pwa/src/lib/rules.ts` in sync — the header note in both files says so explicitly. Run `npm test --workspaces` before pushing. No emojis in commit messages.

---

## License

[MIT](./LICENSE) © Francisco Reyes
