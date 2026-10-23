# Main-screen detection validation

Date: 2026-10-23. Version: 1.1.0-dev.5.

## Automated checks

The final required `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./scripts/check-repository.ps1` completed with exit 0: 2,931 tests passed, zero failures, plus build/asset/help validation. It covers source, readable HTML, root alias and unpacked self-extract HTML. The new 17-test suite checks duplicate filtering, captured targets, one history transaction, Undo/Redo, no-op history, stale ownership, sequential execution, cancellation, decode/runtime errors, worker/bitmap/URL cleanup, pending-import races and hidden-toast locking. The reviewer independently confirmed both race fixes.

## Browser observations

Actual in-app Chromium tests over localhost, using the embedded compact model at the default CPU / FP32 / 5% settings and three pinned steel-pipe examples:

- Direct current-photo action kept the settings dialog closed and added 29 markers, all flagged Needs review.
- A three-photo run skipped 29 existing duplicates on the first photo, found zero on the wide scene, and added 29 on the last detail photo.
- A five-photo run added 58 markers across two additional copies of the detail image. One Undo changed both copies from 29 to zero; Redo restored both and their flags. Repeated photos test workflow correctness, not independent accuracy.
- Stop during preparation ended the run without adding markers. Partial-result retention during later cancellation is also covered by the controlled asynchronous test.
- Viewer export used the edited filename `一括検出テスト.html`. Parsed contents contained marker/review counts `(29,0), (0,0), (29,29)` and three saved reference regions. Reload/restore retained references and review flags.
- Japanese and English progress, results and controls were checked. Widths 390 and 320 px were inspected; primary actions occupy their own row, with no document horizontal overflow.
- Self-extract HTML completed direct detection with 29 duplicates excluded, no additions and no error. Switching to a type with no reference disabled both buttons. Enter started detection, Tab reached Stop, and Enter stopped it with focus returned to the opener.
- No error/warning console entries were captured during the tested flows.

## Limits

No physical Android-device or direct file-origin browser test was performed in this change. See ANDROID_FILE_TEST.md for the updated device procedure. The unchanged CSP blocks runtime connections, and the build verifies embedded runtime/model assets; this does not substitute for a network trace on Android. Existing small-object/scale and false-positive limitations remain. All-photo processing uses a fresh worker per photo to bound resource lifetime, so initialization is repeated.
