# APP_SPEC.md — Image Counter EX / 画像カウンター EX

## 1. Product identity

- **Name:** Image Counter EX / 画像カウンター EX
- **Version:** 1.1.0-dev.15
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
2. Choose **Point** or **Rectangle** to add counts, **Review** to inspect them, or **Move** to pan.
3. Choose the marker type currently being counted.
4. Place point markers by tapping/clicking, or rectangle markers by dragging around an object.
5. In **Review**, tap existing markers without adding counts. Use single, multiple or range selection to inspect or remove unwanted markers.
6. In Review's **Single** selection, toggle a marker's review flag or choose **Edit** to enter its Point/Rectangle editing mode. Move markers, resize rectangles from their corner handles, or use the contextual type and delete controls.
7. Correct image visibility if needed with brightness, contrast, grayscale, and 90° rotation. The original image data remains unchanged.
8. Check each image, then use **Review complete & next** to clear its review state, complete it and continue to the next unfinished image.
9. Review project-wide totals and per-type totals in **Project**.
10. Use **Save / export** (**Save** on mobile) to save work as HTML or export a ZIP containing CSV files with optional annotated JPEG images. Resume from **Open work** on the start screen or save dialog.

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
- **Review:** selects existing visible markers without adding counts or changing their geometry. In single/multiple selection, dragging pans the image; range selection uses a drag to select markers.
- **Move:** pans the image without adding counts.
- New markers must not immediately open editing controls.
- Selecting one existing marker in a Point/Rectangle editing mode shows type-change, needs-review, and delete controls. Review's **Single** selection shows **Edit** and the needs-review toggle; type-change and single-marker delete controls stay hidden. **Multiple** and **Range** hide the whole popover, even with one selected marker.
- Needs-review is an independent boolean flag on a marker; it must not alter marker type, numbering, or count.
- Flagged point and rectangle markers show a small amber `!` badge and can be unflagged from the same contextual control.
- Existing point and rectangle markers can be moved in Point/Rectangle editing modes. Review requires the explicit **Edit** action, which keeps the selected marker and chooses Point or Rectangle to match its shape.
- Selected rectangles show four resize handles in an editing mode; Review does not expose geometry handles.
- A cancelled pointer action discards a pending point/rectangle or restores the moved/resized marker geometry and prior completion state. It must not add history, clear redo, update the project timestamp, or schedule an autosave. Starting a two-pointer pinch abandons an in-progress marker edit in the same way; extra pointers and late cancelled-pointer events cannot commit it.
- The most recently added marker is visually emphasized briefly.
- Marker numbering is **per marker type**, while project/image totals remain independent.

### Review selection and bulk deletion

- Review offers **Single**, **Multiple** and **Range** selection and enters in Single when chosen directly or after detection. Single selects one existing marker. Multiple toggles each tapped visible marker in the selection. Tapping blank space never adds a marker.
- Range selection adds visible markers whose displayed center lies within the dragged rectangle, including point markers and rectangle centers. Reuse the canvas view transform so selection follows rotation, zoom and pan. Hidden markers and hidden types cannot enter the selection.
- Show selected markers distinctly, the selected count, **Clear selection** and **Delete selected** beside the canvas. Bulk delete is disabled when no eligible marker is selected. **Edit** and the per-marker review toggle are available for the selected marker in **Single**; toggling its flag keeps Review active and does not change geometry.
- Range selection is pending until release. Pointer cancellation, lost capture or a second pointer abandons the unfinished selection without changing the prior selection, marker data, completion, history, redo or autosave. Pinch/two-finger pan remains available; surviving and late events cannot commit an abandoned selection.
- Selection is temporary UI state, scoped to the current project and photo. Clear or prune it on project/photo replacement, mode changes, marker/type hiding or removal, history restoration and detection transitions. Never let a selected ID from another photo, a hidden marker or a stale gesture be deleted.
- Delete only the selected eligible markers in the current photo, in one history transaction and one autosave request. Set that photo's completion to false; preserve every other marker, photo and detection check. Provide immediate Undo without a confirmation dialog. Undo/Redo restores the entire deletion and completion change together. An empty or stale selection does not add history or discard redo.
- Enter Review after a main-screen run with at least one successfully processed photo, including successful zero-result photos and a run stopped after partial success. Applying dialog candidates also enters Review. Failed or cancelled work with no successful photo must not cause a stale transition in another project.
- Review mode, submode, selected IDs and range geometry are not stored in projects, drafts, viewer HTML or CSV. Schema, model assets, thresholds and detection algorithms remain unchanged.

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
- Allow Left/Right arrow keys to move to the previous/next matching image when focus is outside form controls, editable fields and modal dialogs. Preserve native keyboard behavior in the photo filter select.
- Navigate previous/next through the filtered image list and jump directly to a visible thumbnail.
- Mark an image complete from the upper-right area of the canvas.
- Provide **Next incomplete** navigation.
- Editing a completed image makes it in-progress again when count data or image correction changes.
- Show project-wide total marker count, completed image count, needs-review marker count, per-type totals and the number of photos in each status.
- An image with needs-review markers or an unreviewed detection check cannot be marked complete through the ordinary Complete button. Keep the review-marker count distinct from a pending zero-result detection check.

### Photo-status filter

- Place a native select labelled **写真一覧 / Photo list** immediately above the thumbnail strip in the **Photos** inspector, with **All**, **Undetected**, **In progress**, **Needs review** and **Complete** choices. Each option shows its photo count from the full project using the existing `photoStatus(image)` rules, including hidden/other-type review markers and pending zero-result detection checks.
- Show the matching-photo count against the total and **すべて表示 / Show all** to reset to All. When no photos match, show **条件に合う写真がありません / No photos match** while keeping the filter and reset reachable.
- Filtering changes the thumbnail list only; keep the current photo on the canvas even when it no longer matches, with an explicit notice. Filter changes, review/completion changes, edits and Undo/Redo must not automatically navigate away from that photo.
- Previous/Next and Left/Right move only through matching photos in project order without wrapping. If the current photo is excluded, use the nearest matching photo before/after its project position. Disable a direction when no match exists there; both directions are unavailable for an empty result.
- Keep the selected filter as temporary UI state for the live project. Preserve it across same-project edits, status changes, photo additions/removals, Undo/Redo and language changes. Reset to All when a new project, opened work or restored draft is accepted, and after page reload. Failed or cancelled replacement leaves the active filter intact.
- Changing or resetting the filter must not edit project data, counts, completion, history, redo, timestamps or autosave. Do not serialize it in schema 4, drafts, saved work/viewer HTML or CSV.
- Project summaries, all exports, **Detect all photos**, **Next incomplete**, **Review complete & next** and the detection dialog's next-photo actions retain their full-project scope. These actions may explicitly select a photo outside the filter; keep that photo visible with the same notice.
- Guard pending filtered navigation against filter changes, project replacement and stale image decoding. Only a still-current request may commit the photo and its data; a failed decode keeps the previously displayed photo and allows retry.

### Scoped detection (introduced in 1.1.0-dev.14)

- **Detect list (N)** beside the photo filter captures the ordered `matchingPhotos()` snapshot at start. Status changes during detection must not shrink or extend that run. Disable it without matching photos or a pinned reference, and during processing/import. **Detect all photos** still covers every project photo. Both retain the same Worker, Stop, review semantics and single run-level Undo transaction as Detect this photo.
- Each photo optionally stores one normalized `detectionRegion:{x,y,w,h}` rectangle in original-image coordinates; absence means full image. A target-photo editor supports drawing and numeric bounds, clearing to full image, Save and Cancel, with rotated display coordinates mapped through the existing view transform. Outside-region dimming must not change image pixels. Keyboard and touch cancellation must leave unfinished geometry uncommitted.
- Save or clear a changed region in one undoable, autosaved transaction and reopen completion without changing existing markers. Cancel, abandoned gestures and unchanged saves must not add history or discard redo. Guard editor ownership across photo/project replacement.
- All detection paths run inference on the full image, validate the entire raw result, then accept only candidates whose centers lie inside the region, including its boundary. This is a result-acceptance region: it does not improve crop resolution, guarantee better small-object accuracy or promise faster inference. Pinned examples keep their separate saved-source coordinates.
- Replace unreviewed automatic results removes only otherwise eligible markers whose centers are inside the region. Preserve eligible markers outside it and all existing protections for manual, reviewed, edited, other-type and legacy markers. Invalid, cancelled or incomplete results must not remove markers.
- Persist and strictly validate optional finite, positive-size, in-bounds regions in drafts and saved work HTML, including compressed image round trips. Reject malformed regions before replacing work. Older projects default to full-image detection. Keep schema 4, model and runtime dependencies unchanged. Project totals and CSV/JPEG exports include every marker, irrespective of filter or region.

### Undo / Redo

Undo and redo must cover detection-region changes, marker creation, single/bulk deletion, movement, rectangle resize, type changes, visibility/display changes where appropriate, image completion, and supported image correction changes. Review selection alone does not create history.

Undo/Redo must schedule autosave of the restored state, just like direct edits. Empty history stacks do not schedule a save.

### Local draft and storage

- Auto-save project state in IndexedDB. Label this as storage in the current browser/page, separate from a portable HTML work file. Explain that browser-data removal or changing devices can lose access to this copy.
- The previous-work offer belongs to the start screen. Accepting photos, a sample, viewer HTML, or a restored draft retires it; cancelled selection, malformed imports, and initial-image decode failures leave the previous work available.
- **Open work** accepts existing schema-4 viewer HTML from either the start screen or the save dialog. Stage validation and initial image decoding before replacing the active project. If work is already open, confirm replacement of that work and the browser autosave; cancellation and invalid files keep it intact. Check both request generation and project identity before/after confirmation so older requests cannot replace newer work. Photo additions also retain their starting project across decoding and display awaits; late additions or errors cannot affect a replacement project. Delayed startup/restore reads cannot replace newer accepted work.
- Re-render previous-work image/marker counts and timestamps in the selected language.
- Show current project data size, saved draft size, and available browser storage when available.
- Default to compressing the **draft copy only** to WebP to reduce local storage usage.
- Allow draft WebP quality adjustment.
- Restoring a compressed draft must preserve logical image dimensions, markers, categories, notes, completion state, adjustments and optional detection checks/replacement eligibility.

## 5. Export requirements

### Saved work HTML / read-only viewer

- **Save work (HTML)** is the primary save card. Preserve photos, pinned examples, markers, notes, corrections and review/completion state in the existing schema-4 HTML format. Opening the file directly remains read-only; editing resumes through **Open work** in the app. No model or detection runtime is included in the work file.
- Capture project data and the edited filename at Save, before asynchronous image preparation. Disable duplicate Save requests until completion, and re-enable after success/failure. Compression must use that captured copy and must not consume or modify a newer project’s image cache.
- One self-contained HTML file.
- Optional WebP compression for embedded viewer photos with adjustable quality. Pinned reference snapshots remain unchanged. Explain that turning compression off preserves photo detail.
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

- In every mode, use a photo-first workspace with one nonmodal inspector whose panels are **写真 / Photos**, **検出 / Detection** and **作業 / Project**. Above 900 px, the inspector occupies a 300 px right column and scrolls independently; it can close and reopen. At 900 px and below, **写真・設定 / Photos & tools** opens it in place of the canvas working area, with **写真に戻る / Return to photo** restoring the photo. Panels switch rather than adding a settings stack above the canvas.
- Photos owns filtering, matching counts, list-only detection, thumbnails and photo management. Detection owns pinned-example setup, detection regions, rerun behavior and current/all-photo detection. Project owns the title, totals, type management and display/storage settings. Current-photo detection is also a direct canvas-toolbar action, visibly unavailable without a reference. Keep setup discoverable from that area and Save reachable outside the inspector.
- Keep filename/status/count, mode controls and Previous/Next beside the photo. Show the excluded-current filter notice in canvas view too. Keep the category dock, memo, marker popovers, Review selection and ordinary Complete distinct from **Review complete & next**. Review uses a compact context row with selection actions when meaningful.
- Inspector open/selected-panel state is temporary and scoped to the active project. Reset it on accepted project replacement, preserve it across same-project edits and language changes, and omit it from drafts, saved work and exports. Cancel unfinished marker gestures before layout/panel transitions or responsive changes; never recreate the cached canvas/stage or duplicate IDs.
- Keep quick-detection progress and Stop outside inert workspace roots. New controls obey existing processing/import/modal guards. Repair focus only if its previous owner becomes hidden, without taking it from another modal or control; dialog launchers remain reachable after resize. Escape may close the inspector only when a native dialog, editor or input does not own it. Support normal keyboard navigation and panel-selector keys.
- Smartphone usage is a first-class workflow, not a reduced desktop layout.
- Mobile must avoid horizontal page scrolling at 390 px and remain usable from 320 px upward. Type names, including unbroken names up to 40 characters, must wrap within summary rows instead of widening the page.
- Mobile top controls clearly show **Review / Point / Rectangle / Move**. Keep Review submodes, selection count, Clear selection and Delete selected near the canvas and reachable at 320 px and 390 px in Japanese and English.
- Keep the photo filter, matching/total count, reset and empty state beside the thumbnail strip in Photos. Keep the excluded-current notice visible in the photo workspace too. Controls and navigation must fit Japanese at 390 px and English at 320 px without page-level horizontal overflow, with visible focus and an accessible select label.
- The canvas includes a low-profile translucent type-switching dock along its lower edge, showing type color/name/count and allowing one-tap switching without leaving the image. The dock can be minimized to a small corner control when it covers something that must be counted.
- On smartphone widths, the old duplicate type-switching area below the canvas is hidden; type management remains available from the canvas `+` button and Project, with a bottom-bar shortcut outside Review.
- Type switching is one tap.
- Mobile fixed bottom controls provide **Undo / Redo / Previous photo / Next photo / Save** in Review, and **Undo / Redo / Add image / Add or manage type / Save** in Point, Rectangle and Move. **Review complete & next** remains in the context row beside the canvas. Desktop uses **Save / export** for the same save dialog.
- Undo/Redo must be easy to reach on both desktop and mobile.
- The complete-image control sits around the upper-right of the canvas.
- Needs-review state must be visible in the marker, image list/current-image status, and project summary without turning it into a separate marker type.
- Advanced display settings remain discoverable but do not dominate the counting workflow.
- Destructive actions use confirmation where data loss is meaningful; single-marker and selected-marker deletion are immediately undoable.
- Keyboard focus is visible and motion respects `prefers-reduced-motion`.
- Header language and Help controls remain visible and reachable from 320 px upward; the title can truncate while the version and action controls retain space.
- Help is titled **使い方と注意事項 / How to use & notes**. Initially show three quick-start steps and four short notes covering AI errors/misses and manual review, browser-autosave loss risk and HTML saving, local/offline privacy, and initial loading/preparation time. Practical controls and saving tips stay in a default-collapsed details section. Preserve license/source markup and translations, dynamic license loading, and build markup/IDs/content exactly. A non-shrinking header and flexible, scrollable body share the dialog height. Native Escape, Close button, backdrop dismissal, and the modal background-scroll lock remain available. Do not restore redundant navigation or implementation-audit prose.
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

- At 1360 × 900, verify the ordinary photo workspace starts its canvas within approximately the top 220 CSS px, gives it at least 55% of viewport height, and requires no document-level vertical scroll for normal counting; the inspector may scroll.
- At Japanese 390 × 844 and English 320 × 740, verify the canvas starts within approximately the top 260 CSS px and remains usefully tall without document-level horizontal overflow. The inspector temporarily replaces the canvas rather than stacking above it. Keep bounded inspector/memo scrolling; short or landscape screens may scroll when needed to preserve usable controls.
- Verify all four modes, inspector panels, close/return controls, keyboard focus and panel keys, native dialogs across resize, gestures interrupted by layout changes, language changes, project replacement and same-project edits around the 900 px breakpoint. Record physical touch checks separately from viewport checks.
- Verify Help's three steps, four notes and default-collapsed practical tips in both languages, with license/source/build contents and dynamic nodes unchanged. Check opening/closing details, Help scrolling and existing 760 px build visibility separately from the workspace breakpoint.
- Detect list processes exactly the matching-photo snapshot captured at start, including status changes, empty lists, Stop and one-step Undo; Detect all, totals and exports remain project-wide.
- Check region drawing/numeric bounds and center inclusion at 0°, 90°, 180° and 270°, outside-marker preservation in Replace, Save/Cancel, interrupted gestures, exact Undo/Redo, stale ownership, strict import validation and compressed draft/work round trips. Old projects use the full image.

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
- Review taps and single/multiple-mode drags leave counts and geometry unchanged; Edit preserves the selected marker and opens the matching Point/Rectangle mode.
- Multiple toggles and additive range selection use only visible markers in the current photo at 0/90/180/270 degrees, including zoomed/panned views. Cancelled or interrupted range gestures leave prior selection and project/history state intact.
- Bulk deletion removes only the visible selected markers in the current photo, preserves detection checks and other photos, clears completion and supports one-step Undo/Redo and autosave. Empty/stale selections are no-ops; hidden markers, mode/photo changes and restored history cannot leave actionable stale selection.
- Successful quick detection, including zero results and a stopped run with earlier successful photos, and dialog application enter Review. Selection UI is temporary and absent from draft/viewer/CSV data.
- Per-type numbering and category switching work.
- Multi-image totals, needs-review totals, and completion state work.
- Photo filtering uses the shared status precedence and full-project option counts, including flagged completed photos and zero-result pending checks. Empty results and a current photo outside the filter are clearly explained without an automatic photo switch.
- Filtered Previous/Next and Left/Right skip nonmatching photos in project order, choose the nearest match from an excluded current photo, stop at each end and preserve native select keyboard behavior. Filter/project changes and decode failures cannot commit stale navigation.
- Same-project edits and Undo/Redo update filter counts while preserving the filter; accepted new/open/restored work and reload reset it to All. Filtering alone changes no saved data, history, redo or autosave; summaries, exports and full-project detection/completion navigation remain complete.
- Needs-review can be toggled on both point and rectangle markers; ordinary completion is blocked until current-image review flags and detection checks are reviewed.
- Camera capture presents a review before image acceptance.
- Draft size/compression controls work when IndexedDB storage is available.
- Image corrections persist into viewer/export data.
- Default app ZIP and viewer ZIP contain CSV + JPEG images with needs-review flags preserved in CSV and annotated images; unchecking the editor image option produces a two-CSV ZIP with identical CSV bytes.
- Cancelled point, rectangle, move, and corner-resize actions leave counts, geometry, completion, history, redo, and autosave unchanged at 0/90/180/270 degrees in portrait and landscape. Normal release remains undoable.
- Repository checks run camera, pointer/cancellation, ZIP, language, restore-ownership, Help/header, type-dialog focus, and paired-dialog return regressions against source, readable, root-alias, and self-extract payload variants.
- Viewer can download current JPEG and ZIP.
- Viewer HTML can be imported back into the main app with images and marker data intact.
- At 320 px and 390 px viewport widths, the application has no page-level horizontal overflow; Review controls, the canvas type dock and mobile bottom bar remain usable in Japanese and English. Physical touch results are recorded separately from viewport checks.
- Both release variants retain their startup notice until ready; the self-extract stages describe the work actually in progress. Verify stage visibility under throttled loading separately from Node decoding measurements.


## UI / UX layout notes

- The single inspector switches Photos / Detection / Project; its panels do not stack above the photo. Project groups the title, combined current image/project summary, marker display and collapsed work-data controls. Reduce repeated status and nested cards while retaining readable text and usable touch targets.
- Completion remains visible on the canvas and thumbnails, and correction opens from the canvas toolbar. Detection progress and Stop remain outside the inert editing surface.
- Image notes open without shifting the page layout and auto-save while typing. The memo icon sits beside Complete at the upper-right of the canvas. On desktop the memo floats at the lower-right of the canvas and its header can be dragged to reposition it within the canvas area; on mobile it opens directly below the canvas. A note indicator remains visible when content exists.
- Image deletion is available with photo management in Photos, is disabled for the last remaining image, and always uses the existing confirmation dialog.

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
- The compact 6.44 MiB YOLOE-26n model is embedded and selected by default (CPU / FP32). No model picker is required. Advanced settings can load a custom model or restore the built-in model. Model weights inflate lazily on Detect; each Worker receives a fresh transferable copy. The integrated release is AGPL v3 with offline license text and public corresponding source. Within-batch prompt reuse is described below; cross-run prompt caching and tiles remain deferred.
- See docs/YOLOE_VALIDATION.md for measured results and explicitly untested environments; direct file-origin detection is not considered verified solely by a successful build or HTTP test.

### Reusable examples (1.1.0-dev.4)

- Pin examples for the active counting type; show cropped thumbnails, source filename and current target filename. Unpin is undoable. Snapshots are immutable and shared by lightweight history.
- Run the prompt-extraction pass on the saved reference snapshot and the detection pass on the current target photo. Target coordinates and duplicate suppression always use the target photo. Rotation and display corrections do not change saved source pixels.
- After reviewing a result, Add and detect next applies accepted candidates as one undoable batch to the current image, then detects the next image in list order. Zero accepted candidates allow proceeding without history changes. Each new result requires review; images are not marked complete automatically.
- Image loading, inference, cancellation and late callbacks are guarded by project, image, category, generation, model and reference identity. Cancel/close during transition must not start a later detection.
- Imports validate snapshot PNG magic/header dimensions, version, payload limit (2 MiB), one to twenty finite in-bounds regions and aggregate project budget. Previous schema-4 projects without references remain supported.

### Main-screen detection (introduced in 1.1.0-dev.5; updated in dev.11)

- Detect this photo / Detect list (N) / Detect all photos use the selected type’s pinned reference and current detection settings without opening the dialog. No reference or pending photo import disables these actions; Detect list also requires a nonempty matching list.
- All photos means the complete image list, including completed photos, processed sequentially in list order. Existing overlaps of any type are excluded after applying the chosen replacement rule. New rectangles carry `needsReview:true` and `autoPending:true`; successfully checked photos become incomplete.
- One Undo reverses the whole run, including additions, replacements, detection checks and completion changes. A successful zero-result or duplicate-only photo still records an unreviewed check and participates in that transaction.
- Show progress, filename, added/removed counts, per-photo results and a Stop action. On completion or interruption, show total elapsed duration including preparation. Stop retains processed photos’ changes; the active photo cannot commit late results. Bad target images are reported and skipped; inference/runtime errors stop the run.
- Reuse one Worker, model session and computed reference prompt within each main-screen run. Prepare the reference once and process targets sequentially with guarded request IDs. Finish, Stop, runtime failure, stale ownership and page navigation terminate the Worker and release transient bitmaps/URLs/runtime state. A later run starts fresh; dialog detection keeps its one-shot lifecycle. No model, precision, threshold, preprocessing or schema change is implied by reuse.
- Lock editing, navigation, imports and hidden toast actions during processing. Reject stale project/image/model/reference ownership before committing. Release worker/bitmaps/Blob URLs on finish, cancellation and page navigation.
- Pinned examples, resulting markers and detection checks persist through existing draft/viewer flows. Transient progress reports, elapsed duration, computed prompts, runtime state and the selected rerun mode do not persist.

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
