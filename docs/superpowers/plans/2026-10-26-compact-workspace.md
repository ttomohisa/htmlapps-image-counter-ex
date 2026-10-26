# Compact Workspace Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans task-by-task.

**Goal:** Deliver a compact desktop/mobile photo workspace, shorter Help, and a sourced answer about alternative models.
**Architecture:** Reorganize existing DOM controls into one bounded nonmodal inspector and retain the original data/inference handlers. Add only transient panel state. Integrate the prepared bilingual Help fragment while preserving protected sections.
**Tech Stack:** Native HTML/CSS/JavaScript, Node production-bound tests, PowerShell single-HTML builds.
**Spec:** `docs/superpowers/specs/2026-10-26-compact-workspace-design.md`

## Global constraints

- Offline single HTML in readable and self-extract variants; no model/dependency/CSP/schema changes.
- Japanese and English; desktop 1360×900 and mobile 390×844 / 320×740; preserve license/source/build content exactly.
- Keep current/list/all detection scopes, all saved data, history, cancellation and stale ownership protections.

## Review focus

- A layout transition during an unfinished marker edit cancels it before geometry transforms change.
- Hidden inspector controls never trap focus after resize or closing a native dialog; don't steal unrelated focus.
- Inference progress and Stop stay outside inert workspace roots.
- Existing photo navigation/filtering and zero-result review remain reachable in the compact shell.
- All old control IDs remain unique and live; visible sample/reference controls and schema data remain intact.

### Task 1: Compact workspace

**Files:** source template outside protected Help/license/build blocks; new `scripts/test-workspace-shell.cjs`; affected existing layout/UI fixture tests only.
**Interfaces:** preserve existing handlers and public IDs wherever practical. New `renderWorkspaceShell()` and panel open/close functions may be called from existing render hooks; transient project-owned state must not serialize. Retain a compatible visible-focus fallback used by quick completion/dismissal.

- [ ] Write failing production-bound state/gesture/focus regression tests, then implement the canvas-first shell in the spec.
- [ ] Replace old conflicting compact-review CSS/controller behavior intentionally, adapting only tests whose UI contract changed while retaining semantic assertions.
- [ ] Run affected suites, inspect source diff, record report for a scoped review. Parent owns actual browser layout verification and final matrix.

### Task 2: Help and release documentation

**Files:** source APP:HELP/i18n only after Task 1 releases source ownership; app config, README files, APP_SPEC, CHANGELOG, architecture and UI validation docs.
**Interfaces:** prepared `.cache/dev15-help-proposal.json`, preserving exact license/source and build sections. Version 1.1.0-dev.15.

- [ ] Integrate three-step/four-caution Help with collapsed tips. Verify preserved hashes and existing help checks.
- [ ] Register shell tests in four-artifact matrix; synchronize docs with actual final controls.

### Task 3: Verify and publish

- [ ] Build both variants and inspect real desktop/mobile JA/EN layouts with the existing steel-photo work file.
- [ ] Test normal counting/review, panels, keyboard/focus, resize, real detection, Help scrolling, save and reload. Record concrete viewport measurements and screenshots.
- [ ] Independent whole-change review; repair material findings with focused regressions.
- [ ] Final build and required repository checks, then commit/integrate/push and verify Pages version. Reuse existing publication workflow and disclose unverified device/file behavior.

Model research runs independently using official sources. Report actual current export size separately from official checkpoint sizes; distinguish visual examples from fixed-class detection and segmentation, and code licenses from weights licenses.
