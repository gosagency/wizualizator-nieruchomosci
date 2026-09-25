// Starts everything needed for "Film AI" on this computer:
//   ComfyUI (127.0.0.1:8188) → video worker (127.0.0.1:8787) → free Cloudflare tunnel (public https URL).
//
//   npm run wideo                 start and print the share link
//   npm run wideo:publikuj        also save the tunnel address in Vercel and redeploy the site
//
// Paths can be changed with COMFY_DIR and CLOUDFLARED; SITE_URL sets the public site in the printed link.

import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const SITE = process.env.SITE_URL ?? "https://wizualizator-nieruchomosci.vercel.app";
const COMFY_DIR = process.env.COMFY_DIR ?? join(homedir(), "ComfyUI", "ComfyUI_windows_portable");
const CLOUDFLARED = process.env.CLOUDFLARED ?? join(homedir(), "ComfyUI", "tools", "cloudflared.exe");
const HERE = fileURLToPath(new URL(".", import.meta.url));
const LOCAL_LINK = `http://localhost:3000/wyprobuj?serwer=${encodeURIComponent("http://127.0.0.1:8787")}`;
const publish = process.argv.includes("--publikuj");
const children = [];

function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, ...opts });
  children.push(p);
  return p;
}

async function up(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

process.on("SIGINT", () => {
  children.forEach((c) => c.kill());
  process.exit(0);
});

// 0. ComfyUI must be installed; then our node (first + last frame) and the RIFE model must be in place.
const python = join(COMFY_DIR, "python_embeded", "python.exe");
if (!existsSync(python)) throw new Error(`Nie znaleziono ComfyUI w ${COMFY_DIR} (docs/URUCHOMIENIE.md, część B, krok 1)`);
cpSync(join(HERE, "comfy_nodes"), join(COMFY_DIR, "ComfyUI", "custom_nodes", "wizualizator_nodes"), { recursive: true });
if (!existsSync(join(COMFY_DIR, "ComfyUI", "models", "frame_interpolation", "rife_v4.26.safetensors"))) {
  throw new Error("Brak modelu RIFE: pobierz rife_v4.26.safetensors do ComfyUI/models/frame_interpolation (docs/URUCHOMIENIE.md, część B, krok 3)");
}

// 1. ComfyUI
if (await up("http://127.0.0.1:8188/system_stats", 1)) {
  console.log("✓ ComfyUI już działa");
} else {
  console.log("… uruchamiam ComfyUI (ok. 30 s)");
  run(python, ["-s", join(COMFY_DIR, "ComfyUI", "main.py"), "--listen", "127.0.0.1", "--port", "8188", "--disable-auto-launch"], { cwd: COMFY_DIR });
  if (!(await up("http://127.0.0.1:8188/system_stats"))) throw new Error("ComfyUI nie wystartowało");
  console.log("✓ ComfyUI");
}

// 2. Video worker
const worker = run(process.execPath, [join(HERE, "server.mjs")]);
worker.stdout.on("data", (d) => process.stdout.write(`[wideo] ${d}`));
worker.stderr.on("data", (d) => process.stderr.write(`[wideo] ${d}`));
if (!(await up("http://127.0.0.1:8787/health", 15))) throw new Error("Serwer wideo nie wystartował");
console.log("✓ Serwer wideo");

// 3. Tunnel (no account needed; the address changes on every start). Optional for local tests.
if (!existsSync(CLOUDFLARED)) {
  console.log(`! Brak ${CLOUDFLARED}: pomijam tunel (Film AI działa tylko na tym komputerze).`);
  console.log(`\nLink lokalny (przy działającym npm run dev):\n  ${LOCAL_LINK}`);
  console.log("\nZostaw to okno otwarte. Ctrl+C zatrzymuje serwer wideo.");
} else {
  const tunnel = run(CLOUDFLARED, ["tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:8787"]);
  const tunnelUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tunel nie podał adresu w 60 s")), 60_000);
    const scan = (d) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(d));
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    };
    tunnel.stdout.on("data", scan);
    tunnel.stderr.on("data", scan);
  });
  console.log(`✓ Tunel: ${tunnelUrl}`);

  if (publish) {
    console.log("… zapisuję adres w Vercel i wdrażam stronę (ok. 2 min)");
    const deploy = spawn(process.execPath, [join(HERE, "..", "scripts", "deploy.mjs"), `--worker=${tunnelUrl}`], { stdio: "inherit" });
    await new Promise((r) => deploy.on("exit", r));
  }

  console.log("\nLink dla klienta:");
  console.log(publish ? `  ${SITE}/wyprobuj` : `  ${SITE}/wyprobuj?serwer=${encodeURIComponent(tunnelUrl)}`);
  console.log(`\nLink lokalny (przy działającym npm run dev):\n  ${LOCAL_LINK}`);
  console.log("\nZostaw to okno otwarte. Ctrl+C zatrzymuje serwer wideo i tunel.");
}
