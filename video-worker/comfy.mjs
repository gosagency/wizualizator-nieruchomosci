// Minimal ComfyUI client: upload image, queue prompt, follow progress, fetch the video.

export const COMFY = process.env.COMFY_URL ?? "http://127.0.0.1:8188";
const CLIENT_ID = `wizualizator-${process.pid}`;

/** step progress per prompt id, fed by the ComfyUI websocket */
export const progress = new Map();

export function connectProgress() {
  const ws = new WebSocket(`${COMFY.replace(/^http/, "ws")}/ws?clientId=${CLIENT_ID}`);
  ws.addEventListener("message", (e) => {
    if (typeof e.data !== "string") return;
    const msg = JSON.parse(e.data);
    if (msg.type === "progress" && msg.data?.prompt_id) {
      progress.set(msg.data.prompt_id, { value: msg.data.value, max: msg.data.max, node: msg.data.node });
    }
  });
  ws.addEventListener("close", () => setTimeout(connectProgress, 2000));
  ws.addEventListener("error", () => ws.close());
}

export async function uploadImage(bytes, name) {
  const form = new FormData();
  form.append("image", new Blob([bytes], { type: "image/jpeg" }), name);
  form.append("overwrite", "true");
  const res = await fetch(`${COMFY}/upload/image`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()).name;
}

export async function queuePrompt(prompt) {
  const res = await fetch(`${COMFY}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, client_id: CLIENT_ID }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`queue failed: ${JSON.stringify(body.error ?? body.node_errors ?? body)}`);
  return body.prompt_id;
}

/** Returns { done, error, file } for a prompt id. */
export async function promptResult(promptId) {
  const res = await fetch(`${COMFY}/history/${promptId}`);
  const hist = (await res.json())[promptId];
  if (!hist) return { done: false };
  if (hist.status?.status_str === "error") {
    const err = hist.status.messages?.find((m) => m[0] === "execution_error")?.[1];
    return { done: true, error: err?.exception_message ?? "generation failed" };
  }
  for (const out of Object.values(hist.outputs ?? {})) {
    for (const list of Object.values(out)) {
      if (!Array.isArray(list)) continue;
      const file = list.find((f) => f && typeof f.filename === "string" && /\.(mp4|webm|mkv)$/i.test(f.filename));
      if (file) return { done: true, file };
    }
  }
  return { done: hist.status?.completed === true, error: hist.status?.completed ? "no video in output" : undefined };
}

export async function queueInfo() {
  const res = await fetch(`${COMFY}/queue`);
  const q = await res.json();
  return { running: q.queue_running?.map((x) => x[1]) ?? [], pending: q.queue_pending?.map((x) => x[1]) ?? [] };
}

export function fileUrl(file) {
  const p = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? "", type: file.type ?? "output" });
  return `${COMFY}/view?${p}`;
}
