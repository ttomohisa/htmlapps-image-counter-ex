# Reusable examples — 1.1.0-dev.4

Tested on 2026-10-23. This is functional verification, not a new accuracy benchmark.

## Automated coverage

Final Windows PowerShell 5.1 `scripts/check-repository.ps1`: exit 0, **2,863 tests, zero failures**, including all four source/release representations and both build verifiers.

The auto-detection and import suites contain 80 tests, including separate reference/target tensors, target ownership, reference replacement, close/model changes during next-image loading, pin/unpin history, unchanged marker counts, independent reference geometry, draft/viewer serialization, and invalid reference rejection. The repository check runs the suites against the template, generated readable HTML, root release alias and unpacked self-extract HTML.

Imported references must be version 1, a 640 × 640 PNG of at most 2 MiB, and contain 1–20 finite in-bounds regions. Real exported PNG decoding was also checked outside the header-only unit fixture.

## Browser observations

- Readable HTML over local HTTP: imported the steel detail and full-scene photos, entered three examples, pinned them, and detected 29 candidates on the detail image at 5%.
- **Add and detect next** added those 29 markers to the first image, changed the target to the second image, retained the original reference and cleared the previous candidates before inference.
- The full-scene image returned zero candidates at both 5% and 1%. Objects are much smaller in that image. This is a retained limitation; the test does not establish accuracy across shooting conditions.
- Reloaded the page and restored the IndexedDB draft: all three pinned examples and 29 accepted markers survived. Unpin followed by Undo restored the reference.
- Saved viewer HTML with the user-edited test filename `固定見本テスト.html`. The file contained both photos, marker counts `[29, 0]`, and an independently decodable 640 × 640 PNG reference with three boxes.
- Imported that viewer into the self-extract HTML. Added a new image record from the same detail-photo file as a controlled regression check, then detected 29 candidates without outlining examples again. This is reuse across records, not an independent-photo accuracy result.
- Japanese and English reference controls rendered correctly. At actual 390 × 844 and 320 × 740 browser viewports, document width matched viewport width. The detection action sits directly below the photo; review/apply actions remain in the dialog footer.
- No warning/error console messages were captured during these browser paths. Static verification confirms the embedded model/runtime and restrictive `connect-src 'none'` policy; no packet capture was performed.

## Remaining device checks

Physical Android and direct-file execution of this new workflow remain unverified. The user reported good Android Chrome operation on the previous dev.3 Pages build. The in-app browser's earlier local-file restriction was not bypassed. Follow [ANDROID_FILE_TEST.md](ANDROID_FILE_TEST.md) on the device.

The embedded model is unchanged (6,756,087 bytes). Complete HTML size varies with the PowerShell gzip implementation: approximately 20.14–20.32 MiB readable and 20.14–20.22 MiB self-extract in the local builds.
