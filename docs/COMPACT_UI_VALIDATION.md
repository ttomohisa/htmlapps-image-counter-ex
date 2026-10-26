# Compact workspace validation — 1.1.0-dev.15

Recorded 2026-10-26 against the generated readable and self-extracting builds. Model, runtime dependencies, schema 4 and inference behavior are unchanged.

## Automated verification

- `scripts/check-repository.ps1`: exit 0, **4,046 passing tests** across the required source/readable/root-alias/unpacked-self-extract matrix and supporting checks. Help-copy, embedded assets, release parity, CSP and brand checks pass.
- New workspace suite: 15 tests for transient project ownership, cancellation of real pending point/rectangle/range gestures, disabled/busy/modal guards, native-dialog return, visible mobile focus and accessible names.
- The first self-extract matrix run exposed a missing Node `Buffer` in the new test harness. Adding the required harness global fixed that failure; the final full matrix passed. No production decompression change was needed.
- License/source and build HTML fragments have exactly the same SHA-256 hashes as the pre-change source. All protected JA/EN strings match as well. Dynamic version/timestamp values continue to reflect the build.
- Independent review identified mobile inspector focus, hidden live correction preview and unnamed desktop history buttons. These were repaired and re-reviewed. A browser check additionally found focus loss after a filtered run disabled its own launcher; a failing regression test and visible-target fallback cover it.

## Browser evidence

The desktop in-app browser used local HTTP. These are viewport checks, not Android touch tests.

| View | Canvas top / height (CSS px) | Document size | Result |
| --- | --- | --- | --- |
| Previous dev.14, 1360 × 900 | 701 / 576 | 1360 × 1394 | Long vertical stack before photo |
| dev.15 JA Review, 1360 × 900 | 243 / 639 | 1360 × 900 | Photo occupies 71% of viewport height; inspector scrolls independently |
| dev.15 JA Review, 390 × 844 | 262 / 498 | 390 × 844 | No page overflow; visible review controls and bottom actions |
| dev.15 EN Review, 320 × 740 | 310 / 346 | 320 × 740 | Controls wrap to preserve readable 12 px text; no horizontal overflow |
| dev.15 EN, 844 × 390 landscape | 265 / 215 | 829 × 559 | Short-screen vertical scrolling retained rather than clipping controls |

The initial aspirational canvas-top targets were about 220 px desktop and 260 px mobile. The final desktop and narrow English layout retain a little more control space for legibility; the measured dimensions above are the actual result, not the target. Metadata is omitted from the mobile heading and long status text truncates visually while remaining available to accessibility tools.

- Restored the existing test work: three steel photos, 58 markers, four pinned examples and a left-half region on photo 3. Switching panels, modes, languages and photos preserved work. Detection-area controls still showed 0/0/50/100 bounds.
- Current-photo CPU detection completed in 4.0 s with zero additions/errors. Filtered Complete-only detection processed exactly one photo in 1.9 s; after its status changed the list became empty, while the captured run still completed. These verify operation, not detection accuracy. Undo/Redo restored the batch changes and prior Complete filter membership.
- Progress and Stop were outside the inert workspace, stayed inside the mobile viewport, and did not increase document height. Dismissal and panel opening returned focus to visible controls. Arrow keys switched inspector tabs without navigating photos.
- Mobile Project → image correction returned to the visible photo before opening the nonmodal controls. Changed brightness, closed and undid. Closing Save after mobile-to-desktop resize returned focus to the visible desktop Save launcher.
- Saved `dev15-compact-workspace-check.html` with an edited filename. Parsed output: schema 4, three photos, 58 markers, four reference boxes and `{x:0,y:0,w:0.5,h:1}` on photo 3. Reload/restoration retained the work.
- Self-extract startup at a fresh localhost origin showed no previous-work offer. Sample load, manual point, Undo/Redo and Review complete & next worked. No console warnings/errors were observed in the checked tabs.
- Help showed three steps and four cautions; expanded optional tips, closed with Escape and checked Japanese/English. Mobile license section remained available. Existing mobile hiding of Build info was preserved.
- `assets/screenshot.png` is the actual 1360 × 900 rendered workspace, converted from the browser's JPEG capture to PNG without changing geometry or content.

## Limits

No attached physical Android device was available. Virtual keyboard, native touch/pinch and Android download behavior remain device checks. The environment's earlier direct-file browser restriction was not bypassed; HTTP success does not establish `file:`/`content:` behavior. No alternative model was downloaded, converted or benchmarked in this UI release.
