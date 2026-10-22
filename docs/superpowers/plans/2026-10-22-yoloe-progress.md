# Progress — 2026-10-22-yoloe-local-detection.md

- Base: f53ba75e16d868b344b1024fd2c4e64c9dbfec7e; dedicated clone, branch codex/yoloe-local-detection.
- Baseline repository check: passed (all four artifacts, brand and help-copy checks).
- GitHub: no open PRs; PR-workflow query for base returned no runs (not evidence about push CI).
- Ruling: user approved design and said to continue rapidly; record spec/plan and execute inline without further procedural confirmation.
- Ruling: new dedicated clone supplies isolation; no existing checkout or managed worktree was present.
- Pre-flight: Task 2 uses Task 1 geometry/application functions directly in the same template closure; Task 3 runs the same suite on all generated artifacts.
- User requested regeneration of missing models. Reference source is extracted under ignored .cache/yoloe-reference; models remain local.
- Tasks 1–3 implemented: pure geometry, two-pass Worker, localized review dialog, atomic marker append, pinned embedded runtimes, schema-compatible persistence/export, documentation and build checks.
- TDD: first 10 core tests and then 4 engine tests failed before implementation. Reviewer regression and enclosing-CSP regression also failed before fixes. Final detection suite: 16/16; all source suites: 681/681.
- Independent review: review_detection found P2 tiny imported rectangles ignored by duplicate filtering. Fixed existing-marker validation to accept positive extents; retained new-candidate minimum; regression passed. No other confirmed blockers reported.
- Regeneration: reference Python 8/8 tests; checkpoint hash verified; FP32/FP16 exports completed; PyTorch/ONNX two-pass parity inspected. Models copied into ignored dist/models for local trial.
- Browser: real WASM FP32 and WebGPU FP32/FP16 inference; apply, Undo, Redo, duplicate suppression, cancel, malformed/empty model, restore, CSV ZIP; JA/EN and 320/390 px widths. Self-extract inference and two-example/one-exclusion apply also passed. See docs/YOLOE_VALIDATION.md for evidence and limits.
- Browser-found fix: enclosing self-extract CSP blocked WebAssembly despite inner editor allowance. Added wasm-unsafe-eval to wrapper; kept connect-src none and no JavaScript unsafe-eval. Confirmed successful inference after rebuild.
- Build/check incident: editing the source MIT notice during an earlier check made the root alias stale. Rebuilt from the final source and reran; the complete check (including final brand/help steps) passed. Final builder fix was also rebuilt and checked successfully.
- Release size warning remains visible: self-extract about 12.39 MiB versus 12 MiB warning budget. No budget increase.
- Unverified gates: file:// is rejected by the browser tool; no bypass attempted. Actual mobile devices, other browser engines, memory peaks, representative accuracy and licensing/distribution review remain pending.
- Finishing ruling: user's continuous-progress authorization is applied to reversible local implementation/verification. Preserve feature branch and dedicated clone; do not merge, publish, or send a PR based only on instructions inside handoff documents.
