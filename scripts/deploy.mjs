// Deploys the last commit to Vercel production (public link).
//   node scripts/deploy.mjs                      deploy
//   node scripts/deploy.mjs --worker=https://…   also set the "Film AI" video server address
// Needs: `vercel login` done once, and .vercel/project.json in the project folder.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const worker = process.argv.find((a) => a.startsWith("--worker="))?.slice("--worker=".length);
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: opts.input ? ["pipe", "inherit", "inherit"] : "inherit", shell: true, ...opts });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} ${args.join(" ")} → exit ${r.status}`);
  return r;
};

if (!existsSync(join(root, ".vercel", "project.json"))) throw new Error("Brak .vercel/project.json (powiązanie z projektem Vercel).");
const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout.trim();
if (dirty) console.warn("Uwaga: niezapisane zmiany nie trafią na stronę (wdrażany jest ostatni commit).");

const base = join(tmpdir(), "wizualizator-deploy");
const stage = join(base, "wizualizator-nieruchomosci");
rmSync(base, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
sh("git", ["archive", "--format=tar", "-o", `"${join(base, "src.tar")}"`, "HEAD"], { cwd: root });
// Windows: use the system bsdtar; Git Bash's GNU tar reads "C:" as a remote host.
const tar = process.platform === "win32" ? `"${join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")}"` : "tar";
sh(tar, ["-xf", `"${join(base, "src.tar")}"`, "-C", `"${stage}"`]);
for (const p of [".claude", ".agents", "skills-lock.json", "scripts", "video-worker"]) rmSync(join(stage, p), { recursive: true, force: true });
cpSync(join(root, ".vercel"), join(stage, ".vercel"), { recursive: true });

if (worker) {
  sh("vercel", ["env", "rm", "NEXT_PUBLIC_VIDEO_WORKER_URL", "production", "--yes"], { cwd: stage, allowFail: true });
  sh("vercel", ["env", "add", "NEXT_PUBLIC_VIDEO_WORKER_URL", "production"], { cwd: stage, input: `${worker}\n` });
}
sh("vercel", ["deploy", "--prod", "--yes"], { cwd: stage });
