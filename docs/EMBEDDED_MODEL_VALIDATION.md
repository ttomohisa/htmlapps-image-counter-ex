# Embedded-model release — 1.1.0-dev.3

2026-10-23. Integrates the compact model validated in
[DETECTION_ACCURACY.md](DETECTION_ACCURACY.md); weights and detection thresholds
are unchanged. The model is 6,756,087 bytes (6.44 MiB), SHA-256
`d33ebb16c8cb03ef4b5e1888e759b96b4e0366769287f003798c3c1c75db41ba`.
Both complete HTML variants are about 20.13 MiB, including CPU and optional GPU
runtime assets. Inference uses CPU / FP32 by default; no file picker or network
download is required for the model. Decoded caches remain until page close;
compact storage does not imply proportionately lower inference memory.

## Browser evidence

Desktop Chromium in-app browser, loopback HTTP; these are not Android results.
Used the prior steel-detail photo and the same three fixed example rectangles at
5% confidence. No evaluation photographs are included in the release.

| Check | Observed result |
| --- | --- |
| Readable HTML, no model selected | 29 candidates; setup 2.1s, inference 6.3s |
| Cancel, then repeat with embedded model | 29 candidates; setup 6.7s, inference 5.5s |
| Exclude one, apply, Undo / Redo / Undo | 28 markers, 0, 28, 0 |
| Self-extract HTML, no model selected | 29 candidates; setup 3.0s, inference 4.2s |
| Browser console | No error entries on either variant during these runs |
| Japanese and English | Built-in model label and revised workflow visible |
| 390px desktop viewport | Document scroll width 390px; dialog client/scroll width 376px; no horizontal overflow |
| Offline license disclosure | Full AGPL and retained MIT notice displayed from the embedded asset |
| Fresh localhost origin | Empty start screen, sample load and CSV-only export succeeded |
| Edited export filename | `embedded-model-smoke.zip`, 1,667 bytes, only markers.csv and summary.csv |

Timings are observations from one desktop, not performance guarantees. The
readable test preceded a license newline normalization; the self-extract test
used the normalized license. No runtime code or model bytes changed between them.

## Release checks

The required `scripts/check-repository.ps1` rebuilds and checks the readable alias,
self-extract round trip, model hash, offline license, local-asset integrity failures,
and application regressions against source/readable/alias/self-extract variants.
Local text assets use LF before hashing, matching `.gitattributes` and CI checkout.
Original model checkpoint, export/compaction source, pinned requirements and notices
are in the public repository; the integrated release is GNU AGPL v3.

The full repository check passed under Windows PowerShell 5.1 (exit 0), including
the final icon and help-copy suites. Staged Git blobs also matched both pinned
local asset hashes after newline normalization.

Physical Android Chrome, actual touch input and `file:` / `content:` document
opening remain pending. Browser automation cannot open local file URLs in this
environment; HTTP checks do not establish direct-file support. See the updated
[Android checklist](ANDROID_FILE_TEST.md).
