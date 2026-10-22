# Detection calibration implementation plan

> Execute inline using superpowers:executing-plans. The user authorizes diagnosis, model changes, and AGPL-compliant source distribution.

**Goal:** Recover useful low-score visual detections and provide a smaller CPU-compatible model with reproducible evidence.

**Architecture:** Keep the existing two-pass YOLOE interface, RGB letterbox, one2many head, NMS, duplicate filtering, and review-before-apply workflow. Add fixed confidence presets at 1% and 5%, default to 5% for this experimental build. Compress stored weights only, retaining FP32 computation; keep model loading explicit for this iteration.

**Spec:** APP_SPEC.md, automatic detection section; evidence from the fixed 2026-10-22/23 local evaluation packs.

**Tech stack:** Existing single HTML builder and ONNX Runtime Web; offline Python diagnostics with pinned Ultralytics/PyTorch/ONNX.

## Constraints and review focus

- No runtime network requests, no photo publication, no automatic application of candidates.
- Preserve existing markers, Undo/redo, source invalidation and CPU support.
- Low score is not calibrated probability; extra detections require review.
- Report point containment matching as a proxy, not detection AP or audited precision.
- Native Python resizing differs from browser canvas. Keep results separate.
- Smaller on-disk weights do not imply smaller FP32 runtime memory.
- This selected development subset does not establish held-out generalization.

## Tasks

- [x] Add a regression using low-scored boxes, duplicate suppression and the default UI threshold; observe failure before changing production.
- [x] Add 1%/5% presets and explanatory Japanese/English help; retain 10%,25%,50% options. Update specification and usage docs.
- [x] Preserve export/weight-compaction source under an explicitly AGPL-licensed model-lab directory; validate types, two-pass numerical parity and counts.
- [x] Run repository checks and test the actual browser CPU path with compact weights and fixed exemplars.
- [x] Produce local comparison report, machine-readable results, model, reproducible source and release HTML. Include limitations and source/license links.

Model replacement decision: the larger 26s model did not consistently improve the same fixed samples at the same thresholds. Retain 26n; defer embeddings in HTML until runtime/memory and licensing packaging are finalized.

## Verification ledger

- Existing dedicated codex/yoloe-local-detection branch retained; no shared user edits were present.
- Low-score regression observed failing before UI change, then 31/31 detection tests passed.
- Normal build regenerated alias; required check-repository.ps1 passed (the first check correctly rejected the stale alias before regeneration).
- Portable evaluation scripts reproduced all 1,216 rows and 38 compact comparisons exactly, excluding timing measurements.
- Separate code/evidence review found no blocker. Pinned direct NumPy/Pillow/OpenCV versions, preserved checkpoint hash, and removed EOF whitespace.
- Browser recorded 14 conditions, plus self-extract CPU inference, Undo/Redo, draft restore and bilingual controls. File-URL policy blocked direct-open testing; viewport override did not apply, so no new mobile proof is claimed.
- Local report/model/source package prepared; no Pages deployment or single-HTML model embedding in this iteration.
