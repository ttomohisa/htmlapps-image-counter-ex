# Photo Review and Safe Reruns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make photo progress clear, complete review and advance in one action, and rerun detection without deleting protected work.

**Architecture:** Keep the existing single-template runtime and captured quick-run ownership. Add optional schema-4 review metadata, derive photo status from saved data, and commit each valid detection result atomically within one run-wide history transaction. Reuse existing review, history, persistence and bilingual UI paths.

**Tech Stack:** Browser-native JavaScript, HTML/CSS, Canvas, IndexedDB, embedded YOLOE/ONNX Runtime, Node test runner, PowerShell build.

**Spec:** `APP_SPEC.md`, especially “Photo status, review completion and safe reruns (1.1.0-dev.10)”. Implementation and Pages publication are already authorized; this plan records that scope.

## Global Constraints

- Keep schema version 4 and the existing storage identity.
- The main-screen `quickMode` control defaults to **Append**.
- Replace only the captured category's `autoPending === true && needsReview === true` markers.
- Dependencies, model assets, offline behavior and one-file distribution are unchanged.
- Generate `dist/index.html`, `dist/index.self-extract.html` and `image-counter.html` from source; never edit generated HTML manually.
- Keep `connect-src 'none'`, Japanese/English controls and 320/390 px mobile layouts.

## Review Focus

- Zero/duplicate-only output still requires review and restores through Undo: Task 1.
- Old/manual/edited/other-type markers survive replacement and cancelled edits retain eligibility: Task 1.
- Malformed/truncated/cancelled output never erases the active photo's prior results: Task 1.
- Empty legacy photos stay Undetected; review completion wraps and stays on the final photo: Task 2.
- Pending zero-result checks survive draft/viewer round trips and block ordinary completion: Tasks 1 and 3.

---

### Task 1: Persist review metadata and commit safe reruns

**Files:**
- Modify: `src/index.template.html` (`normalizeProject`, lightweight history, marker edits, `QUICK:CORE`, `QUICK:RUNNER`).
- Modify: `scripts/test-quick-detection.cjs`, `scripts/test-counting-workflow.cjs`, `scripts/test-import-csv-safety.cjs`.
- Create: `scripts/test-photo-workflow.cjs`.

**Interfaces:**
- `image.detectionChecks?: Array<{categoryId: string, detectedAt: number, reviewed: boolean}>`, unique by category; `marker.autoPending?: boolean` is explicit replacement provenance.
- `quickCommitResult(run, image, candidates)` consumes captured `run.mode` (`append` or `replace`) and valid normalized candidates; its result exposes `added`, `removed` and `duplicates` counts.
- `quickProcessImages(run): Promise<void>` commits sequentially, retains earlier photos after Stop and rejects stale ownership before each commit.

- [x] Add failing handler tests: replacement preserves manual/legacy/reviewed/edited/other-type markers; valid zero and duplicate-only results set `reviewed:false`; malformed/truncated/cancelled results preserve the photo; one Undo restores every changed photo and its metadata. Cover eligibility removal on committed moves/resizes/type/review changes and retention on cancelled pointer edits.
- [x] Run `node --test scripts/test-quick-detection.cjs scripts/test-counting-workflow.cjs scripts/test-import-csv-safety.cjs scripts/test-photo-workflow.cjs`; confirm failures identify the new behavior.
- [x] Implement metadata validation/copying and atomic quick commits in the source template. Validate complete output before removal, filter against retained markers, tag only new quick results, and remove checks when their category is deleted. Preserve optional fields through drafts/viewer export and reject invalid imported checks.
- [x] Run the same focused command; require zero failures, including round trips, one history entry, stale ownership and cancellation.
- [x] Review the scoped data/transaction diff; include it in the cohesive release commit after verification.

### Task 2: Show photo status and complete review with navigation

**Files:**
- Modify: `src/index.template.html` (translations, Help, thumbnail/summary/current-photo renderers, review handlers, main-screen quick controls).
- Modify: `scripts/test-photo-workflow.cjs`.

**Interfaces:**
- `photoStatus(image): 'undetected' | 'working' | 'review' | 'complete'` consumes Task 1 metadata with review → completion → existing work → undetected priority.
- `imageReviewCount(image): number` continues counting flagged markers only.
- `markImageReviewed(): void` clears flags/provenance and reviews checks without changing completion.
- `reviewAndNext(): Promise<void>` reviews and completes the current photo in one history entry, then selects the next incomplete photo with wraparound; no remaining photo produces the existing all-complete announcement.
- `#quickMode` supplies the captured append/replace selection; status and action controls use translated text and accessible labels.

- [x] Add failing assertions for all status priorities, untouched legacy photos, pending zero-result completion blocking, review-only, wraparound/skipping current/completed photos, final-photo no navigation, inference guards and no-op redo preservation.
- [x] Run `node --test scripts/test-photo-workflow.cjs`; confirm the new assertions fail before implementing the UI/data handlers.
- [x] Implement the status helpers and review actions; render thumbnail/current status with marker review count and per-status summary totals. Add Append/Replace controls and explain that older-version results are protected. Update Japanese/English Help in the same source change.
- [x] Run `node --test scripts/test-photo-workflow.cjs scripts/test-quick-detection.cjs`; require zero failures and inspect the reachable controls at desktop, 390 px and 320 px.
- [x] Review the UI with its regression coverage; include it in the same release commit.

### Task 3: Verify artifacts, document evidence and publish Pages

**Files:**
- Modify: `app.config.json`, `scripts/check-repository.ps1`, `APP_SPEC.md`, `README.md`, `README.ja.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/QUICK_DETECTION_VALIDATION.md`.
- Regenerate: `dist/` outputs and `image-counter.html` using the existing builder.

**Interfaces:**
- Release metadata uses `1.1.0-dev.10`; the aggregate check includes the photo-workflow suite for all existing artifact variants.
- Documentation records observed test results and deployment evidence separately from unperformed device/file-origin checks.

- [x] Set the release version, register the new suite in the aggregate matrix, and synchronize behavior/help/documentation without changing model/runtime dependencies.
- [x] Run `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./build-standalone.ps1`, then `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./scripts/check-repository.ps1`; require exit 0, zero test failures, byte parity, embedded asset integrity and synchronized alias.
- [x] Exercise both generated variants in a browser: mixed photo statuses, zero/duplicate-only review, Append/Replace, review completion/last photo, Stop and Undo/Redo. Check Japanese/English keyboard controls and narrow layouts; save/reload a draft and export/re-import a viewer using an edited filename. Record console/network observations and explicitly identify unperformed direct-file/Android checks.
- [x] Replace the dev.10 validation placeholder with exact observed results, review the final diff and commit the regenerated outputs and documentation.
- [ ] Publish the authorized branch changes through the repository's Pages workflow, wait for successful deployment and verify the served version. Report the live URL, verification results and remaining untested environments.
