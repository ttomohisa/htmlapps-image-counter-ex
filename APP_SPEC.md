# APP_SPEC.md — Image Counter EX / 画像カウンター EX

## 1. Product identity

- **Name:** Image Counter EX / 画像カウンター EX
- **Version:** 1.1.0-dev.10
- **Repository:** `ttomohisa/htmlapps-image-counter-ex`
- **Distribution:** `dist/index.html`, `dist/index.self-extract.html`, and the tracked readable alias `image-counter.html`
- **Purpose:** Count objects in photos manually or with explicitly reviewed local detection candidates, without uploads.
- **Primary users:** People doing inventory, part counting, inspection, field surveys, photo-based checks, and any task where double-counting or losing the current position is a problem.

## 2. Product principles

1. **Manual counting first.** Dialog detection produces temporary candidates. Explicit quick-detection actions append unreviewed markers or replace eligible unreviewed automatic results. Every successful quick detection requires human review, including zero-result runs, before photo completion.
2. **Local-first.** Images, markers, notes, drafts, and exports stay in the browser. Runtime network access is blocked with `connect-src 'none'`.
3. **Fast repetitive work.** Undo/Redo, category switching, current-category emphasis, and mobile controls must remain reachable while counting.
4. **Editable source data, read-only sharing.** The main app edits projects. Exported viewer HTML is read-only, but can be imported back into the main app to resume editing.
5. **Single HTML.** The normal and self-extracting builds must work as self-contained browser apps.

## 3. Core workflow

1. Add one or more images, or open the camera.
2. Choose **Point**, **Rectangle**, or **Move** mode.
3. Choose the marker type currently being counted.
4. Place point markers by tapping/clicking, or rectangle markers by dragging around an object.
5. Select an existing marker only when it needs editing.
6. Move markers; resize selected rectangles from their corner handles; change type or delete from the contextual marker controls.
7. Correct image visibility if needed with brightness, contrast, grayscale, and 90° rotation. The original image data remains unchanged.
8. Check each image, then use **Review complete & next** to clear its review state, complete it and continue to the next unfinished image.
9. Review project-wide totals and per-type totals.
10. Export a read-only viewer HTML or a ZIP containing CSV files with optional annotated JPEG images.

## 4. Functional requirements

### Images and camera

- Accept one or multiple image files.
- Maximum 30 images per project.
- Maximum 35 MB per input image and 220 MB per in-memory project.
- Support drag-and-drop and clipboard image paste on desktop.
- Support live camera capture through `getUserMedia()` when available.
- Closing the camera dialog or leaving the page invalidates pending camera starts and stops tracks; late results cannot restart capture. Playback errors also release the acquired stream.
- Show a post-capture review with **Retake**, **Use this photo**, and **Use & capture next** before adding a camera image.
- Fall back to the device camera/file input when live camera access is unavailable.

### Marker modes

- **Point:** one tap/click creates one count.
- **Rectangle:** one drag creates one count and stores normalized `x`, `y`, `w`, and `h`.
- **Move:** pans the image without adding counts.
- New markers must not immediately open editing controls.
- Selecting an existing marker shows type-change, needs-review, and delete controls.
- Needs-review is an independent boolean flag on a marker; it must not alter marker type, numbering, or count.
- Flagged point and rectangle markers show a small amber `!` badge and can be unflagged from the same contextual control.
- Existing point and rectangle markers can be moved.
- Selected rectangles show four resize handles and can be resized after creation.
- A cancelled pointer action discards a pending point/rectangle or restores the moved/resized marker geometry and prior completion state. It must not add history, clear redo, update the project timestamp, or schedule an autosave. Starting a two-pointer pinch abandons an in-progress marker edit in the same way; extra pointers and late cancelled-pointer events cannot commit it.
- The most recently added marker is visually emphasized briefly.
- Marker numbering is **per marker type**, while project/image totals remain independent.

### Types and visibility

- The first type uses `#d15c52` by default.
- Types are switchable directly from the translucent dock along the lower edge of the canvas.
- Desktop numeric keys `1`–`9` select the corresponding type.
- Users can add, rename, recolor, hide/show, and delete types.
- Committing a type name normalizes the existing input without replacing dialog controls, preserving forward/reverse Tab navigation. Hide/Show updates its existing button and translated label/icon without taking focus from another control or dialog.
- Each type has its own marker visibility toggle.
- A global marker visibility toggle hides/shows all marker overlays without deleting data.
- Marker numbers can be shown/hidden.
- Marker size and opacity are configurable.

### Image correction

- Brightness.
- Contrast.
- Grayscale amount.
- 90° left/right rotation.
- Reset corrections. Resetting reopens a completed image; Undo/Redo restores corrections and completion together.
- Corrections are non-destructive and must be preserved in drafts, viewer HTML, JPEG export, and CSV metadata.

### Multi-image project

- Show image thumbnails with per-image count, review-marker count and derived photo status: Undetected, In progress, Needs review or Complete.
- Preserve capture-time metadata: prefer JPEG EXIF DateTimeOriginal/DateTimeDigitized, fall back to the source file timestamp, and use the actual capture time for in-app camera photos.
- Allow Left/Right arrow keys to move to the previous/next image when focus is not in an editable field or modal dialog.
- Navigate previous/next and jump directly to any image.
- Mark an image complete from the upper-right area of the canvas.
- Provide **Next incomplete** navigation.
- Editing a completed image makes it in-progress again when count data or image correction changes.
- Show project-wide total marker count, completed image count, needs-review marker count, per-type totals and the number of photos in each status.
- An image with needs-review markers or an unreviewed detection check cannot be marked complete through the ordinary Complete button. Keep the review-marker count distinct from a pending zero-result detection check.

### Undo / Redo

Undo and redo must cover marker creation, deletion, movement, rectangle resize, type changes, visibility/display changes where appropriate, image completion, and supported image correction changes.

Undo/Redo must schedule autosave of the restored state, just like direct edits. Empty history stacks do not schedule a save.

### Local draft and storage

- Auto-save project state in IndexedDB.
- The previous-work offer belongs to the start screen. Accepting photos, a sample, viewer HTML, or a restored draft retires it; cancelled selection, malformed imports, and initial-image decode failures leave the previous work available.
- Stage viewer parsing and initial image decoding before replacing the active project. Delayed startup/restore reads or older viewer imports cannot replace newer accepted work.
- Re-render previous-work image/marker counts and timestamps in the selected language.
- Show current project data size, saved draft size, and available browser storage when available.
- Default to compressing the **draft copy only** to WebP to reduce local storage usage.
- Allow draft WebP quality adjustment.
- Restoring a compressed draft must preserve logical image dimensions, markers, categories, notes, completion state, adjustments and optional detection checks/replacement eligibility.

## 5. Export requirements

### Read-only viewer HTML

- One self-contained HTML file.
- Optional WebP compression for embedded viewer images with adjustable quality.
- Read-only presentation optimized for reviewing results, not editing.
- Project total, image count, completed image count, needs-review count, and per-type totals at the top.
- Image thumbnails and image navigation. Rapid navigation commits only the latest decoded image together with its markers and metadata. Decode failures keep the previously displayed image/state, report a localized error, and allow retry or another selection; current JPEG download stays disabled until an image has loaded.
- Structured current-image information: filename, captured time and its source, image dimensions, original format/size, completion status, count, and needs-review count.
- A visually separate Comment card with a comment icon and the image note.
- Previous/Next controls, thumbnails, and Left/Right arrow-key navigation without unexpected vertical page jumps.
- Global marker and number visibility controls.
- Per-type visibility controls.
- Marker numbering remains per type.
- Display image corrections and point/rectangle markers, including needs-review badges.
- Download the current annotated image as JPEG. Show a confirmation dialog before the download starts.
- Download `markers.csv`, `summary.csv`, and all annotated JPEG images as one ZIP. Show a confirmation dialog before the download starts.
- Embed sufficient project JSON so the viewer HTML can be imported by the main app to continue editing.

### CSV + optional JPEG ZIP

- The editor export card has an accessible **Include annotated JPEGs** checkbox, checked on a fresh page load. Its choice stays only in the current page session, including export-dialog close/reopen and language changes; it is not saved in project settings, drafts, or viewer data.
- Checked preserves the existing ZIP layout, JPEG names and rendering. Unchecked emits exactly `markers.csv` and `summary.csv`, without image decoding, canvas work, JPEG encoding, or viewer compression.
- Both modes use the same CSV serializers, UTF-8 BOM, CRLF rows, escaping, column order, original-image coordinates, and counts, including hidden markers/types. The editable output filename and sanitization are shared.
- Exported viewer HTML keeps its existing CSV + JPEG ZIP behavior.

Default ZIP layout (omit the entire `images/` directory for CSV-only):

```text
result.zip
├─ markers.csv
├─ summary.csv
└─ images/
   ├─ 01-counted-....jpg
   ├─ 02-counted-....jpg
   └─ ...
```

`markers.csv` includes at least:

- image index / id / name / completion / note
- captured timestamp and capture-time source (`image_captured_at`, `capture_time_source`)
- original image width / height
- brightness / contrast / grayscale / rotation
- marker id
- marker shape (`point` / `rect`)
- needs-review boolean (`needs_review`)
- global number within the image
- number within the marker type
- category name / id
- normalized x/y and normalized rectangle width/height
- pixel x/y and rectangle width/height

`summary.csv` contains per-image, per-type, and project-level counts plus `review_count`.

## 6. UI / UX requirements

- Smartphone usage is a first-class workflow, not a reduced desktop layout.
- Mobile must avoid horizontal page scrolling at 390 px and remain usable from 320 px upward. Type names, including unbroken names up to 40 characters, must wrap within summary rows instead of widening the page.
- Mobile top controls clearly show **Point / Rectangle / Move**.
- The canvas includes a low-profile translucent type-switching dock along its lower edge, showing type color/name/count and allowing one-tap switching without leaving the image. The dock can be minimized to a small corner control when it covers something that must be counted.
- On smartphone widths, the old duplicate type-switching area below the canvas is hidden; type management remains available from the canvas `+` button and the fixed bottom bar.
- Type switching is one tap.
- Mobile fixed bottom controls prioritize **Undo / Redo / Add image / Add or manage type / Export**.
- Undo/Redo must be easy to reach on both desktop and mobile.
- The complete-image control sits around the upper-right of the canvas.
- Needs-review state must be visible in the marker, image list/current-image status, and project summary without turning it into a separate marker type.
- Advanced display settings remain discoverable but do not dominate the counting workflow.
- Destructive actions use confirmation where data loss is meaningful; single-marker deletion is immediately undoable.
- Keyboard focus is visible and motion respects `prefers-reduced-motion`.
- Header language and Help controls remain visible and reachable from 320 px upward; the title can truncate while the version and action controls retain space.
- Help is titled **使い方と注意事項 / How to use & notes**. A non-shrinking header and flexible, scrollable body share the dialog height, keeping the final paragraph reachable on short screens. Native Escape, Close button, backdrop dismissal, and the modal background-scroll lock remain available. The redundant language-switch/close-instructions paragraph is not displayed.
- At widths up to 760 px, hide the Help Build info section and page footer; retain both on wider screens. An expanded desktop Build info section must not clip Help after resizing. Keyboard activation of desktop Build info must not dismiss Help.
- At widths up to 760 px, the start card uses a compact, left-aligned introduction, full-width stacked photo/camera actions and a separate two-column row for import/sample (stacked up to 380 px). Hide desktop-only drop/paste instructions on mobile. Keep the start screen free of bottom-bar space when no workspace is open.
- After Types or Export closes across a desktop/mobile layout change, a hidden or wholly offscreen paired opener can yield focus to its visible desktop/mobile counterpart. This applies only while focus remains on the recorded opener, BODY, or inside that now-closed dialog; a reopened dialog, another modal, or unrelated focused control keeps ownership. Other launchers and ordinary native Tab/BODY stops remain unchanged.
- Japanese/English switching updates accessible labels, tooltips, camera preview alternative text, confirmation buttons, and dynamic type controls without changing project values or unfinished type-name input.
- Show an early, readable startup notice while the bundled application is loading and remove it when the app is ready. Explain in Help that the initial single-HTML download includes the model/runtime assets and can take time on slower connections or devices; asset decoding for detection remains lazy.
- The self-extract loader reports **Loading application file → Unpacking locally → Starting** at the corresponding stages. Decode its Base64 payload in chunks with opportunities for the browser to update the loading UI before native gzip expansion. Do not present local unpacking as a model download or claim a measured startup speedup.

## 7. Privacy and network

- No upload server.
- No account.
- No analytics or telemetry.
- No runtime CDN or remote font.
- CSP includes `connect-src 'none'`.
- Camera input is handled locally by browser media APIs.

## 8. Browser target

Current stable desktop and mobile Chromium, Safari, and Firefox where the used browser APIs are available. Live camera behavior depends on browser permission and secure-context requirements; device camera/file fallback remains available.

## 9. Non-goals for v1.0.0

- Automatic counting without user review (local detection previews are supported in the development build).
- OCR-based counting.
- Cloud collaboration or shared server projects.
- XLSX export (planned for a later version).
- Merging existing markers automatically. Quick replacement is limited to explicitly eligible, unreviewed automatic results; dialog candidate import only filters duplicates.

## 10. Acceptance criteria

- `src/index.template.html` contains each build placeholder exactly once.
- `build-standalone.bat` / `build-standalone.ps1` can generate the normal and self-extracting builds on the template's supported Windows environment.
- `dist/index.html` contains no unresolved build placeholders or external runtime URLs.
- CSP blocks runtime network access.
- Self-extract payload restores `dist/index.html` byte-for-byte.
- Default builds synchronize `image-counter.html` with the readable output; custom output builds do not change the alias.
- Repository checks fail when the tracked alias differs from a fresh readable build. Only the build manifest timestamp and equivalent gzip encodings are ignored; embedded assets must first pass compressed-length, decoded-length, and SHA-256 checks. Source, configuration, decoded asset bytes, and all other metadata must match.
- Point marker add/select/move/delete works.
- Rectangle add/select/move/resize/delete works.
- A new marker does not show editing controls until selected later.
- Per-type numbering and category switching work.
- Multi-image totals, needs-review totals, and completion state work.
- Needs-review can be toggled on both point and rectangle markers; ordinary completion is blocked until current-image review flags and detection checks are reviewed.
- Camera capture presents a review before image acceptance.
- Draft size/compression controls work when IndexedDB storage is available.
- Image corrections persist into viewer/export data.
- Default app ZIP and viewer ZIP contain CSV + JPEG images with needs-review flags preserved in CSV and annotated images; unchecking the editor image option produces a two-CSV ZIP with identical CSV bytes.
- Cancelled point, rectangle, move, and corner-resize actions leave counts, geometry, completion, history, redo, and autosave unchanged at 0/90/180/270 degrees in portrait and landscape. Normal release remains undoable.
- Repository checks run camera, pointer/cancellation, ZIP, language, restore-ownership, Help/header, type-dialog focus, and paired-dialog return regressions against source, readable, root-alias, and self-extract payload variants.
- Viewer can download current JPEG and ZIP.
- Viewer HTML can be imported back into the main app with images and marker data intact.
- At 390 px viewport width, the application has no page-level horizontal overflow; the canvas type dock and mobile bottom bar remain usable.
- Both release variants retain their startup notice until ready; the self-extract stages describe the work actually in progress. Verify stage visibility under throttled loading separately from Node decoding measurements.


## UI / UX layout notes

- PC side panel order: Project → combined current image/project summary → Marker display → collapsed Work data.
- Redundant progress and persistent display-correction cards are not shown in the side panel; completion is visible on the canvas and thumbnails, and correction is opened from the canvas toolbar.
- Image notes open without shifting the page layout and auto-save while typing. The memo icon sits beside Complete at the upper-right of the canvas. On desktop the memo floats at the lower-right of the canvas and its header can be dragged to reposition it within the canvas area; on mobile it opens directly below the canvas. A note indicator remains visible when content exists.
- Image deletion is a direct current-image header action, is disabled for the last remaining image, and always uses the existing confirmation dialog.

- Persistent canvas instruction bubbles are not shown during normal counting.

## Brand icon consistency

- Brand backgrounds use #16624f with corner radii equal to exactly 25% of each background axis. Preserve foreground artwork, placement, and existing canvas padding across SVG assets, app headers, and embedded favicons.

## Import validation and spreadsheet safety

Viewer imports accept the native app identifier and schema version 4 only; local unversioned drafts retain compatible optional defaults. Validate types, unique IDs, category references, finite geometry/settings/dates, embedded raster signatures, 30-image count, 35 MiB actual bytes per image, and 220 MiB aggregate image-plus-metadata budget before committing. Reject external image URLs and SVG. Pre-read HTML ceiling is 661 MiB to accommodate JSON/base64 expansion and the viewer shell. Failed validation must preserve active work and the restore offer. Logical image dimensions remain independent of compressed dimensions. Previously oversized or SVG-based exports/drafts are not accepted under the stricter policy.

Editor and viewer CSV use the same serializer: formula-like text receives a leading apostrophe before CSV escaping; actual numbers keep numeric meaning, and project text remains unchanged. The apostrophe may be visible in spreadsheet programs. Repository checks exercise these boundaries and normal native roundtrips in all four source/release variants.

Compatibility exception: the former native resize handler could create an exact 0.003-wide/high rectangle extending past the right/bottom image edge by at most 0.003. Import/restore moves only that affected origin inward, retaining its minimum size. Out-of-range origins and other oversized rectangles still fail validation. New resizes keep the minimum rectangle fully inside the image.

## Local visual detection — 1.1.0 development milestone

- Current-image detection through Auto detect; one to twenty examples, drawn or entered using displayed-image percentage bounds. Examples never create counts.
- Local custom YOLOE runtime-prompt ONNX file, nonempty and at most 256 MiB; ordinary fixed-prompt YOLO exports are incompatible. The file is selected again after page reload and is not saved in projects.
- CPU uses FP32 / ORT Web 1.29.0; explicit GPU mode uses ORT Web 1.27.0 and supports FP32 or FP16 on compatible hardware. No automatic fallback: a retry starts a fresh Worker.
- ORT assets are embedded and decoded lazily. Blob module Workers, wasmBinary, one WASM thread and wasm-unsafe-eval retain connect-src 'none'. No external runtime fetch.
- Phases: ready → loading-runtime → processing → result or error. Cancel/close/model or setting changes invalidate the job; source ownership is checked again before result/application. Worker termination interrupts compute.
- Navigating away stops any active detection and updates its controls/status before the page is cached. Returning to a cached page allows another run; already completed review candidates remain available. Long type names wrap in the application summary even at 320 px.
- Inference uses original decoded pixels, without brightness/contrast corrections. Preview shares existing 0/90/180/270-degree transforms; all candidate geometry remains normalized to the original image, including compressed drafts.
- Confidence presets: 0.01 / 0.05 default / 0.1 / 0.25 / 0.5. The development default favors recall for visual prompting; scores are not calibrated accuracy percentages. Explain the false-positive tradeoff next to the control. NMS IoU > 0.5 suppresses lower-score boxes. Preview is capped at 1000 with the omitted count shown.
- Click a candidate or uncheck its list item to exclude it. Existing rectangles match by IoU >= 0.5 or intersection/smaller-area >= 0.8; an existing point inside a candidate also excludes it. This includes hidden and other-category markers. Recheck duplicates against current markers and accepted batch on Apply.
- Apply creates ordinary schema-4 rectangle markers in the active category with needsReview:false. One history entry, one autosave request, completed image becomes incomplete. Zero accepted candidates change nothing. Undo/Redo restores markers and completion together.
- Candidates, temporary examples, computed prompts, model files and runtime state never enter project/draft/viewer/CSV. Explicitly pinned examples are stored per category as an independent 640 × 640 PNG snapshot plus normalized example boxes (one to twenty). They survive source-photo removal and draft/viewer round trips; CSV contains counts and markers only. Existing native app identifier and storage slug image-counter remain unchanged for compatibility; product/repository labels use EX.
- The compact 6.44 MiB YOLOE-26n model is embedded and selected by default (CPU / FP32). No model picker is required. Advanced settings can load a custom model or restore the built-in model. Model weights inflate lazily on Detect; each Worker receives a fresh transferable copy. The integrated release is AGPL v3 with offline license text and public corresponding source. Cross-image prompt reuse and tiles remain deferred.
- See docs/YOLOE_VALIDATION.md for measured results and explicitly untested environments; direct file-origin detection is not considered verified solely by a successful build or HTTP test.

### Reusable examples (1.1.0-dev.4)

- Pin examples for the active counting type; show cropped thumbnails, source filename and current target filename. Unpin is undoable. Snapshots are immutable and shared by lightweight history.
- Run the prompt-extraction pass on the saved reference snapshot and the detection pass on the current target photo. Target coordinates and duplicate suppression always use the target photo. Rotation and display corrections do not change saved source pixels.
- After reviewing a result, Add and detect next applies accepted candidates as one undoable batch to the current image, then detects the next image in list order. Zero accepted candidates allow proceeding without history changes. Each new result requires review; images are not marked complete automatically.
- Image loading, inference, cancellation and late callbacks are guarded by project, image, category, generation, model and reference identity. Cancel/close during transition must not start a later detection.
- Imports validate snapshot PNG magic/header dimensions, version, payload limit (2 MiB), one to twenty finite in-bounds regions and aggregate project budget. Previous schema-4 projects without references remain supported.

### Main-screen detection (introduced in 1.1.0-dev.5; updated in dev.10)

- Detect this photo / Detect all photos use the selected type’s pinned reference and current detection settings without opening the dialog. No reference or pending photo import disables both actions.
- All photos means the complete image list, including completed photos, processed sequentially in list order. Existing overlaps of any type are excluded after applying the chosen replacement rule. New rectangles carry `needsReview:true` and `autoPending:true`; successfully checked photos become incomplete.
- One Undo reverses the whole run, including additions, replacements, detection checks and completion changes. A successful zero-result or duplicate-only photo still records an unreviewed check and participates in that transaction.
- Show progress, filename, added/removed counts, per-photo results and a Stop action. Stop retains processed photos’ changes; the active photo cannot commit late results. Bad images are reported and skipped; inference/runtime errors stop the run.
- Lock editing, navigation, imports and hidden toast actions during processing. Reject stale project/image/model/reference ownership before committing. Release worker/bitmaps/Blob URLs on finish, cancellation and page navigation.
- Pinned examples, resulting markers and detection checks persist through existing draft/viewer flows. Transient progress reports and the selected rerun mode do not persist.

### Photo review (introduced in 1.1.0-dev.6; updated in dev.10)

- When the current photo contains review flags or unreviewed detection checks, show its flagged-marker count and Mark this photo reviewed beside the photo workflow. The action clears all review flags and replacement eligibility and reviews all checks in that photo, including hidden and other types, with one Undo/Redo transaction and autosave. Counts, geometry, other photos and completion remain unchanged. No-op actions preserve history/redo; inference blocks review edits.
- Pin/unpin immediately synchronizes the main-screen reference count, action availability and history controls. New local examples must be pinned to reuse them outside the dialog.

### Editing pinned examples (1.1.0-dev.7)

- Add / edit examples opens the saved 640 px source snapshot with a mutable copy of the pinned boxes. Display and drawing use snapshot coordinates, independent of target rotation or source-photo existence. Detection and candidate application are unavailable during editing.
- Save replaces the category reference as one Undo transaction; Discard, dialog close or stale loading never changes the saved reference or any count. Saving no changes preserves history. Clearing all boxes requires adding at least one valid box before saving.
- Existing count markers are hidden by default in the detection preview, with an explicit dashed-marker display toggle. Fixed-mode guidance explains how to add examples or unpin/start over on another photo. Duplicate-only results explain why they cannot be added again.

### Selecting and adjusting examples (1.1.0-dev.8)

- Both unpinned current-photo examples and the pinned-reference draft editor provide explicit Add and Select / edit modes. Add draws a new example; Select / edit selects an existing example from its canvas box or numbered list control without creating a box.
- Show the selected example distinctly. Delete affects only that selected example and is disabled when nothing is selected. Selecting another example does not change any geometry or count.
- Drag inside the selected box to move it; drag one of its four corner handles to resize it. Keep positive-size geometry inside the image at all supported rotations. Pinned-reference editing continues to use the saved snapshot at rotation zero.
- Selecting an example fills the left/top/right/bottom percentage bounds for the displayed image. The numeric action updates that selected example in Select / edit mode and adds an example in Add mode. Validate finite values within 0–100%, ordered edges and valid size before committing; invalid input leaves the box unchanged. Keep keyboard-accessible selection, deletion and numeric controls.
- Pointer cancellation, lost capture and the start of a multitouch gesture discard the pending add/move/resize. Late pointer events must not commit an abandoned gesture. Examples, counts, saved references and project history remain unchanged by cancellation.
- Edits to a pinned reference remain a temporary copy until Save example changes. Discard, Escape, dialog close and stale ownership discard the draft. A changed, valid save is one Undo/Redo transaction; an unchanged save creates no history. At least one valid example is required to save.
- Unpinned examples remain local to the dialog until explicitly pinned. Example editing never adds count markers. Model assets, dependencies, the project schema and storage identifiers are unchanged.
- Acceptance checks cover local and pinned examples, canvas/list selection, selected-only deletion, all four handles, numeric updates, pointer cancellation/multitouch, rotated targets, save/discard/close, Undo/Redo and draft/viewer round trips. Desktop browser, direct-file and physical Android results must be recorded separately; automated checks alone do not establish those passes.

### Example-preview zoom and pan (1.1.0-dev.9)

- Local examples and pinned-reference drafts support 1–8× preview zoom. Pinch keeps the image point beneath the gesture anchored; two-finger movement pans the view. **Pan view** provides one-pointer panning without adding or editing a box. Choosing Add or Select / edit exits Pan view.
- Keep **−**, **+**, the zoom level and **Fit** beside the preview at desktop and mobile widths. Each button step divides or multiplies zoom by 1.5 within the limits; Fit restores the whole-image view. Controls support keyboard activation. Corner handles retain a fixed CSS size as the image zooms.
- Reuse the same viewport transform for image rendering, overlays and pointer-to-image coordinates. Add, select, move, resize and numeric bounds continue to use normalized source-image geometry at every rotation. View changes never modify boxes, the saved PNG, counts, inference input or project history.
- A second pointer abandons any pending add/move/resize while retaining the selected example, then starts the view gesture. Extra pointers, cancellation and surviving/late pointer events cannot commit an abandoned edit.
- Zoom/pan are temporary and are not saved in drafts or exports. Reset the view on dialog open/close, source changes, entering/saving/discarding pinned-reference editing, pin/unpin and next-photo transitions. Switching between Add and Select / edit keeps the current view.
- Acceptance checks include magnified small-box edits, anchored pinch/two-finger pan, limits/Fit, pointer cancellation, source-boundary resets and unchanged saved data. Record physical Android touch tests separately from desktop pointer simulation and narrow-width layout checks.

### Photo status, review completion and safe reruns (1.1.0-dev.10)

- Derive status in this order: any flagged marker or unreviewed detection check → **要確認 / Needs review**; completed → **完了 / Complete**; any marker or reviewed detection check → **作業中 / In progress**; otherwise → **未検出 / Undetected**. A legacy empty photo has no inferred detection history. Show status and flagged-marker count in thumbnails and the current-photo bar, with per-status photo totals in the summary. Use text and accessible labels, not color alone.
- **確認完了して次へ / Review complete & next** clears all marker review flags and `autoPending` fields, marks every photo check reviewed and sets completion in one history transaction. Navigate to the next incomplete photo in list order, wrapping once and skipping the current photo. If none remains, stay on the photo and announce completion. Undo/Redo restores the photo data; review-only remains a separate action that does not complete a photo.
- The main-screen `quickMode` control defaults to **Append**. **Replace unreviewed auto results** removes only markers in the captured selected category where `autoPending === true && needsReview === true`. Preserve manual markers, other types, reviewed/edited automatic markers and older-version detections without this explicit field. Explain this legacy protection beside the mode control and in Help.
- Only new main-screen quick-detection markers receive `autoPending:true`. Committed moves, resizes, category changes and individual review toggles remove eligibility; reflagging never recreates it. Photo-level review also removes it. Cancelled edits leave it unchanged. Undo can restore the prior field with the prior geometry/review state.
- Complete inference and validate its full result before a per-photo atomic replacement/addition. Filter duplicates against the retained markers and accepted new candidates. A valid zero-result replacement may remove eligible old results. Cancellation, failure or malformed output preserves that photo; reject truncated results in replacement mode so partial output cannot erase old results.
- Keep schema version 4 and the existing storage identity. Optional `image.detectionChecks` contains at most one `{categoryId, detectedAt, reviewed}` record per category. Each successful quick detection updates that category's timestamp and sets `reviewed:false`, even if no markers were added. Validate referenced categories, timestamps and boolean fields on import; preserve checks and eligible marker fields in history, drafts and viewer round trips. Removing a category removes its checks and protects reassigned markers.
- Acceptance checks cover all four statuses, zero/duplicate-only review, wrap/last-photo behavior, hidden/other types, both rerun modes, protected old/manual/edited results, cancelled edits, truncated/malformed/error/cancelled inference, one-step run Undo/Redo, draft/viewer round trips and Japanese/English keyboard/mobile controls. Dependencies, model assets, offline behavior and one-file distribution are unchanged.
