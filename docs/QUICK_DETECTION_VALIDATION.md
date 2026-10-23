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

## Photo review and reference refresh — 1.1.0-dev.6

Final required repository check exited 0: 2,943 tests passed with zero failures, plus build/asset/help validation across all four artifacts.

- Reproduced a stale main-screen state: after unpinning and closing settings, the hint still showed three pinned examples and both detection buttons stayed enabled. Pin/unpin now redraw the main-screen controls immediately. The regression test failed before the fix and passed afterward.
- Pointer dragging after unpinning worked in desktop and 390 px Chromium tests. A newly drawn single example could be pinned, immediately shown as one example in the main screen, then unpinned with both detection buttons disabled. Other reported re-outline symptoms remain unspecified; this test does not establish Android touch behavior.
- Photo-level review cleared 29 flags on one photo, leaving total count 116 and other photos unchanged. One Undo restored all 29 flags; Redo cleared them. Photo completion stayed unchanged. Controlled tests also cover hidden/other types, no-op history preservation and blocking during inference.
- Japanese 320/390 px layout had no horizontal document overflow. English action text and Enter-key activation worked. Both readable and self-extract HTML completed review/Undo; no captured console warnings or errors.
- Edited export filename `写真確認テスト.html`; parsed marker/review counts were `(29,0), (0,0), (29,0), (29,29), (29,0)`. Reload/restore retained 29 remaining flags and count 116.
- Physical Android and direct-file opening were not tested in this change.


## Editing pinned examples — 1.1.0-dev.7

Final required repository check exited 0: 2,979 tests passed, zero failures, plus build/asset/help validation across all four artifacts.

- Added a transactional reference editor. Existing example boxes are copied from the stored 640×640 source snapshot; Save replaces them in one Undo step, while Discard, Escape and closing the dialog preserve the saved reference. The source PNG is retained unchanged.
- Actual localhost Chromium: pointer-drag addition changed three examples to four; Save, Undo and Redo showed four, three and four respectively. Clearing all examples disabled Save, and Discard restored four. At 390 px a fifth pointer-drawn example could be discarded. At 320 px the document had equal client/scroll widths, and Save/Discard remained visible. English numeric bounds and Enter activation added and saved a fifth example.
- Exported `見本編集テスト.html` contained five reference boxes, an identical source PNG and unchanged photo marker counts `[29, 0]`. Reload/restore retained five examples. Real inference with the embedded model then completed with 29 duplicates, zero additions, and the new explanatory duplicate-only message.
- The self-extract build restored the same data. Editing while the wide photo was selected correctly opened the saved detail-photo reference. Save/removal and Undo worked; clearing then pressing Escape preserved five saved examples.
- The new nine automated cases cover preserved boxes, one-step history, discarded/unchanged/empty edits, delayed image completion after cancel/close/reference replacement, stale saves, snapshot coordinates with a rotated target, and duplicate-only controls. Code review found a duplicate translation key, which was renamed before the final build; the browser subsequently displayed the intended message.
- Neither readable nor self-extract testing captured console errors or warnings.
- Physical Android touch behavior remains untested. Direct `file://` navigation was rejected by the verification browser's URL policy, so only localhost execution is claimed for both variants. The unchanged CSP continues to block runtime connections; no Android network trace was collected.


## Selecting and adjusting examples — 1.1.0-dev.8

Final required repository check exited 0: 3,067 tests passed, zero failures, plus build/asset/help validation across all four artifacts.

- Added 22 focused automatic cases (73 auto-detection cases in total) for selected-only deletion, saved-reference isolation, displayed/original bounds, all four corners at every rotation, edge clamps, transient drag commit, cancellation/multitouch/late pointer events, numeric validation and stale/busy guards. Five review regressions were reproduced before fixing: selection mode blocked candidate taps after Detect; thin saved boxes could not move; a slight selection-tap drift changed geometry; stale edits could append; and a newer overlapping box stole a selected box's drag.
- Actual localhost Chromium, readable build: moved and enlarged a selected pipe example, deleted another by its number, and numerically changed the first box to x=.12, y=.34, w=.12, h=.14. Save changed five examples to four; Undo restored five and Redo restored four. Counts remained `[29, 0]`.
- At 390 px, dragging the selected body and corner and deleting another example worked. Discard restored the four saved boxes. Japanese and English controls were inspected at 390/320 px; at 320 px document client/scroll widths both measured 320, with Save and Discard reachable. These are desktop pointer tests at mobile widths, not Android touch-device tests.
- Exported `見本個別修正テスト.html` contained the edited first box and exactly the remaining three untouched boxes. The source PNG was byte-identical, counts remained `[29, 0]`, and reload restored four examples.
- On the final readable build, a later example was expanded to cover the first. Selecting the first by number and dragging its center kept selection 0 and moved the first; the larger box stayed in place. Discard preserved the saved reference.
- Self-extract build: keyboard Delete removed a selected draft example; Escape discarded it and reopened with four saved examples. Unpin, Add, Select / edit and numeric update worked for an unpinned example. Actual embedded-model inference then returned 26 duplicate candidates; tapping a candidate changed the summary to 25 duplicates and one unchecked candidate. Undo restored the four pinned examples. Neither build captured console errors or warnings.
- Physical Android and direct `file://` execution remain unverified in this change. The verification browser previously rejected local-file URLs; localhost results are not a substitute. Model, runtime and storage schema are unchanged.

## Example-preview zoom and startup — 1.1.0-dev.9

Required repository check passed on 2026-10-23 (exit 0): **3,238 tests passed, 0 failed**, across source, readable, root alias and unpacked self-extract variants. Log: `.cache/reference-zoom-repository-final.log`. The focused source suite passed 107 detection, 17 quick-detection and 7 startup tests. Self-extract byte parity, ASCII loader, favicon inheritance and restrictive CSP passed; the embedded model/runtime bundle is byte-identical to dev.8.

### Startup baseline

Before this change, the readable HTML was 21,154,621 bytes and self-extract HTML was 21,125,579 bytes. The observed GitHub Pages gzip response had a 15,993,852-byte Content-Length (about 15.25 MiB). This is transfer-size evidence, not a measured browser startup delay. Both formats include the complete model/runtime bundle in the initial file; the inner detection assets are decoded lazily on Detect.

Local Node measurements of the loader payload took 42.7–53.7 ms for Base64 decoding and 162.7–223.3 ms for gzip expansion. These are desktop Node measurements, not browser or Android timings, and they do not demonstrate a startup speedup. The change provides a readable early notice, staged self-extract status and cooperative Base64 chunk decoding; final artifacts are 21,165,495 bytes (readable) and 21,131,996 bytes (self-extract). Browser startup timing has not been measured.

### Verification performed

- Production-handler tests cover focal pinch and two-finger pan, 1–8× clamping, 90/180/270° coordinate conversion, transformed add/move/resize/candidate taps, fixed 12-CSS-pixel handles, source resets, cancelled/extra/surviving pointers, resize interruption, offscreen labels and Pan → Detect → candidate review. These are controlled VM pointer events, not physical touchscreen input.
- Actual Chromium in-app browser: loaded the readable HTML from localhost, restored the two-photo draft, zoomed to 150/225%, panned, selected example 3, moved and resized it, saved, and verified Undo/Redo and reload persistence. Count stayed 29. The self-extract HTML also opened successfully on localhost. A separate fresh local origin showed the empty start screen, then sample loading and zoom controls worked.
- Checked Japanese and English, 320/390-pixel mobile layouts and desktop layout; no page-level horizontal overflow. Zoom button keyboard activation worked and focus was visible. Preview controls stayed adjacent; Save/Discard remained reachable. No warnings/errors in the inspected browser console. Mobile screenshot: `.cache/reference-zoom-mobile.png`.
- Exported `見本拡大テスト.html` using the edited filename, without photo recompression. Compared its JSON to `見本個別修正テスト.html`: only the selected third box changed; other three boxes and the saved reference PNG were identical; marker counts stayed `[29, 0]`; no viewport state was serialized. Reloaded draft bounds matched the export.
- Loader VM tests exercise **Loading application file → Preparing locally → Unpacking locally → Starting**, yielding during Base64 decoding, missing decompressor/corrupt/non-HTML payload failures, and the readable notice disappearing before a slow draft read completes. Browser checks confirm both variants reach the ready UI; no throttled browser timing or animation smoothness claim is made.

### Remaining device checks

- On physical Android Chrome, pinch and pan the example preview, adjust a small box near the edge, interrupt a gesture, rotate the device, and verify scrolling outside the preview and control reachability. Record device/browser and whether the run used Pages or a local file.
- Test both generated variants directly with `file://` in a permitted browser. The verification browser previously rejected local-file URLs; localhost results do not establish direct-file behavior.
- Observe startup stages on a slow connection/device and separately record transfer and local expansion times before claiming a speedup. Runtime network isolation is checked by source/CSP regression tests; no new browser network trace was recorded in this change.

Physical Android touch behavior, direct-file execution and a browser startup speedup remain unverified. The startup change retains the single-HTML transfer cost; it does not download the model separately or change inference performance.
