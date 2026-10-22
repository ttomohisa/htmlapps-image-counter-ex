# Image Counter EX: local visual detection, first integration

The user approved the first-stage design and continuous implementation on 2026-10-22. Goal: select one or several examples in the current photo, preview similar objects, then explicitly add them as ordinary rectangle markers in one undoable operation. Existing manual counting, schema-4 drafts, viewer imports/exports and CSV remain compatible.

## Interaction

A canvas-adjacent Auto detect button opens a dedicated dialog with a rotated image preview. Drag rectangles or use keyboard-accessible numeric percentage bounds to register examples; examples never change counts. Clear/remove examples and rerun detection. The first integration uses the current image; prompt reuse across images and tiled detection are deferred. Review candidate boxes and exclude individual false positives before applying. Show accepted, excluded and duplicate counts, and the destination type. A selectable local model is explicitly a development-stage workflow.

## Runtime and ownership

Embed pinned ORT JS/WASM assets through dependencies.json. Load the chosen local ONNX only upon detection. Run initialization, preprocessing and two-pass prompt/detection in a dedicated module Worker, using transferred image bitmap and model bytes, embedded module Blob URLs and wasmBinary. Use a separate Worker per job so cancel, model changes, source changes or closing the dialog terminate old execution. Keep token, project object, image id/data and model ownership; validate them again on message and apply. No image upload or runtime networking. Preserve connect-src 'none', add wasm-unsafe-eval specifically for WASM compilation.

Support FP32/WASM as the baseline, and user-selected WebGPU with a fresh Worker for a manual retry in WASM. FP16 is WebGPU-only. Never silently claim model precision or detection accuracy. Validate the exported model's names/shapes and finite output. Bound model file size to 256 MiB and preview candidates to 1000 with a visible truncation notice. Release worker, URLs and bitmap on completion/cancel/error; do not persist model or candidate state in project data.

## Geometry and application

Inference uses browser-decoded unadjusted image pixels; brightness/contrast are display-only. Keep normalized original-image geometry and reuse toDisplayNorm/fromDisplayNorm for rotated previews. Letterbox at 640 with RGB 114 padding and half-to-even rounding; construct OR-union 80x80 prompt mask and extract 512-dimensional VPE. Convert xyxy output back to normalized original geometry, clip bounds, reject nonfinite, degenerate or sub-0.003 rectangles. Score threshold defaults to 0.25, NMS IoU to 0.5. Match existing rectangles by IoU >= 0.5 or intersection/smaller-area >= 0.8; points inside a candidate exclude it. Apply across all existing types to avoid double-counting, disclose this in UI. Recalculate duplicate filtering at apply time, including among selected candidates. One pushHistory, append ordinary schema-4 rectangles with needsReview:false, mark incomplete, touch and renderAll. Zero valid results make no history or completion changes.

## Verification and distribution

Test independent geometry examples, mask union, malformed output, duplicate/idempotent application, Undo/Redo and completion, cancellation/stale results, missing/invalid models and small screens. Run existing repository checks across source/readable/alias/self-extract, plus real local-browser checks for both release variants. Regenerate reference FP32/FP16 via uv at user request; keep binaries in ignored local cache. Report actual results and untested environments. Model embedding, redistribution/license decision and public release are a later milestone; this change must not claim blanket MIT coverage for externally supplied weights.
