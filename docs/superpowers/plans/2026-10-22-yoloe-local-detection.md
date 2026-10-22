# Local Visual Detection Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. The user requested continuous progress after approving the in-chat design.

**Goal:** Deliver a local-model detection workflow integrated with ordinary Image Counter markers.
**Architecture:** Dedicated dialog and per-job Worker. Pure geometry helpers and atomic marker application stay in the existing template; pinned runtime assets use the existing builder.
**Tech Stack:** Browser JS, Canvas, module Workers, ONNX Runtime Web 1.29.0 WASM / 1.27.0 WebGPU, PowerShell, Node test runner.
**Spec:** ../specs/2026-10-22-yoloe-local-detection-design.md

## Global Constraints

- Two self-contained HTML builds; file://; connect-src 'none'; no image uploads.
- Existing schema 4 and original-image normalized geometry; minimum rectangle extent 0.003.
- Local model <=256 MiB; at most 1000 preview candidates with truncation indication.
- JA/EN, keyboard alternative to drawing, 320px layout, one Undo per applied batch.

## Review Focus

- Compressed drafts have logical dimensions different from decoded pixels: normalized geometry stays correct.
- Inference results arrive after cancel, image/project replacement, model change: no stale commit.
- Repeated apply and hidden/different-category existing markers: no double counting.
- Rotated portrait image and reversed drags: boxes align and stay inside bounds.
- A malformed model/output or Worker crash: actionable error, released resources, manual workflow usable.

### Task 1: Geometry and atomic marker application

**Files:** src/index.template.html; scripts/test-auto-detection.cjs.
**Interfaces:** autoLetterbox(width,height), autoPromptMask(boxes,transform), autoCandidates(boxes,scores,transform,threshold), autoFilter(candidates,markers), applyAutoCandidates(owner,candidates,categoryId).

- [x] Write behavioral tests using hand-computed letterbox coordinates, mask union, invalid outputs, rotated normalized roundtrips, duplicate points/rectangles and zero-result application.
- [x] Run node --test scripts/test-auto-detection.cjs; confirm missing-feature failure.
- [x] Implement pure helpers and one-history marker append using the existing state APIs.
- [x] Run new tests plus existing scripts/test-*.cjs suites; confirm Undo/Redo and completion restoration.

### Task 2: Worker and dialog integration

**Files:** src/index.template.html; dependencies.json; scripts/test-auto-detection.cjs.
**Interfaces:** consumes Task 1 helpers; produces autoDetectWorker(), startAutoDetection(), cancelAutoDetection(), renderAutoPreview(), openAutoDetection().

- [x] Add tests for generation ownership, model/Worker failure and cancellation; verify failures before implementation.
- [x] Implement dedicated Worker using embedded runtime URLs, wasmBinary, two-pass prompt extraction and detection; validate model I/O and dispose tensors.
- [x] Add localized dialog, multiple examples, threshold/compute controls, candidate exclusions, keyboard input and explicit apply. Connect image-switch and close invalidation.
- [x] Build runtime assets and run real FP32/WASM detection with regenerated model; test WebGPU if available, without weakening CSP.

### Task 3: Release checks and documentation

**Files:** APP_SPEC.md; README.md; README.ja.md; CHANGELOG.md; SECURITY.md; THIRD_PARTY_NOTICES.md; docs/ARCHITECTURE.md; scripts/check-repository.ps1; generated image-counter.html.

- [x] Include detection suite in four-variant repository check; update product metadata for EX while preserving schema app identity.
- [x] Update documentation/help with actual workflow, local-model limitation, ownership/cancel behavior and deferred redistribution decisions.
- [x] Build then run powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./scripts/check-repository.ps1; expect exit 0.
- [x] Verify real browser loopback-HTTP standard/self-extract, desktop/mobile-width, JA/EN, cancel, empty/broken model, marker workflow and output. Record sizes/timing and file-origin/device gaps honestly.
- [x] Request one independent code review, address material findings, rerun affected checks and keep changes on the feature branch for user review.
