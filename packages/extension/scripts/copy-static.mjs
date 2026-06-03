// Copy manifest.json + HTML files into dist/ after Vite build.
import { copyFile, mkdir, readdir, stat, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist");
const src = join(root, "src");

if (!existsSync(dist)) await mkdir(dist, { recursive: true });

// Copy manifest as-is.
await copyFile(join(root, "manifest.json"), join(dist, "manifest.json"));

// Copy HTML, rewriting <script src="./xxx.ts"> → "./xxx.js".
const htmlFiles = ["options.html", "popup.html", "blocked.html"];
for (const file of htmlFiles) {
  const inPath = join(src, file);
  if (!existsSync(inPath)) continue;
  let html = await readFile(inPath, "utf8");
  html = html.replace(/\.ts(["'])/g, ".js$1");
  await writeFile(join(dist, file), html, "utf8");
}

console.log("[copy-static] manifest + HTML copied to dist/");
