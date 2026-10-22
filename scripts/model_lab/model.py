# SPDX-License-Identifier: AGPL-3.0-only
# Adapted from the supplied browser-yoloe-poc-v0.2.0 visual-prompt wrapper.
# Uses Ultralytics YOLOE (https://github.com/ultralytics/ultralytics).
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torch import nn


IMG_SIZE = 640
PROMPT_SIZE = IMG_SIZE // 8
EMBED_DIM = 512
STRIDES = (8, 16, 32)
FEATURE_SIZES = tuple(IMG_SIZE // s for s in STRIDES)
NUM_ANCHORS = sum(s * s for s in FEATURE_SIZES)


@dataclass(frozen=True)
class LetterboxMeta:
    source_width: int
    source_height: int
    scale: float
    pad_x: int
    pad_y: int
    target_size: int = IMG_SIZE

    def source_box_to_model(self, box: Iterable[float]) -> tuple[float, float, float, float]:
        x1, y1, x2, y2 = (float(v) for v in box)
        return (
            x1 * self.scale + self.pad_x,
            y1 * self.scale + self.pad_y,
            x2 * self.scale + self.pad_x,
            y2 * self.scale + self.pad_y,
        )

    def model_box_to_source(self, box: Iterable[float]) -> tuple[float, float, float, float]:
        x1, y1, x2, y2 = (float(v) for v in box)
        x1 = (x1 - self.pad_x) / self.scale
        y1 = (y1 - self.pad_y) / self.scale
        x2 = (x2 - self.pad_x) / self.scale
        y2 = (y2 - self.pad_y) / self.scale
        return (
            max(0.0, min(float(self.source_width), x1)),
            max(0.0, min(float(self.source_height), y1)),
            max(0.0, min(float(self.source_width), x2)),
            max(0.0, min(float(self.source_height), y2)),
        )


def letterbox_image(image: Image.Image, size: int = IMG_SIZE) -> tuple[np.ndarray, LetterboxMeta]:
    """Letterbox a PIL image exactly once and return CHW float32 input in [0, 1]."""
    image = image.convert("RGB")
    src_w, src_h = image.size
    scale = min(size / src_w, size / src_h)
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))

    resized = image.resize((new_w, new_h), Image.Resampling.BILINEAR)
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    pad_x = (size - new_w) // 2
    pad_y = (size - new_h) // 2
    canvas.paste(resized, (pad_x, pad_y))

    arr = np.asarray(canvas, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))[None, ...]
    meta = LetterboxMeta(src_w, src_h, scale, pad_x, pad_y, size)
    return np.ascontiguousarray(arr), meta


def prompt_mask_from_boxes(
    boxes_model_xyxy: Iterable[Iterable[float]],
    prompt_size: int = PROMPT_SIZE,
    image_size: int = IMG_SIZE,
) -> np.ndarray:
    """Rasterize one or more same-class model-space boxes into a [1,1,H,W] visual prompt mask."""
    mask = np.zeros((1, 1, prompt_size, prompt_size), dtype=np.float32)
    scale = prompt_size / image_size
    for box in boxes_model_xyxy:
        x1, y1, x2, y2 = (float(v) for v in box)
        x1, x2 = sorted((x1, x2))
        y1, y2 = sorted((y1, y2))
        # Match Ultralytics LoadVisualPrompt.make_mask exactly:
        # integer grid coordinate r is selected when r >= x1/8 and r < x2/8.
        ix1 = max(0, min(prompt_size, int(np.ceil(x1 * scale))))
        iy1 = max(0, min(prompt_size, int(np.ceil(y1 * scale))))
        ix2 = max(0, min(prompt_size, int(np.ceil(x2 * scale))))
        iy2 = max(0, min(prompt_size, int(np.ceil(y2 * scale))))
        if ix2 > ix1 and iy2 > iy1:
            mask[0, 0, iy1:iy2, ix1:ix2] = 1.0
    if not mask.any():
        raise ValueError("Visual prompt mask is empty. Draw at least one non-empty box.")
    return mask


def nms_xyxy(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float = 0.45) -> list[int]:
    """Single-class NMS for xyxy boxes."""
    if len(boxes) == 0:
        return []
    order = np.argsort(scores)[::-1]
    x1, y1, x2, y2 = boxes.T
    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
    keep: list[int] = []
    while order.size:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(x1[i], x1[rest])
        yy1 = np.maximum(y1[i], y1[rest])
        xx2 = np.minimum(x2[i], x2[rest])
        yy2 = np.minimum(y2[i], y2[rest])
        inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
        union = areas[i] + areas[rest] - inter
        iou = np.divide(inter, union, out=np.zeros_like(inter), where=union > 0)
        order = rest[iou <= iou_threshold]
    return keep


class MatMulBNContrastiveHead(nn.Module):
    """ONNX-friendly equivalent of Ultralytics BNContrastiveHead without Einsum."""

    def __init__(self, source: nn.Module):
        super().__init__()
        self.norm = source.norm
        self.logit_scale = source.logit_scale
        self.bias = source.bias

    def forward(self, x: torch.Tensor, w: torch.Tensor) -> torch.Tensor:
        x = self.norm(x)
        w = F.normalize(w, dim=-1, p=2)
        b, c, h, width = x.shape
        x = x.reshape(b, c, h * width)
        score = torch.matmul(w, x).reshape(b, w.shape[1], h, width)
        return score * self.logit_scale.exp() + self.bias


class BrowserYOLOE(nn.Module):
    """Static-shape browser export wrapper for single-class YOLOE visual prompting.

    Inputs:
      image:  [1, 3, 640, 640], RGB float32 in [0, 1], letterboxed
      vp_mask:[1, 1, 80, 80], visual prompt mask for the current image
      prompt: [1, 1, 512], previously generated VPE (dummy zeros when registering a reference)

    Outputs:
      vpe:    [1, 1, 512]
      boxes:  [1, 8400, 4], xyxy in 640x640 letterbox coordinates
      scores: [1, 8400], sigmoid confidence for the single visual-prompt class
    """

    def __init__(self, core_model: nn.Module, image_size: int = IMG_SIZE):
        super().__init__()
        if image_size != IMG_SIZE:
            raise ValueError(f"PoC currently requires image_size={IMG_SIZE}.")

        self.layers = core_model.model[:-1]
        self.save = set(core_model.save)
        source_head = core_model.model[-1]

        if getattr(source_head, "embed", None) != EMBED_DIM:
            raise ValueError(f"Expected YOLOE embed={EMBED_DIM}, got {getattr(source_head, 'embed', None)}")
        if getattr(source_head, "reg_max", None) != 1:
            raise ValueError(f"Expected YOLOE-26 reg_max=1, got {getattr(source_head, 'reg_max', None)}")
        if len(getattr(source_head, "f", [])) != 3:
            raise ValueError("Expected a 3-level YOLOE detection head.")

        # Register only the runtime-prompt path. This intentionally drops the segmentation branch,
        # YOLO26 one-to-one/end-to-end branch, text reprta path, and other unused modules.
        self.head_f = tuple(int(i) for i in source_head.f)
        self.savpe = source_head.savpe
        self.box_heads = source_head.cv2
        self.cls_heads = source_head.cv3
        self.contrastive_heads = nn.ModuleList(MatMulBNContrastiveHead(m) for m in source_head.cv4)

        anchors, strides = self._build_anchors()
        self.register_buffer("anchor_points", anchors, persistent=False)
        self.register_buffer("anchor_strides", strides, persistent=False)

    @staticmethod
    def _build_anchors() -> tuple[torch.Tensor, torch.Tensor]:
        points: list[torch.Tensor] = []
        stride_values: list[torch.Tensor] = []
        for feature_size, stride in zip(FEATURE_SIZES, STRIDES):
            y, x = torch.meshgrid(
                torch.arange(feature_size, dtype=torch.float32) + 0.5,
                torch.arange(feature_size, dtype=torch.float32) + 0.5,
                indexing="ij",
            )
            points.append(torch.stack((x.reshape(-1), y.reshape(-1)), dim=0))
            stride_values.append(torch.full((1, feature_size * feature_size), float(stride)))
        return torch.cat(points, dim=1).unsqueeze(0), torch.cat(stride_values, dim=1).unsqueeze(0)

    def _features(self, image: torch.Tensor) -> list[torch.Tensor]:
        x: torch.Tensor | list[torch.Tensor] = image
        y: list[torch.Tensor | None] = []
        for m in self.layers:
            if m.f != -1:
                if isinstance(m.f, int):
                    x = y[m.f]
                else:
                    x = [x if j == -1 else y[j] for j in m.f]
            x = m(x)
            y.append(x if m.i in self.save else None)

        features: list[torch.Tensor] = []
        for j in self.head_f:
            feat = x if j == -1 else y[j]
            if feat is None or not isinstance(feat, torch.Tensor):
                raise RuntimeError(f"Missing feature map for head source layer {j}.")
            features.append(feat)
        return features

    def _decode_xyxy(self, raw_boxes: torch.Tensor) -> torch.Tensor:
        # YOLOE-26 reg_max=1: raw boxes are left/top/right/bottom distances in feature-grid units.
        lt = raw_boxes[:, 0:2, :]
        rb = raw_boxes[:, 2:4, :]
        anchors = self.anchor_points.to(dtype=raw_boxes.dtype, device=raw_boxes.device)
        strides = self.anchor_strides.to(dtype=raw_boxes.dtype, device=raw_boxes.device)
        xy1 = (anchors - lt) * strides
        xy2 = (anchors + rb) * strides
        return torch.cat((xy1, xy2), dim=1).transpose(1, 2)

    def forward(
        self,
        image: torch.Tensor,
        vp_mask: torch.Tensor,
        prompt: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        features = self._features(image)
        vpe = self.savpe(features, vp_mask)
        batch = features[0].shape[0]
        raw_boxes = torch.cat([self.box_heads[i](features[i]).reshape(batch, 4, -1) for i in range(3)], dim=-1)
        raw_scores = torch.cat(
            [
                self.contrastive_heads[i](self.cls_heads[i](features[i]), prompt).reshape(batch, 1, -1)
                for i in range(3)
            ],
            dim=-1,
        )
        boxes = self._decode_xyxy(raw_boxes)
        scores = raw_scores.sigmoid()[:, 0, :]
        return vpe, boxes, scores


def load_yoloe26n_detection(weights: str | Path = "yoloe-26n-seg.pt") -> nn.Module:
    """Build the detection-only YOLOE-26n graph and load released segmentation weights into matching layers."""
    from ultralytics import YOLOE

    yolo = YOLOE("yoloe-26n.yaml")
    yolo.load(str(weights))
    core = yolo.model
    core.eval()
    return core
