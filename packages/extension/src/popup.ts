import { loadConfig } from "./lib/storage.js";

const statusEl = document.getElementById("status") as HTMLDivElement;
const startBtn = document.getElementById("start") as HTMLButtonElement;
const start25Btn = document.getElementById("start-25") as HTMLButtonElement;
const start50Btn = document.getElementById("start-50") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;
const optionsLink = document.getElementById("open-options") as HTMLAnchorElement;

async function refresh(): Promise<void> {
  const cfg = await loadConfig();
  if (cfg.session) {
    statusEl.className = "status on";
    const ends = cfg.session.endsAt;
    if (ends) {
      const minLeft = Math.max(0, Math.ceil((ends - Date.now()) / 60_000));
      statusEl.textContent = `Focusing. ${minLeft} min left.`;
    } else {
      statusEl.textContent = "Focusing.";
    }
    startBtn.hidden = true;
    start25Btn.hidden = true;
    start50Btn.hidden = true;
    stopBtn.hidden = false;
  } else {
    statusEl.className = "status";
    const activeRules = cfg.rules.filter((r) => r.enabled).length;
    statusEl.textContent = `Off. ${activeRules} rule${activeRules === 1 ? "" : "s"} ready.`;
    startBtn.hidden = false;
    start25Btn.hidden = false;
    start50Btn.hidden = false;
    stopBtn.hidden = true;
  }
}

async function send(msg: unknown): Promise<void> {
  await chrome.runtime.sendMessage(msg);
  await refresh();
}

startBtn.addEventListener("click", () => send({ kind: "start-session" }));
start25Btn.addEventListener("click", () => send({ kind: "start-session", minutes: 25 }));
start50Btn.addEventListener("click", () => send({ kind: "start-session", minutes: 50 }));
stopBtn.addEventListener("click", () => send({ kind: "stop-session" }));
optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

void refresh();
