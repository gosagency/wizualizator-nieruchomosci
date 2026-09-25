"""Wizualizator nieruchomości: first + last frame conditioning for Wan 2.2 TI2V-5B.

Wan22ImageToVideoLatent only pins the first frame. This node also pins the last
latent frame to an end image (e.g. a zoomed-in crop of the same photo), so the
generated clip must end on the real room: objects cannot vanish by the end.
"""

import torch
import comfy.latent_formats
import comfy.model_management
import comfy.utils
import nodes


def _fit(image, width, height):
    return comfy.utils.common_upscale(image.movedim(-1, 1), width, height, "bilinear", "center").movedim(1, -1)


class Wan22FirstLastLatent:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vae": ("VAE",),
                "width": ("INT", {"default": 1280, "min": 32, "max": nodes.MAX_RESOLUTION, "step": 32}),
                "height": ("INT", {"default": 704, "min": 32, "max": nodes.MAX_RESOLUTION, "step": 32}),
                "length": ("INT", {"default": 49, "min": 5, "max": nodes.MAX_RESOLUTION, "step": 4}),
                "start_image": ("IMAGE",),
            },
            "optional": {
                "end_image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "execute"
    CATEGORY = "model/conditioning/wan"

    def execute(self, vae, width, height, length, start_image, end_image=None):
        device = comfy.model_management.intermediate_device()
        frames = ((length - 1) // 4) + 1
        latent = torch.zeros([1, 48, frames, height // 16, width // 16], device=device)
        mask = torch.ones([1, 1, frames, height // 16, width // 16], device=device)

        start = vae.encode(_fit(start_image[:1], width, height))
        latent[:, :, :1] = start[:, :, :1]
        mask[:, :, :1] = 0.0

        if end_image is not None:
            # The causal VAE encodes frame 0 alone and then groups of 4 frames.
            # Encode 5 copies of the end image and keep the second latent frame,
            # which represents 4 identical end frames: a clean last latent frame.
            end = _fit(end_image[:1], width, height).repeat(5, 1, 1, 1)
            end_latent = vae.encode(end)
            latent[:, :, -1:] = end_latent[:, :, 1:2]
            mask[:, :, -1:] = 0.0

        latent_format = comfy.latent_formats.Wan22()
        latent = latent_format.process_out(latent) * mask + latent * (1.0 - mask)
        return ({"samples": latent, "noise_mask": mask},)


class ZoomCrop:
    """Center crop by a zoom factor, scaled back to the original size (a digital push-in end frame)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "zoom": ("FLOAT", {"default": 1.18, "min": 1.0, "max": 2.0, "step": 0.01}),
                "offset_x": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
                "offset_y": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "execute"
    CATEGORY = "image/transform"

    def execute(self, image, zoom, offset_x, offset_y):
        _, h, w, _ = image.shape
        cw, ch = int(round(w / zoom)), int(round(h / zoom))
        x = int(round((w - cw) / 2 * (1 + offset_x)))
        y = int(round((h - ch) / 2 * (1 + offset_y)))
        crop = image[:, y:y + ch, x:x + cw, :]
        return (comfy.utils.common_upscale(crop.movedim(-1, 1), w, h, "lanczos", "disabled").movedim(1, -1),)


NODE_CLASS_MAPPINGS = {"Wan22FirstLastLatent": Wan22FirstLastLatent, "ZoomCrop": ZoomCrop}
NODE_DISPLAY_NAME_MAPPINGS = {"Wan22FirstLastLatent": "Wan 2.2 First+Last Frame Latent", "ZoomCrop": "Zoom Crop (push-in)"}
