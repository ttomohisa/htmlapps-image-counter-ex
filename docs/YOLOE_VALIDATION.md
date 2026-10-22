# Local detection validation — 1.1.0-dev.1

Validation date: 2026-10-22. This is a local development milestone, not a published release or a detection-accuracy benchmark.

## Implemented workflow

Select a compatible local model, outline up to 20 examples on the current image, detect in a Worker, review/deselect candidates, and append ordinary schema-4 rectangle markers with one Undo. Existing points and rectangles, including hidden and other-category markers, prevent duplicate counts. Models are not saved in drafts or exports. Images remain local.

Both HTML variants embed pinned ONNX Runtime assets: 1.29.0 for CPU/WASM and 1.27.0 with its matching asyncify WASM for WebGPU. Both the editor and self-extract wrapper permit WebAssembly compilation with `wasm-unsafe-eval`; JavaScript `unsafe-eval` remains absent and `connect-src 'none'` remains enforced. The exported viewer does not need the inference runtime.

## Regenerated models

The supplied handoff archive contains `browser-yoloe-poc-v0.2.0`, newer than the separate v0.1.8 archive. That reference was extracted into ignored `.cache/yoloe-reference/` and used without adding its environment or weights to Git.

From the reference directory:

```powershell
uv sync
uv run python scripts/download_weights.py --retries 3 --timeout 60
uv run pytest
uv run python scripts/export_onnx.py --fp16
uv run python scripts/compare_onnx.py
```

The source checkpoint SHA-256 was verified as `1741c1f8da3cea47e2c01829c334a50dc0b9bbd05e685b90a3ce84fae32c8c1b`. The reference Python suite passed 8 tests. The exported FP32 model is 13,151,186 bytes (12.54 MiB), and FP16 is 6,676,041 bytes (6.37 MiB). The exports use float32 external inputs/outputs even when internal weights are FP16.

PyTorch/FP32 ONNX comparison: reference box maximum absolute difference 0.00213623, reference visual-prompt difference 1.40164e-7; target box difference 0.00219727 and target score difference 1.93715e-7. This is numeric parity on the reference fixture, not an accuracy evaluation on the user's images. The reference process log remains in the ignored reference folder as `model-preparation.log`.

## Automated checks

- `node --test scripts/test-*.cjs`: 681 tests passed.
- The 16 detection checks cover letterbox/rounding, mask union, output validity, NMS/limits, duplicate filtering, imported tiny rectangles, one-Undo application, stale owners, rotation, two-pass feeds, tensor disposal, cancellation, and enclosing CSP policies.
- `scripts/check-repository.ps1` passed, including its final brand/help checks. It runs detection and existing regression suites against the source, readable HTML, root alias, and self-extract payload; it also validates assets, network restrictions, ASCII loader, favicon, brand, and help copy.
- One independent code review found that tiny but valid imported rectangles could escape duplicate filtering. A regression test reproduced it; existing-marker validation now accepts every positive valid extent while new candidates retain the drawing minimum.
- A real-browser self-extract failure exposed a second enclosing CSP that blocked WASM. The outer-policy regression reproduced the failure before the loader policy was fixed.

## Browser checks and observations

Windows, Codex in-app Chromium browser, generated files served from loopback HTTP. Only generated HTML routes were served. Tests used the built-in sample images and local regenerated models.

| Check | Observation |
| --- | --- |
| Readable HTML, FP32 / CPU | Real two-pass inference returned 6 candidates from one red-circle example; one observed initialization was 0.4 s and detection 0.8 s. |
| Readable HTML, FP32 / GPU | Real inference succeeded; one observed initialization 3.3 s, detection 7.8 s. |
| Readable HTML, FP16 / GPU | Real inference succeeded; one observed initialization 2.1 s, detection 6.9 s. |
| Self-extract HTML, FP32 / CPU | After the enclosing-CSP fix, real inference succeeded on restored sample 1 (4 candidates, all duplicates). On sample 2, two examples produced 14 candidates; deselecting one changed the preview to 13, and applying added exactly 13 markers. One observed setup was 0.5 s, detection 2.1 s. |
| Apply / Undo / Redo | Applying 6 candidates changed count to 6; one Undo returned 0; Redo restored 6. |
| Repeat detection | All 6 existing overlaps were excluded and Apply stayed disabled. |
| Cancel | Cancellation returned control without modifying counts. |
| Persistence | Reload and Continue restored 2 images and 6 rectangle markers. |
| CSV ZIP | A user-entered filename was honored; ZIP contained `markers.csv` and `summary.csv`, with 6 rectangles, original logical dimensions 1200×760, `needsReview=false`, and total 6. |
| Empty / malformed model | Empty selection was rejected; malformed model produced a recoverable message and left Detect available. |
| Manual recovery | After malformed-model failure, closing the dialog, switching to the empty sample image and clicking in Point mode added one marker; Undo restored zero. |
| Self-extract history | One Undo removed the whole 13-marker batch; Redo restored all 13. |
| JA / EN | Both detection interfaces were inspected. |
| Narrow layout | 390×844 screenshot inspected; at 320×720 document width was 320 and dialog client/scroll width both 306, with no horizontal overflow. |

Timings are single observations, include implementation/runtime overhead, and do not establish a CPU/GPU performance ranking. Six candidates on a sample containing other circles demonstrate the workflow, not exhaustive counting accuracy. Real photographs need their own acceptance dataset and false-positive/missed-object review.

![Self-extract build, two examples, one candidate excluded](../assets/auto-detection.jpg)

## Sizes and remaining release gates

Readable HTML is approximately 12.46 MiB; self-extract is approximately 12.39 MiB, excluding selected models. Embedded runtime assets occupy 9.16 MiB compressed versus 36.62 MiB original. The existing 12 MiB self-extract warning budget is exceeded by about 0.39 MiB; the budget was not raised to hide the warning. Exact sizes are regenerated in `dist/build-size-report.json`.

The browser tool rejects `file://` navigation. No alternate route was used to bypass that restriction, so direct-file execution remains unverified. Actual Android/iOS devices, Firefox/Safari, low-memory devices, model load peak memory, and representative MAE/precision/recall have not been validated. The 320/390 px tests are viewport checks, not mobile hardware checks.

Before public distribution, review model/source redistribution and application licensing together. Selecting a model separately is not a licensing conclusion. See `THIRD_PARTY_NOTICES.md`. Model embedding, cross-image prompting, tiling/high-resolution detection, and a release-ready model installer remain outside this milestone.
