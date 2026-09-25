// ComfyUI API workflow: Wan 2.2 TI2V-5B (Apache-2.0) image-to-video, quality mode.
// - native resolution (1280×704 / 704×1280)
// - first AND last frame pinned to crops of the real photo (custom node Wan22FirstLastLatent)
// - RIFE frame interpolation ×2 for smooth 24 fps
// Runs locally on the owner's GPU. No paid service.

export const MODELS = {
  unet: "Wan2.2-TI2V-5B-Q6_K.gguf",
  textEncoder: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
  vae: "wan2.2_vae.safetensors",
  interpolation: "rife_v4.26.safetensors",
};

export const SIZES = {
  "16:9": { width: 1280, height: 704 },
  "9:16": { width: 704, height: 1280 },
};

export const NEGATIVE =
  "people, person, text, watermark, logo, subtitles, blurry, low quality, disappearing objects, objects melting, missing furniture, " +
  "distorted walls, warped furniture, bent lines, flicker, jitter, shaky camera, fast motion, morphing, deformed, extra objects, cartoon, painting";

/**
 * @param {{ image: string, prompt: string, format: "16:9" | "9:16", start: {zoom: number, x?: number, y?: number}, end: {zoom: number, x?: number, y?: number}, frames?: number, steps?: number, seed?: number, prefix: string }} o
 */
export function buildWorkflow({ image, prompt, format, start, end, frames = 49, steps = 20, seed = Math.floor(Math.random() * 2 ** 31), prefix }) {
  const { width, height } = SIZES[format];
  const crop = (c) => ({ class_type: "ZoomCrop", inputs: { image: ["41", 0], zoom: c.zoom, offset_x: c.x ?? 0, offset_y: c.y ?? 0 } });
  return {
    1: { class_type: "UnetLoaderGGUF", inputs: { unet_name: MODELS.unet } },
    2: { class_type: "CLIPLoader", inputs: { clip_name: MODELS.textEncoder, type: "wan", device: "default" } },
    3: { class_type: "VAELoader", inputs: { vae_name: MODELS.vae } },
    4: { class_type: "LoadImage", inputs: { image } },
    // Fit the photo to the output frame first, then take the start/end crops from it.
    41: { class_type: "ImageScale", inputs: { image: ["4", 0], upscale_method: "lanczos", width, height, crop: "center" } },
    42: crop(start),
    43: crop(end),
    5: { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
    6: { class_type: "CLIPTextEncode", inputs: { text: NEGATIVE, clip: ["2", 0] } },
    7: { class_type: "Wan22FirstLastLatent", inputs: { vae: ["3", 0], width, height, length: frames, start_image: ["42", 0], end_image: ["43", 0] } },
    8: { class_type: "ModelSamplingSD3", inputs: { model: ["1", 0], shift: 8 } },
    9: {
      class_type: "KSampler",
      inputs: { model: ["8", 0], seed, steps, cfg: 5, sampler_name: "uni_pc", scheduler: "simple", positive: ["5", 0], negative: ["6", 0], latent_image: ["7", 0], denoise: 1 },
    },
    // Tiled decode keeps VRAM use low on 8 GB cards.
    10: { class_type: "VAEDecodeTiled", inputs: { samples: ["9", 0], vae: ["3", 0], tile_size: 512, overlap: 64, temporal_size: 32, temporal_overlap: 8 } },
    13: { class_type: "FrameInterpolationModelLoader", inputs: { model_name: MODELS.interpolation } },
    14: { class_type: "FrameInterpolate", inputs: { interp_model: ["13", 0], images: ["10", 0], multiplier: 2 } },
    11: { class_type: "CreateVideo", inputs: { images: ["14", 0], fps: 24 } },
    12: { class_type: "SaveVideo", inputs: { video: ["11", 0], filename_prefix: prefix, format: "auto", "format.codec": "h264" } },
  };
}
