import { loadConfig, updateConfig } from "./lib/storage.js";
import type { Rule, RuleType } from "./lib/rules.js";
import { pairWith } from "./lib/sync.js";

const tbody = document.querySelector<HTMLTableSectionElement>("#rules-table tbody")!;
const patternInput = document.getElementById("new-pattern") as HTMLInputElement;
const typeSelect = document.getElementById("new-type") as HTMLSelectElement;
const addBtn = document.getElementById("add-rule") as HTMLButtonElement;

const hmWait = document.getElementById("hm-wait") as HTMLInputElement;
const hmWords = document.getElementById("hm-words") as HTMLInputElement;
const hmAllow = document.getElementById("hm-allow") as HTMLInputElement;
const hmEnabled = document.getElementById("hm-enabled") as HTMLInputElement;
const saveHm = document.getElementById("save-hm") as HTMLButtonElement;

const pairOrigin = document.getElementById("pair-origin") as HTMLInputElement;
const pairCode = document.getElementById("pair-code") as HTMLInputElement;
const pairGo = document.getElementById("pair-go") as HTMLButtonElement;
const pairStatus = document.getElementById("pair-status") as HTMLParagraphElement;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function renderRules(rules: Rule[]): void {
  tbody.innerHTML = "";
  for (const r of rules) {
    const tr = document.createElement("tr");

    const tdPattern = document.createElement("td");
    tdPattern.textContent = r.pattern;
    tr.appendChild(tdPattern);

    const tdType = document.createElement("td");
    tdType.textContent = r.type;
    tr.appendChild(tdType);

    const tdOn = document.createElement("td");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = r.enabled;
    toggle.addEventListener("change", async () => {
      await updateConfig((c) => {
        const x = c.rules.find((q) => q.id === r.id);
        if (x) x.enabled = toggle.checked;
      });
    });
    tdOn.appendChild(toggle);
    tr.appendChild(tdOn);

    const tdDel = document.createElement("td");
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "ghost";
    del.addEventListener("click", async () => {
      await updateConfig((c) => {
        c.rules = c.rules.filter((q) => q.id !== r.id);
      });
      await render();
    });
    tdDel.appendChild(del);
    tr.appendChild(tdDel);

    tbody.appendChild(tr);
  }
}

async function render(): Promise<void> {
  const cfg = await loadConfig();
  renderRules(cfg.rules);
  hmWait.value = String(cfg.hardMode.waitMinutes);
  hmWords.value = String(cfg.hardMode.requiredWords);
  hmAllow.value = String(cfg.hardMode.allowMinutes);
  hmEnabled.checked = cfg.hardMode.enabled;

  if (cfg.pair) {
    pairStatus.textContent = `Paired with ${cfg.pair.origin} (code ${cfg.pair.code}).`;
  } else {
    pairStatus.textContent = "Not paired.";
  }
}

addBtn.addEventListener("click", async () => {
  const pattern = patternInput.value.trim();
  if (!pattern) return;
  const type = typeSelect.value as RuleType;
  await updateConfig((c) => {
    c.rules.push({ id: uid(), pattern, type, enabled: true });
  });
  patternInput.value = "";
  await render();
});

saveHm.addEventListener("click", async () => {
  await updateConfig((c) => {
    c.hardMode = {
      waitMinutes: Math.max(1, Number(hmWait.value) || 5),
      requiredWords: Math.max(50, Number(hmWords.value) || 200),
      allowMinutes: Math.max(1, Number(hmAllow.value) || 10),
      enabled: hmEnabled.checked,
    };
  });
  await render();
  saveHm.textContent = "Saved ✓";
  setTimeout(() => (saveHm.textContent = "Save"), 1200);
});

pairGo.addEventListener("click", async () => {
  const origin = pairOrigin.value.trim().replace(/\/$/, "");
  const code = pairCode.value.trim().toUpperCase();
  if (!origin || code.length !== 6) {
    pairStatus.textContent = "Need an origin and a 6-letter code.";
    return;
  }
  pairStatus.textContent = "Pairing…";
  try {
    // The user obtained {code, key} from the PWA. We assume the key was shown next to the code.
    // For simplicity we ask the user for the key via prompt:
    const key = window.prompt("Paste the pairing key shown next to the code:") ?? "";
    if (!key) {
      pairStatus.textContent = "Pairing cancelled.";
      return;
    }
    await pairWith(origin, code, key);
    pairStatus.textContent = `Paired with ${origin}.`;
    await render();
  } catch (e) {
    pairStatus.textContent = `Pair failed: ${e instanceof Error ? e.message : String(e)}`;
  }
});

void render();
