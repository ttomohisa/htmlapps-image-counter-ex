# Mobile review and scoped detection implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship smartphone review presentation, filtered-list detection and per-photo detection regions to GitHub Pages.

**Architecture:** Extend the existing inline application and batch runner. Store only normalized optional regions; presentation/filter state remains transient. Shared result filtering preserves outside markers and the existing model inputs.

**Tech Stack:** Native HTML/CSS/JavaScript, Node production-bound tests, PowerShell single-HTML build.

**Spec:** `docs/superpowers/specs/2026-10-26-scoped-detection-design.md`

## Global constraints

- Single self-contained readable and self-extract HTML; no runtime network; unchanged embedded model/dependencies/CSP; JA/EN and 320/390px usability.
- All data edits must have correct history/autosave, stale-owner/cancellation guards; old schema-4 projects remain supported.
- Never edit generated HTML manually. User authorized implementation and deployment; no additional approval gate is required.

## Review focus

- Replacing results in a restricted region preserves eligible results outside it (Task 1 test).
- Zero-result detection still needs review and filtered batches do not shrink as status changes (Tasks 1/2 tests).
- Pinned source differs from target and target rotation/compressed dimensions differ from encoded image (Task 1 tests).
- Hidden mobile opener after resize/dialog close retains reachable focus; Edit reveals normal controls (Task 2 tests/browser).
- A cancelled region gesture or changed source cannot commit geometry/history (Task 1 tests).

### Task 1: Per-photo detection region

**Files:** `src/index.template.html`, `scripts/test-detection-region.cjs`, affected existing extraction fixtures only as necessary.

**Interfaces:** optional `image.detectionRegion:{x,y,w,h}` normalized to original image; pure `detectionRegionContains(region,box)`; shared filtering for dialog/quick commit. Region dialog accessible from `#detectionRegionOpen` near main detection controls; emit a target-region summary.

- [x] Add failing production-bound tests for valid/invalid/imported bounds, region center filtering, Replace preservation, save/cancel/Undo, stale pointers and rotated geometry.
- [x] Implement explicit region editor, strict persistence validation, shared filtering and scoped replacement, then run feature/affected tests.
- [x] Review task implementation for scope, geometry and owner correctness before integration.

### Task 2: Filtered run and mobile review layout

**Files:** `src/index.template.html`, `scripts/test-scoped-review.cjs`, `scripts/check-repository.ps1`.

**Interfaces:** `#quickFiltered`, `startQuickDetection('filtered')` (preserve boolean current/all compatibility), `matchingPhotos()` snapshot; mobile transient disclosure with explicit Show settings/photos toggle and filtered previous/next + existing review completion actions.

- [x] Add failing tests for immutable target list, empty list guards, full-project all behavior, Stop/Undo and disclosure lifecycle.
- [x] Add labelled dynamic action, snapshot its targets, preserve ownership and batch runtime reuse.
- [x] Add mobile-only review presentation and reachable controls without copying data mutation logic; keep desktop unchanged and Show settings/photos discoverable.
- [x] Run focused tests and inspect desktop/mobile JA/EN behavior with real UI.

### Task 3: Release integration

**Files:** `app.config.json`, `APP_SPEC.md`, README files, `CHANGELOG.md`, architecture/Android/validation docs, generated release alias, screenshot.

- [x] Set version 1.1.0-dev.14; synchronize docs/help with final behavior.
- [x] Independent whole-change review; resolve material findings.
- [x] Build and run `scripts/check-repository.ps1`; record exact result and sizes.
- [x] Verify actual browser flows, export/restore, embedded-model detection and representative screenshots; disclose unverified device/file checks.
Release continuation: commit, integrate to main, push, wait for Pages workflow and verify the deployed version. Publication status is recorded by the Pages workflow and final task report.
