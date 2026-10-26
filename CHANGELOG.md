# Changelog

## 1.1.0-dev.14 — 2026-10-26

- Add compact smartphone Review with an explicit settings/photos toggle and nearby review/navigation/save actions.
- Add Detect list (N), capturing the current filtered photo list when a run starts; Detect all, totals and exports retain full-project scope.
- Add optional per-photo detection regions with drawing/numeric bounds, Save/Cancel, Undo and draft/work persistence. Older work defaults to full image; malformed imported regions are rejected.
- Accept only detection centers inside the region after full-image inference and complete raw-output validation. Replace preserves eligible markers outside the region. This does not claim cropped-inference speed or accuracy improvements.
- Keep schema, model and runtime dependencies unchanged. Physical Android and actual local-document checks remain pending.

## 1.1.0-dev.13 — 2026-10-24

- Add a labelled photo-status filter above the thumbnails with full-project option counts, matching/total count, reset-to-All and an empty state.
- Keep the current photo visible when excluded, with an explicit notice. Previous/Next and Left/Right move only between matching photos in project order without wrapping; native select keyboard behavior is preserved.
- Preserve the temporary filter across same-project edits, status changes, Undo/Redo and language changes; start new/opened/restored work at All. Reject stale filtered navigation after filter/project changes and retain the displayed photo on decode failure.
- Keep summaries, exports, Detect all photos, Next incomplete and Review complete & next scoped to the whole project. Filtering changes no saved data, history, autosave, schema or model assets. Physical Android filtering checks remain pending.

## 1.1.0-dev.12 — 2026-10-24

- Add Review mode for selecting existing markers without adding counts or changing geometry. Single and Multiple support drag-to-pan; explicit Edit keeps the chosen marker selected in its Point/Rectangle editing mode.
- Add multiple-tap and additive range selection by visible marker center, with selected count, Clear selection and Delete selected controls in Japanese and English.
- Delete selected markers from the current photo as one undoable, autosaved change. Preserve other markers, photos and detection checks, and return the edited photo to incomplete.
- Discard interrupted range selections and clear or prune temporary selection at photo, mode, visibility, history and detection transitions. Selection is not saved in drafts or exports.
- Enter Review after successful quick detection, including zero results and stopped runs with earlier successes, and after dialog candidate application. Keep schema, model and inference behavior unchanged; physical Android checks remain pending.

## 1.1.0-dev.11 — 2026-10-24

- Reuse a worker, model session and visual reference embedding within each main-screen detection run. Release them on completion, cancellation or failure; retain one-step Undo and atomic replacement.
- Show elapsed time in the completed run summary. Model, preprocessing, thresholds and the saved schema are unchanged.
- Clarify Save work / Open work, portable HTML versus browser autosave, and the read-only viewer versus reopening in the editor. Add Open work inside Save & export.
- Validate a selected work file before asking to replace active work. Protect the current project against cancelled, invalid and stale imports, including photo additions that finish after work replacement. Capture content and filename at save start and prevent duplicate saves.

## 1.1.0-dev.10 — 2026-10-23

- Show Undetected, In progress, Needs review and Complete photo states in thumbnails, the current-photo bar and project status totals.
- Add Review complete & next to review and complete one photo, then move to the next incomplete photo with wraparound and one-step Undo.
- Offer Append or Replace unreviewed auto results for main-screen detection. Replacement protects manual, reviewed, edited, other-type and older-version results.
- Record successful detection checks even for zero or duplicate-only results, so each processed photo requires review. Save checks and replacement eligibility in the existing schema-4 draft/viewer format.
- Commit replacements only after a valid full result; keep the current photo on failure/cancellation and reject truncated replacement results. One Undo restores the entire run, including removed markers and checks.

## 1.1.0-dev.9 — 2026-10-23

- Add 1–8× pinch/button zoom, two-finger pan, Pan view and Fit beside the example preview so small boxes can be adjusted at a larger scale.
- Keep corner handles at a fixed screen size and reuse the view transform for image, overlays and pointer geometry. Zoom/pan remain temporary; saved boxes, PNG snapshots and inference inputs are unchanged.
- Abandon unfinished box edits when a pinch starts, preserve selection and reject late releases. Reset the view at dialog/source/reference transitions while retaining it between Add and Select / edit.
- Show an early startup notice and truthful self-extract loading/unpacking/starting stages; decode the loader payload in chunks so the browser can update progress. The bundled model/runtime transfer remains part of the initial HTML; no browser startup speedup is claimed.
- Keep physical Android touch and direct-file validation separate from automated and desktop-browser results.

## 1.1.0-dev.8 — 2026-10-23

- Add explicit Add and Select / edit modes for local examples and pinned-reference drafts, with canvas or numbered-list selection and selected-only deletion.
- Move selected boxes, resize from all four corners within the image, and update precise percentage bounds without redrawing them.
- Discard interrupted pointer and multitouch edits. Keep pinned changes pending until Save, with discard/close preserving the saved reference and one Undo for a saved update.
- Keep model assets, dependencies and the existing storage schema unchanged. Physical-device and direct-file checks remain pending.

## 1.1.0-dev.7 — 2026-10-23

- Add editing of pinned examples on their saved source snapshot, with save/discard and one-step Undo.
- Hide existing marker overlays by default and provide an explicit dashed-marker toggle.
- Clarify fixed-example controls and why duplicate-only detections cannot be added.

## 1.1.0-dev.6 — 2026-10-23

- Add a photo-level Mark this photo reviewed action with flagged count, one-step Undo/Redo and autosave.
- Synchronize main-screen pinned-example status and detection availability immediately after pin/unpin.

## 1.1.0-dev.5 — 2026-10-23

- Add main-screen Detect this photo and Detect all photos using the selected type’s pinned examples.
- Automatically add duplicate-filtered results as Needs review markers, with one Undo for the whole run.
- Process photos sequentially with progress, per-photo results and Stop; retain completed additions after cancellation.
- Prevent editing and pending-import races during runs; release inference resources and ignore late results.

## 1.1.0-dev.4 — 2026-10-23

- Pin visual examples per counting type and reuse them across photos, with thumbnails and target/source filenames.
- Save independent reference snapshots in drafts and viewer HTML; retain them after source-photo removal. Pin/unpin support Undo.
- Add reviewed candidates and detect the next photo in one action, with cancellation and stale-result guards.
- Validate imported reference dimensions, size, version and regions. Embedded model and offline single-HTML packaging are unchanged.

## 1.1.0-dev.3 — 2026-10-23

- Embed the validated 6.44 MiB compact YOLOE-26n in both single-HTML variants; detection defaults to CPU / FP32 without a model-file picker.
- Load weights on demand, preserve repeat/cancel behavior and retain optional custom-model settings with a built-in reset.
- Publish the integrated release under AGPL v3, with offline license text, source link, original checkpoint and conversion code; retain historical MIT notices.
- Pin local model assets by SHA-256 in the build manifest. Allow 22 MiB self-extract / 25 MiB readable warning budgets to include the model and existing ORT runtimes.

## 1.1.0-dev.2 — 2026-10-23 (unreleased)

- Add 1% and 5% visual-search presets; default to 5% after fixed-example diagnosis, with bilingual guidance about false positives and uncalibrated scores.
- Add reproducible model export and FP16 weight-storage compaction with FP32 CPU computation. The model remains a separately selected file.
- Record fixed-sample threshold, preprocessing, branch and model-size comparisons; distinguish native tests, browser evidence and point-matching proxies.

## 1.1.0-dev.1 — 2026-10-22 (unreleased)

- Add current-photo visual example selection, local CPU/GPU inference and candidate review. No count changes until explicit application.
- Add duplicate-aware one-history batch application using existing markers, drafts and exports.
- Embed fixed ORT runtimes; keep custom model selection local and separate. Cancel closes the Worker and rejects stale results.
- Add bilingual and keyboard-accessible detection controls and behavioral regression coverage across all four artifacts.
- Fix interrupted detection controls when returning from the browser page cache; preserve completed candidates. Wrap long type names in the detection footer and project summary at narrow widths.
- Allow equivalent, integrity-checked gzip encodings in release freshness checks so Windows PowerShell 5.1 and GitHub Actions PowerShell builds agree without hiding stale source or asset content.
- Model embedding, licensing resolution, cross-image examples and tiles remain later milestones.

## 1.0.4 - 2026-10-21

- Auto-save Undo/Redo results and clear image completion when resetting corrections.
- Keep exported viewer images, markers, and metadata coherent during rapid navigation and failed decoding; ignore stale results and allow recovery.
- Keep minimum-size corner resizes inside image bounds and restore narrowly recognized legacy native edge-overhang rectangles without relaxing other import geometry checks.

- Validate viewer project schema, identity, embedded raster payloads, geometry, references, and resource budgets before accepting an import; preserve current work on failure.
- Protect formula-like CSV text consistently in editor and exported viewer, retaining numeric fields and documenting visible apostrophe behavior.

- Hide Help Build info and the page footer on mobile widths, keeping desktop access unchanged.
- Give Help a fixed header and flexible scrollable body so content remains reachable on short screens.
- Rename Help to “使い方と注意事項” / “How to use & notes” and remove redundant language/dismissal prose without removing those controls.
- Reorganize the mobile start card with full-width photo/camera actions, a separate import/sample row, compact spacing, and no desktop-only drop hint.
- Add responsive and bilingual Help regressions across all four generated/source variants.

## 1.0.3 - 2026-10-10

- Keep type-name inputs and Hide/Show buttons in place so name commits preserve natural Tab navigation and visibility toggles retain keyboard focus. Add handler-level focus, normalization, ownership, and data/history regressions to the four-artifact check matrix.
- After a desktop/mobile layout change, closing Types or Export can return focus to its visible paired launcher when native restoration is offscreen or remains in the closed dialog/BODY. Preserve newer focus/modal ownership and normal browser Tab stops.
- Keep the language switch and Help available at narrow widths, reserving room for header actions and the version badge.
- Lock background scrolling only while modal Help is open.
- Ignore bubbled child clicks before checking dialog backdrop coordinates so keyboard activation of Build info no longer dismisses Help.
- Add Help/header handler and CSS-contract regressions to the source/readable/root-alias/self-extract check matrix.

## 1.0.2 - 2026-10-09

- Normalize brand icon backgrounds to #16624f with exact 25% corner radii across SVG assets, header icons, and embedded favicons, preserving existing artwork.
- Add focused brand representation regression checks.

## 1.0.1 — 2026-10-06

- Localize accessible control names, tooltips, confirmation buttons, camera preview text, and dynamic type-management controls when switching Japanese/English.
- Dismiss obsolete previous-work offers after a new workspace is accepted, localize the draft summary on language changes, and preserve recovery after cancelled or failed imports.
- Stage viewer imports before replacing the active project and reject late draft reads/imports after newer work is accepted.
- Add language and restore-ownership regressions to the source/readable/root-alias/self-extract verification matrix.

## Previously unreleased

- Add a session-only **Include annotated JPEGs** option to editor ZIP export. The default preserves CSV + JPEG output; clearing it saves the same two CSV files without processing images.
- Discard cancelled point/rectangle creation and restore moved/resized geometry and completion without changing history, redo, or autosave. Switching to pinch discards unfinished marker edits, and extra/late pointer events cannot commit them.
- Add synthetic CSV/ZIP integrity and cancellation regressions across all four app artifacts while retaining camera lifecycle and byte-parity checks.

- Keep the tracked `image-counter.html` release alias synchronized with the readable build. CI rejects stale aliases and exercises camera lifecycle regressions against source, both release formats, and the root alias.

- Stop camera tracks after cancelled or superseded starts, failed playback, and page exit. Late permission results cannot restart capture in a closed dialog.

## 1.0.0 — 2026-08-29

Initial Browser Kitty release of Image Counter.

### Counting and editing

- Added manual point-marker counting and drag-to-count rectangle markers.
- Added marker movement, rectangle four-corner resize, type changes, deletion, Undo / Redo, and a brief highlight for the most recently added marker.
- Marker editing controls appear only after an existing marker is explicitly selected; they do not interrupt continuous counting immediately after placement.
- Marker numbers restart from `1` for each counting type while image and project totals are tracked separately.
- Added independent **Needs review** flags for point and rectangle markers with an amber `!` badge. Review flags do not change the marker type or count.
- Prevented completing an image while unresolved review markers remain.

### Types and visibility

- Added multiple counting types with editable names, colors, and per-type visibility.
- Added a translucent type-switching dock directly on the canvas, including a compact/minimized state when the dock covers an object.
- Added desktop numeric shortcuts `1`–`9` for fast type switching.
- Added global marker visibility, number visibility, marker size, and opacity controls.

### Images and workflow

- Added multi-image projects with thumbnails, per-image counts, completion state, **Next incomplete**, and `←` / `→` keyboard navigation.
- Added project-wide totals, completed-image counts, needs-review counts, and per-type summaries.
- Added non-destructive brightness, contrast, grayscale, and 90° rotation adjustments while keeping the image visible during adjustment.
- Added live camera capture with post-capture review, retake, accept, and accept-and-continue flows, plus device camera/file fallback.
- Added image notes from the memo icon beside **Complete**. On desktop the memo floats over the canvas and can be dragged within it; on mobile it opens below the canvas.
- Added current-image deletion as a visible header action with a confirmation dialog; the last remaining image cannot be deleted.
- Added optional counting guide support as a secondary feature.

### Capture time and metadata

- Added JPEG EXIF capture-time reading with file timestamp fallback.
- Photos taken through the in-app camera retain the actual capture time.
- Added captured-time source metadata so the viewer and CSV output can distinguish EXIF, file timestamp, and camera capture time.

### Local persistence

- Added IndexedDB draft autosave.
- Added current project size, saved-draft size, and available-storage display when supported by the browser.
- Added optional WebP compression for autosaved image copies with adjustable quality.

### Export and read-only viewer

- Added a read-only, self-contained Viewer HTML designed for reviewing and sharing results rather than editing them directly.
- Added optional WebP compression for images embedded in Viewer HTML.
- Added project/image summaries, thumbnails, `Previous` / `Next` / `←` / `→` navigation, marker/number/type visibility controls, and structured image information.
- Added a dedicated **Comment** card above image notes in the viewer.
- Added filename, capture time/source, dimensions, original format/size, completion state, count, and needs-review count to viewer image information.
- Added confirmation dialogs before viewer-side JPEG and CSV + all-images ZIP downloads.
- Added viewer-side current annotated JPEG download and CSV + all annotated JPEG ZIP download.
- Added Viewer HTML re-import into Image Counter to resume editing.
- Added `markers.csv` and `summary.csv` with image metadata, capture time/source, display corrections, marker shape, review flags, per-type numbering, normalized/pixel coordinates, rectangle dimensions, and project-level summaries.
- Standardized annotated image ZIP output on JPEG.

### UI / UX

- Reorganized the desktop side panel into compact **Project**, **Summary**, **Marker display**, and collapsed **Work data** sections.
- Removed redundant persistent progress and correction panels; completion stays visible on the canvas/thumbnails and display correction opens only when needed.
- Kept Point / Rectangle / Move in one row on desktop and smartphone layouts.
- Kept Undo / Redo easy to reach, with persistent smartphone bottom actions for Undo / Redo / Add image / Types / Export.
- Removed persistent canvas instruction bubbles after the workflow became self-explanatory.
- Added Japanese and English UI in the same HTML and updated browser titles when switching languages.
- Added a custom SVG app icon showing a photo, tap target, and upright index finger.

### Build and privacy

- Based the repository on the Browser Kitty `htmlapps-template` structure.
- Kept the runtime dependency-free using browser APIs, Canvas, IndexedDB, and Pointer Events.
- Kept runtime networking blocked by Content Security Policy with `connect-src 'none'`.
- Added readable `dist/index.html` and gzip self-extracting `dist/index.self-extract.html` release variants.
