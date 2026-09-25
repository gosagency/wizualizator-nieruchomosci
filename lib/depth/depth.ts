"use client";

/**
 * Monocular depth estimation in the browser, no server and no paid service:
 * Depth Anything V2 Small (Apache-2.0, https://github.com/DepthAnything/Depth-Anything-V2)
 * run with transformers.js (Apache-2.0, https://github.com/huggingface/transformers.js).
 * The photo never leaves the device; only the model weights are downloaded (once, then cached).
 */

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";
const MODEL_ID = "onnx-community/depth-anything-v2-small";
/** Longest side of the photo we work with (texture and depth). */
const MAX_SIDE = 1280;
/** Depth grid resolution along the longest side (mesh vertices). */
const GRID = 220;

export type ModelProgress = { phase: "download" | "ready"; progress: number; backend?: "webgpu" | "wasm" };

export type PhotoDepth = {
  /** downscaled photo used as the texture */
  image: HTMLCanvasElement;
  width: number;
  height: number;
  /** disparity grid, 0 = far, 1 = near, row-major from the top-left */
  grid: Float32Array;
  gridW: number;
  gridH: number;
  /** greyscale depth preview */
  depthPreview: HTMLCanvasElement;
};

type DepthPipeline = (input: string) => Promise<{ depth: { width: number; height: number; channels: number; data: Uint8Array | Uint8ClampedArray } }>;

let pipelinePromise: Promise<DepthPipeline> | null = null;
let backend: "webgpu" | "wasm" = "wasm";

// Loaded from the CDN at runtime so the bundler never touches the WASM/WebGPU runtime.
const importFromUrl = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!gpu && !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

/** Downloads (first time) and initialises the depth model. Safe to call many times. */
export function loadDepthModel(onProgress?: (p: ModelProgress) => void): Promise<DepthPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const tf = (await importFromUrl(TRANSFORMERS_URL)) as {
        pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<DepthPipeline>;
        env: { allowLocalModels: boolean };
      };
      tf.env.allowLocalModels = false;
      backend = (await hasWebGPU()) ? "webgpu" : "wasm";
      const files = new Map<string, { loaded: number; total: number }>();
      const report = (e: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (e.status === "progress" && e.file && e.total) {
          files.set(e.file, { loaded: e.loaded ?? 0, total: e.total });
          const all = [...files.values()];
          const total = all.reduce((s, f) => s + f.total, 0);
          const loaded = all.reduce((s, f) => s + f.loaded, 0);
          onProgress?.({ phase: "download", progress: total ? loaded / total : 0, backend });
        }
      };
      const create = (device: "webgpu" | "wasm") =>
        tf.pipeline("depth-estimation", MODEL_ID, {
          device,
          dtype: device === "webgpu" ? "fp16" : "q8",
          progress_callback: report,
        });
      let pipe: DepthPipeline;
      try {
        pipe = await create(backend);
      } catch (e) {
        if (backend === "wasm") throw e;
        backend = "wasm";
        pipe = await create("wasm");
      }
      onProgress?.({ phase: "ready", progress: 1, backend });
      return pipe;
    })().catch((e) => {
      pipelinePromise = null;
      throw e;
    });
  } else {
    pipelinePromise.then(() => onProgress?.({ phase: "ready", progress: 1, backend })).catch(() => undefined);
  }
  return pipelinePromise;
}

function downscale(bmp: ImageBitmap): HTMLCanvasElement {
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

/** Estimates depth for one photo and returns a smoothed disparity grid for meshing. */
export async function estimateDepth(photo: Blob, onProgress?: (p: ModelProgress) => void): Promise<PhotoDepth> {
  const pipe = await loadDepthModel(onProgress);
  const bmp = await createImageBitmap(photo, { imageOrientation: "from-image" });
  const image = downscale(bmp);
  bmp.close();

  const blob = await new Promise<Blob>((res, rej) => image.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92));
  const url = URL.createObjectURL(blob);
  let depth;
  try {
    ({ depth } = await pipe(url));
  } finally {
    URL.revokeObjectURL(url);
  }

  // Depth map → greyscale canvas at photo size (the model output may be smaller).
  const raw = document.createElement("canvas");
  raw.width = depth.width;
  raw.height = depth.height;
  const rg = raw.getContext("2d")!;
  const id = rg.createImageData(depth.width, depth.height);
  for (let i = 0, n = depth.width * depth.height; i < n; i++) {
    const v = depth.data[i * depth.channels];
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  rg.putImageData(id, 0, 0);

  const aspect = image.width / image.height;
  const gridW = aspect >= 1 ? GRID : Math.round(GRID * aspect);
  const gridH = aspect >= 1 ? Math.round(GRID / aspect) : GRID;
  // Sample through a slight blur: softer depth edges mean less stretching when the camera moves.
  const small = document.createElement("canvas");
  small.width = gridW;
  small.height = gridH;
  const sg = small.getContext("2d")!;
  sg.filter = "blur(1.2px)";
  sg.drawImage(raw, 0, 0, gridW, gridH);
  const px = sg.getImageData(0, 0, gridW, gridH).data;
  const grid = new Float32Array(gridW * gridH);
  let min = 1;
  let max = 0;
  for (let i = 0; i < grid.length; i++) {
    const v = px[i * 4] / 255;
    grid[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(1e-3, max - min);
  for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - min) / span;

  const depthPreview = document.createElement("canvas");
  depthPreview.width = image.width;
  depthPreview.height = image.height;
  depthPreview.getContext("2d")!.drawImage(raw, 0, 0, image.width, image.height);

  return { image, width: image.width, height: image.height, grid, gridW, gridH, depthPreview };
}

export function depthBackend() {
  return backend;
}
