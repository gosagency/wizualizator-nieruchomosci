// Benchmark one image-to-video generation: node video-worker/bench.mjs <photo.jpg> <room> [format] [frames] [steps]
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { connectProgress, fileUrl, progress, promptResult, queuePrompt, uploadImage } from "./comfy.mjs";
import { shotFor } from "./prompts.mjs";
import { buildWorkflow } from "./workflow.mjs";

const [photo, room = "Salon", format = "16:9", frames = "49", steps = "20"] = process.argv.slice(2);
if (!photo) throw new Error("usage: node bench.mjs <photo.jpg> <room> [format] [frames] [steps]");

connectProgress();
const t0 = Date.now();
const name = await uploadImage(await readFile(photo), `bench-${basename(photo)}`);
const shot = shotFor(room);
console.log("prompt:", shot.prompt);
const id = await queuePrompt(buildWorkflow({ image: name, ...shot, format, frames: Number(frames), steps: Number(steps), prefix: "wizualizator/bench" }));
console.log("queued", id);

let last = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const r = await promptResult(id);
  if (r.done) {
    if (r.error) throw new Error(r.error);
    const out = photo.replace(/\.\w+$/, `-${format.replace(":", "x")}-${frames}f.mp4`);
    await writeFile(out, Buffer.from(await (await fetch(fileUrl(r.file))).arrayBuffer()));
    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
    break;
  }
  const p = progress.get(id);
  const line = p ? `step ${p.value}/${p.max} (${((Date.now() - t0) / 1000).toFixed(0)} s)` : `waiting (${((Date.now() - t0) / 1000).toFixed(0)} s)`;
  if (line.split(" (")[0] !== last) console.log(line);
  last = line.split(" (")[0];
}
process.exit(0);
