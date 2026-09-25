// Video worker: the public web app sends a room photo, this machine's GPU turns it
// into a short camera-move clip with Wan 2.2 (open source) via local ComfyUI.
// Only this small API is exposed through the tunnel; ComfyUI itself stays on 127.0.0.1.
//
//   node video-worker/server.mjs          (ComfyUI must be running on :8188)

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { connectProgress, fileUrl, progress, promptResult, queueInfo, queuePrompt, uploadImage, COMFY } from "./comfy.mjs";
import { shotFor } from "./prompts.mjs";
import { buildWorkflow } from "./workflow.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? "https://wizualizator-nieruchomosci.vercel.app,http://localhost:3000,http://localhost:3010,http://localhost:4000")
  .split(",")
  .map((s) => s.trim());
const MAX_BODY = 8 * 1024 * 1024;
const MAX_PENDING = 6;
const MAX_PER_CLIENT = 3;
const FRAMES = Number(process.env.FRAMES ?? 49);
const STEPS = Number(process.env.STEPS ?? 20);

/** @type {Map<string, {id: string, promptId: string, client: string, room: string, format: string, createdAt: number, file?: object, error?: string}>} */
const jobs = new Map();

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
  }
  return !origin || ALLOWED.includes(origin);
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Zdjęcie jest za duże (max 8 MB)."), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function clientKey(req) {
  return String(req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "local").split(",")[0].trim();
}

async function jobStatus(job) {
  if (job.file) return { status: "done" };
  if (job.error) return { status: "error", error: job.error };
  const r = await promptResult(job.promptId);
  if (r.done) {
    if (r.error) job.error = r.error;
    else job.file = r.file;
    return r.error ? { status: "error", error: r.error } : { status: "done" };
  }
  const q = await queueInfo();
  if (q.running.includes(job.promptId)) {
    const p = progress.get(job.promptId);
    return { status: "running", progress: p && p.max ? Math.min(0.95, (p.value / p.max) * 0.9) : 0.02 };
  }
  const pos = q.pending.indexOf(job.promptId);
  return { status: "queued", position: pos >= 0 ? pos + 1 + q.running.length : undefined };
}

const server = createServer(async (req, res) => {
  const allowed = cors(req, res);
  if (req.method === "OPTIONS") return res.writeHead(allowed ? 204 : 403).end();
  if (!allowed) return json(res, 403, { error: "origin not allowed" });
  const url = new URL(req.url ?? "/", "http://worker");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const q = await queueInfo().catch(() => null);
      return json(res, q ? 200 : 503, { ok: !!q, queue: q ? q.running.length + q.pending.length : null, frames: FRAMES });
    }

    if (req.method === "POST" && url.pathname === "/jobs") {
      const client = clientKey(req);
      const active = [...jobs.values()].filter((j) => !j.file && !j.error);
      if (active.length >= MAX_PENDING) return json(res, 429, { error: "Kolejka jest pełna, spróbuj za kilka minut." });
      if (active.filter((j) => j.client === client).length >= MAX_PER_CLIENT) return json(res, 429, { error: "Masz już 3 filmy w kolejce." });

      const body = await readJson(req);
      const format = body.format === "9:16" ? "9:16" : "16:9";
      const room = String(body.room ?? "Pokój").slice(0, 40);
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(body.image ?? ""));
      if (!m) return json(res, 400, { error: "Brak zdjęcia (JPEG, PNG lub WebP)." });
      const bytes = Buffer.from(m[2], "base64");

      const id = randomUUID();
      const name = await uploadImage(bytes, `web-${id}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
      const promptId = await queuePrompt(
        buildWorkflow({ image: name, ...shotFor(room), format, frames: FRAMES, steps: STEPS, prefix: `wizualizator/${id}` }),
      );
      jobs.set(id, { id, promptId, client, room, format, createdAt: Date.now() });
      console.log(new Date().toISOString(), "job", id, room, format, "from", client);
      return json(res, 202, { id });
    }

    const jobMatch = /^\/jobs\/([0-9a-f-]{36})(\/video)?$/.exec(url.pathname);
    if (req.method === "GET" && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) return json(res, 404, { error: "Nie ma takiego zadania." });
      if (!jobMatch[2]) return json(res, 200, await jobStatus(job));
      if (!job.file) return json(res, 409, { error: "Film nie jest jeszcze gotowy." });
      const upstream = await fetch(fileUrl(job.file));
      res.writeHead(200, { "content-type": "video/mp4", "cache-control": "private, max-age=3600" });
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e);
    json(res, e.status ?? 500, { error: e.status ? e.message : "Błąd serwera wideo." });
  }
});

// Forget jobs after 6 hours.
setInterval(() => {
  const cutoff = Date.now() - 6 * 3600_000;
  for (const [id, j] of jobs) if (j.createdAt < cutoff) jobs.delete(id);
}, 600_000).unref();

connectProgress();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Serwer wideo: http://127.0.0.1:${PORT} (ComfyUI: ${COMFY}), ${FRAMES} klatek, ${STEPS} kroków`);
  console.log(`Dozwolone strony: ${ALLOWED.join(", ")}`);
});
