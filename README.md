# fokus

A hybrid focus-mode website blocker. Browser extension (Chrome / Edge / Firefox) + installable PWA dashboard. The two pair via a 6-letter code — no account.

The differentiator: **hard mode**. Once you've blocked a site, unblocking it mid-session means typing a 200-word reflection, or waiting 5 minutes. Not a one-click off switch.

## Threat model

> fokus is a self-discipline tool, not a security boundary. A determined user with developer tools can disable the extension, edit `chrome.storage.local`, uninstall the extension, or just use another browser. We make it just inconvenient enough that you'll catch yourself before you act on impulse.

If you need actual lockdown (kids, employees, court-ordered abstinence), you want OS-level parental controls or DNS-level filtering — not a browser extension.

## What you get

- **Browser extension (Manifest V3)** for Chromium and Gecko browsers. Blocks websites via `declarativeNetRequest` redirect rules pointing to an in-extension page. Redirect, not interception, so it's invisible to the network layer of the page.
- **PWA dashboard** — Next.js App Router app you can install on your phone or desktop home screen. Edits the same blocklist, schedules, and hard-mode settings. Pair with one or more extensions via a 6-letter code.
- **Android (planned)**: install the PWA + use Android's built-in **Focus Mode** / **Digital Wellbeing** to block apps. A Capacitor wrapper is on the roadmap — see "Roadmap" below.

## Repository layout

```
fokus/
├── packages/
│   ├── extension/   Manifest V3 extension (Vite build → dist/)
│   └── pwa/         Next.js dashboard + pairing API
├── package.json     workspaces root
└── tsconfig.base.json
```

## Develop locally

```bash
# from the repo root
npm install

# build the extension
npm --workspace @fokus/extension run build
# → packages/extension/dist/ contains manifest.json, background.js, …

# start the PWA
npm --workspace @fokus/pwa run dev
# → http://localhost:3000

# run all tests
npm test --workspaces
```

### Load the extension in Chrome / Edge

1. Build it: `npm --workspace @fokus/extension run build`.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked**.
5. Pick the `packages/extension/dist/` folder.

The extension's icon will appear in your toolbar. Click it for the popup. Right-click → Options for the full settings page.

### Load in Firefox

1. Build it.
2. Visit `about:debugging#/runtime/this-firefox`.
3. **Load Temporary Add-on…**
4. Pick `packages/extension/dist/manifest.json`.

Firefox unloads temporary add-ons on restart. For permanent installation while developing, use Firefox Developer Edition or sign the add-on through Mozilla's process.

### Pair extension with PWA

1. Run the PWA: `npm --workspace @fokus/pwa run dev`.
2. Open `http://localhost:3000`, click **Generate pair code**. You'll see a 6-letter code and a base64 key.
3. In the extension's options page, paste your PWA origin (`http://localhost:3000`) and the code. When prompted, paste the key.
4. The extension downloads the dashboard's config and starts pushing telemetry.

The pair record lives 10 minutes in unpaired state. Once claimed, it persists until you delete it. The key is hashed with SHA-256 on the server; only the extension holds the plaintext key.

## URL matching

Rules have three types:

| type     | example                  | matches                                                                  |
|----------|--------------------------|--------------------------------------------------------------------------|
| `domain` | `youtube.com`            | `youtube.com`, `www.youtube.com`, `m.youtube.com`. **Not** `youtu.be?ref=youtube.com`. |
| `domain` | `*.youtube.com`          | Subdomains only — `m.youtube.com`. **Not** `youtube.com` itself.         |
| `prefix` | `reddit.com/r/programming` | `reddit.com/r/programming/…` only.                                     |
| `regex`  | `^https://news\.ycombinator\.com/?$` | Full URL regex; anchor it yourself.                          |

The matching algorithm lives in `packages/extension/src/lib/rules.ts` (canonical) and is copy-mirrored to `packages/pwa/src/lib/rules.ts` so the dashboard can preview matches in the future. There is a note at the top of both files to keep them in sync.

## Hard mode

When a request to a blocked site is redirected to the in-extension `blocked.html` page, the user sees two options:

1. **Wait it out** — start a countdown (default 5 minutes). When it hits zero, the host gets a temporary allowance and you're redirected to the original URL.
2. **Write to unblock** — a textarea. Once you've typed ≥ 200 words, the submit button enables and grants the same allowance.

You can lower both numbers in the options page, or disable hard mode entirely (soft mode — popup gets a one-click off switch).

Allowances default to 10 minutes per host, then expire on the next minute-tick of the background service worker. The DNR rules update accordingly.

## Roadmap

- **Android via Capacitor**: wrap the PWA in a Capacitor shell, plus a custom **AccessibilityService** to block app launches by package name. The diff is roughly:
  - `capacitor.config.json` pointing `webDir` at `packages/pwa/out` (after `next export`)
  - Native Android module exposing a JS bridge: `blockApp(pkgName)` / `unblockApp(pkgName)`
  - AccessibilityService listening for `TYPE_WINDOW_STATE_CHANGED`, comparing the foreground package against the blocklist, and calling `performGlobalAction(GLOBAL_ACTION_HOME)` if matched.
  - Onboarding flow asking the user to grant the accessibility permission (Android forces a sketchy-looking dialog; explain it honestly in-app).
- iOS: no good story. Screen Time API is too restrictive. Probably stays "use the PWA + Screen Time" forever.
- Sync via Cloudflare KV / fly.io Postgres instead of better-sqlite3 for multi-device dashboards.
- Group blocklists / shareable presets.

## Publishing

### Chrome Web Store

Bundle the contents of `packages/extension/dist/` into a zip. Upload at `chrome.google.com/webstore/devconsole`. You'll need a $5 developer fee and to fill out the privacy questionnaire (this extension stores everything locally + on the user's paired PWA — no third-party data flows).

### Firefox Add-ons

Same zip. Submit at `addons.mozilla.org/developers/`. Their reviewers may ask for the source code; this repo is the source. No fee.

## License

MIT. Francisco Reyes.
