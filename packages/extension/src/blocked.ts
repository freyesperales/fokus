/**
 * Blocked page logic. Two unlock paths: wait timer or word-count reflection.
 * On success: messages background to grant a temporary allowance, then navigates to the
 * original URL (passed via document.referrer or the ?target= query).
 */
import { loadConfig } from "./lib/storage.js";

const params = new URLSearchParams(location.search);
const targetUrl = params.get("target") ?? document.referrer;
let targetHost = "";
try {
  targetHost = new URL(targetUrl).hostname;
} catch {
  // Fallback: maybe the user opened blocked.html directly.
}
(document.getElementById("where") as HTMLElement).textContent = targetHost
  ? `Site: ${targetHost}`
  : "";

const cfgPromise = loadConfig();

async function grantAndGo(host: string, minutes: number): Promise<void> {
  await chrome.runtime.sendMessage({ kind: "grant-allowance", host, minutes });
  // Small delay to let DNR rules update.
  await new Promise((r) => setTimeout(r, 200));
  if (targetUrl) location.href = targetUrl;
  else history.back();
}

// --- Wait path ---
const waitMinEl = document.getElementById("wait-min") as HTMLSpanElement;
const waitStartBtn = document.getElementById("wait-start") as HTMLButtonElement;
const waitTimerEl = document.getElementById("wait-timer") as HTMLDivElement;
const waitDisplay = document.getElementById("wait-display") as HTMLDivElement;
const waitCancelBtn = document.getElementById("wait-cancel") as HTMLButtonElement;

let waitInterval: number | null = null;

async function initWait(): Promise<void> {
  const cfg = await cfgPromise;
  waitMinEl.textContent = String(cfg.hardMode.waitMinutes);

  waitStartBtn.addEventListener("click", () => {
    const totalMs = cfg.hardMode.waitMinutes * 60_000;
    const endsAt = Date.now() + totalMs;
    waitStartBtn.hidden = true;
    waitTimerEl.hidden = false;

    const tick = (): void => {
      const remain = Math.max(0, endsAt - Date.now());
      const min = Math.floor(remain / 60_000);
      const sec = Math.floor((remain % 60_000) / 1000);
      waitDisplay.textContent = `${min}:${String(sec).padStart(2, "0")}`;
      if (remain <= 0) {
        if (waitInterval !== null) clearInterval(waitInterval);
        void grantAndGo(targetHost, cfg.hardMode.allowMinutes);
      }
    };
    tick();
    waitInterval = window.setInterval(tick, 250);
  });

  waitCancelBtn.addEventListener("click", () => {
    if (waitInterval !== null) clearInterval(waitInterval);
    waitTimerEl.hidden = true;
    waitStartBtn.hidden = false;
  });
}

// --- Write path ---
const writeText = document.getElementById("write-text") as HTMLTextAreaElement;
const writeCount = document.getElementById("write-count") as HTMLSpanElement;
const writeNeed = document.getElementById("write-need") as HTMLSpanElement;
const writeTarget = document.getElementById("write-target") as HTMLSpanElement;
const writeSubmit = document.getElementById("write-submit") as HTMLButtonElement;

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

async function initWrite(): Promise<void> {
  const cfg = await cfgPromise;
  const need = cfg.hardMode.requiredWords;
  writeNeed.textContent = String(need);
  writeTarget.textContent = String(need);

  writeText.addEventListener("input", () => {
    const n = countWords(writeText.value);
    writeCount.textContent = String(n);
    writeSubmit.disabled = n < need;
  });

  writeSubmit.addEventListener("click", async () => {
    writeSubmit.disabled = true;
    writeSubmit.textContent = "Unblocking…";
    await grantAndGo(targetHost, cfg.hardMode.allowMinutes);
  });
}

void initWait();
void initWrite();
