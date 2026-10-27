# Detection readiness and edge alignment

**Goal:** Address the user's dev.15 screenshots: full-width header, toolbar actions aligned to the photo frame, and understandable detection availability. Keep the current model.

**Architecture:** Retain the existing single-HTML workspace, per-type pinned-reference requirement and inference paths. Correct flex sizing and synchronize the toolbar replica in the quick-control render used by import start/finally.

**Constraints:** No model/runtime/schema changes. Preserve license/source/build content. Keep both languages and phone controls usable. Continue the existing authorized build and Pages release workflow.

- [x] Trace availability and reproduce stale import completion with production functions.
- [x] Add failing state-transition regressions; fix synchronizing and nearby explanation without auto-pinning.
- [x] Adjust header/toolbar CSS and compatible-model wording; update Help and product docs.
- [x] Build both variants, run required repository checks, independently review, and verify desktop/mobile layouts and pin/unpin/detection behavior in the browser.
Release gate: publish after the checks above, then verify the new Pages version. Keep deployment evidence in the local `.cache/dev16-progress.md` ledger; device limits are recorded in `docs/COMPACT_UI_VALIDATION.md`.
