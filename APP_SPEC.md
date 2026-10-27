# APP_SPEC.md — Image Counter EX / 画像カウンター EX

## 1. Product identity

- **Name:** Image Counter EX / 画像カウンター EX
- **Version:** 1.1.0-dev.21
- **Repository:** `ttomohisa/htmlapps-image-counter-ex`
- **Distribution:** `dist/index.html`, `dist/index.self-extract.html`, and the tracked readable alias `image-counter.html`
- **Purpose:** Count objects in photos manually or with explicitly reviewed local detection candidates, without uploads.
- **Primary users:** People doing inventory, part counting, inspection, field surveys, photo-based checks, and any task where double-counting or losing the current position is a problem.

## 2. Product principles

1. **Manual counting first.** All automatic-detection actions append unreviewed markers or replace eligible unreviewed automatic results through the same workflow. Every successfully processed photo requires human review, including zero-result runs, before photo completion.
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
10. Use **Save** to save work as HTML or export a ZIP containing CSV files with optional annotated JPEG images. Resume from **Open work** on the start screen or save dialog.

## 4. Functional requirements

### Images and camera

- Accept one or multiple image files. Preserve recognized embedded raster formats unchanged. For a browser-decodable format such as SVG that is not permitted in saved projects, convert the selected image locally to PNG before adding it; preserve the original filename, format and byte-size metadata.
- Validate positive safe intrinsic dimensions and the converted payload. New rasterization is limited to 20 megapixels and 16,384 pixels per axis; reject failed or oversized conversions without adding a partial image record. Validate the candidate project against the same image-plus-metadata budget used for saved work before inserting each photo.
- Maximum 30 images per project.
- Maximum 35 MiB per input/stored image and 220 MiB per in-memory project, including embedded images and metadata.
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
- Enter Review after a main-screen run with at least one successfully processed photo, including successful zero-result photos and a run stopped after partial success. Failed or cancelled work with no successful photo must not cause a stale transition in another project.
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
- Review and complete an image with the toolbar's **Review complete & next**. The **Project → Photo review** controls also allow completion without navigation, reopening a completed photo, or clearing review flags without changing completion.
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
- Project summaries, all exports, **Detect all photos**, **Next incomplete**, **Review complete & next** retain their full-project scope. These actions may explicitly select a photo outside the filter; keep that photo visible with the same notice.
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
- Capture the project and compression settings for each autosave. A project replacement or newer save invalidates older preparation, cache updates and status/error reporting; an old photo decode must never borrow images from the new project or overwrite its save state.
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
- Capture the project, display visibility and output filename when ZIP export starts. CSV and annotated JPEGs must use that same snapshot even if the user edits or opens another work while encoding. Export image decoding must not read or overwrite another project's live image cache.
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

- In every mode, use a photo-first workspace with one nonmodal inspector whose panels are **写真 / Photos**, **検出 / Detection** and **作業 / Project**. Above 900 px, the inspector occupies a 300 px right column and scrolls independently. A photo-header toggle explicitly reads **パネルを開く / Open panel** when closed and **パネルを閉じる / Hide panel** when open; it restores the panel after the × close action. Keep its visible label, accessible label, title, `aria-expanded` and `aria-controls` consistent. At 900 px and below, the panel temporarily replaces the canvas working area, with **写真に戻る / Return to photo** restoring the photo. Panels switch rather than adding a settings stack above the canvas.
- Photos owns filtering, matching counts, list-only detection, thumbnails and photo management. Detection owns saved-example editing, sensitivity, detection regions, rerun behavior and current/all-photo detection. Project starts with **この写真の確認 / Photo review** for standalone completion/reopening and clearing review flags, then owns the title, totals, type management and display/storage settings. Current-photo detection is also a direct canvas-toolbar action. Without a reference, label that action as setup and open the example editor; once examples are saved, run detection directly. Existing-example editing stays in Detection rather than duplicating it in the toolbar.
- Keep filename/status/count, panel access and Previous/Next in the photo header. The action row groups mode controls, detection, **Review complete & next** and a quiet **Save** button. Emphasize detection outside Review and **Review complete & next** in Review; retain the same handlers and completion/Undo semantics. Show the excluded-current filter notice in canvas view too. Keep the category dock, memo and marker popovers. The context row contains Review selection controls only and disappears outside Review, rather than retaining a separate completion row.
- Inspector open/selected-panel state is temporary and scoped to the active project. Reset it on accepted project replacement, preserve it across same-project edits and language changes, and omit it from drafts, saved work and exports. Cancel unfinished marker gestures before layout/panel transitions or responsive changes; never recreate the cached canvas/stage or duplicate IDs.
- Keep quick-detection progress and Stop outside inert workspace roots. New controls obey existing processing/import/modal guards. Repair focus only if its previous owner becomes hidden, without taking it from another modal or control; dialog launchers remain reachable after resize. Escape may close the inspector only when a native dialog, editor or input does not own it. Support normal keyboard navigation and panel-selector keys.
- Smartphone usage is a first-class workflow, not a reduced desktop layout.
- Mobile must avoid horizontal page scrolling at 390 px and remain usable from 320 px upward. Type names, including unbroken names up to 40 characters, must wrap within summary rows instead of widening the page.
- Mobile top controls clearly show **Review / Point / Rectangle / Move**. Keep Review submodes, selection count, Clear selection and Delete selected near the canvas and reachable at 320 px and 390 px in Japanese and English.
- Keep the photo filter, matching/total count, reset and empty state beside the thumbnail strip in Photos. Keep the excluded-current notice visible in the photo workspace too. Controls and navigation must fit Japanese at 390 px and English at 320 px without page-level horizontal overflow, with visible focus and an accessible select label.
- The canvas includes a low-profile translucent type-switching dock along its lower edge, showing type color/name/count and allowing one-tap switching without leaving the image. The dock can be minimized to a small corner control when it covers something that must be counted.
- On smartphone widths, the old duplicate type-switching area below the canvas is hidden; type management remains available from the canvas `+` button and Project, with a bottom-bar shortcut outside Review.
- Type switching is one tap.
- Mobile fixed bottom controls provide **Undo / Redo / Previous photo / Next photo / Save** in Review, and **Undo / Redo / Add image / Add or manage type / Save** in Point, Rectangle and Move. Detection and **Review complete & next** remain beside the photo; Save uses the bottom bar without a duplicate mobile toolbar button. Desktop **Save** opens the same save/export dialog.
- When the phone inspector is open, its full-width Photos / Detection / Project tabs stay at the top and the bottom bar switches to **Return to photo / Undo / Redo / Save**. Hide photo-navigation and add/type actions until the photo is visible again. Return follows processing/import/modal guards and repairs focus without changing work data.
- Project groups the current photo name and review actions, totals, work name, collapsed **Display & correction**, and storage. Type totals are expandable. Project text controls have explicit content-sized widths and at least 44 px touch height on phones; do not apply obsolete icon-only widths to them.
- Undo/Redo must be easy to reach on both desktop and mobile.
- The canvas has no competing completion button. Standalone completion and reopening remain in **Project → Photo review**, separate from the toolbar's review-and-advance action.
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

- Automatic counting without user review.
- OCR-based counting.
- Cloud collaboration or shared server projects.
- XLSX export (planned for a later version).
- Merging existing markers automatically. Replacement is limited to explicitly eligible, unreviewed automatic results.

## 10. Acceptance criteria

- In the photo workspace, the header spans the same full viewport width as the workspace, with consistent outside gutters; right-align toolbar actions to the photo frame edge on wide desktops. Keep setup reachable at 320 px.
- Closing the inspector with × or an eligible Escape leaves the photo-header **Open panel** action reachable. Reopening retains the selected panel in the same project and updates its visible/accessible state. Verify Japanese and English, keyboard focus, busy/import guards, and header readability at 320 px without horizontally overflowing the page.
- Outside Review, no empty review-context row or canvas completion overlay remains. Review still exposes selection controls, and standalone completion/reopening and review-only clearing remain available in Project with their original guards and Undo behavior.
- Detection controls and their toolbar replica refresh together at photo-import start and completion (including errors), selected-type/reference changes and history restoration. Without a saved reference, the current-photo action opens example setup with an explicit setup label. All/list detection still requires saved examples. Explain loading/running/no-photo/empty-filter restrictions; an empty filter does not disable current/all-photo detection. Keep real disabled controls for unavailable operations and descriptive accessible text.
- No model upload, model restore, backend or precision controls are exposed. Use the unchanged built-in compact model with WASM / FP32. Keep user-meaningful sensitivity, per-photo region and rerun choices in the Detection inspector.
- Save & detect validates and commits examples before closing the editor and invoking the shared current-photo detection path. Failed/empty/stale saves neither close nor start detection. A valid unchanged save can continue without a history entry. Cancel/close during saved-reference loading or replacement leaves the saved reference intact; a late load cannot reopen or overwrite a newer editor.
- Add a mixed SVG/raster project, register and edit examples, detect all photos, review, save with and without photo compression, and reopen the saved work. Newly selected SVGs must enter the project as validated PNGs; raw SVG in legacy drafts/work files remains rejected. Verify unsupported dimensions, canvas failure and aggregate overflow leave the active project valid.

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
- Successful quick detection, including zero results and a stopped run with earlier successful photos enter Review. Selection UI is temporary and absent from draft/viewer/CSV data.
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
- ZIP output retains its starting filename, markers, image data and visibility across edits or work replacement during asynchronous rendering. A late old-image decode cannot replace the active work's cache, including when image IDs are reused.
- Cancelled point, rectangle, move, and corner-resize actions leave counts, geometry, completion, history, redo, and autosave unchanged at 0/90/180/270 degrees in portrait and landscape. Normal release remains undoable.
- Repository checks run camera, pointer/cancellation, ZIP, language, restore-ownership, Help/header, type-dialog focus, and paired-dialog return regressions against source, readable, root-alias, and self-extract payload variants.
- Viewer can download current JPEG and ZIP.
- Viewer HTML can be imported back into the main app with images and marker data intact.
- At 320 px and 390 px viewport widths, the application has no page-level horizontal overflow; Review controls, the canvas type dock and mobile bottom bar remain usable in Japanese and English. Physical touch results are recorded separately from viewport checks.
- Both release variants retain their startup notice until ready; the self-extract stages describe the work actually in progress. Verify stage visibility under throttled loading separately from Node decoding measurements.


## UI / UX layout notes

- The single inspector switches Photos / Detection / Project; its panels do not stack above the photo. Project groups photo-review actions, the title, combined current image/project summary, marker display and collapsed work-data controls. Reduce repeated status and nested cards while retaining readable text and usable touch targets.
- Completion remains visible in the photo header and thumbnails. Use the toolbar for review-and-advance and Project for standalone completion/reopening or review-only clearing. Image correction remains in Project. Detection progress and Stop remain outside the inert editing surface.
- Image notes open without shifting the page layout and auto-save while typing. The memo icon is the only action at the upper-right of the canvas. On desktop the memo floats at the lower-right of the canvas and its header can be dragged to reposition it within the canvas area; on mobile it opens directly below the canvas. A note indicator remains visible when content exists.
- Image deletion is available with photo management in Photos, is disabled for the last remaining image, and always uses the existing confirmation dialog.

- Persistent canvas instruction bubbles are not shown during normal counting.

## Brand icon consistency

- Brand backgrounds use #16624f with corner radii equal to exactly 25% of each background axis. Preserve foreground artwork, placement, and existing canvas padding across SVG assets, app headers, and embedded favicons.

## Import validation and spreadsheet safety

Viewer imports accept the native app identifier and schema version 4 only; local unversioned drafts retain compatible optional defaults. Validate types, unique IDs, category references, finite geometry/settings/dates, embedded raster signatures, 30-image count, 35 MiB actual bytes per image, and 220 MiB aggregate image-plus-metadata budget before committing. Reject external image URLs and SVG. Pre-read HTML ceiling is 661 MiB to accommodate JSON/base64 expansion and the viewer shell. Failed validation must preserve active work and the restore offer. Logical image dimensions remain independent of compressed dimensions. Previously oversized or SVG-based exports/drafts are not accepted under the stricter policy.

Editor and viewer CSV use the same serializer: formula-like text receives a leading apostrophe before CSV escaping; actual numbers keep numeric meaning, and project text remains unchanged. The apostrophe may be visible in spreadsheet programs. Repository checks exercise these boundaries and normal native roundtrips in all four source/release variants.

Compatibility exception: the former native resize handler could create an exact 0.003-wide/high rectangle extending past the right/bottom image edge by at most 0.003. Import/restore moves only that affected origin inward, retaining its minimum size. Out-of-range origins and other oversized rectangles still fail validation. New resizes keep the minimum rectangle fully inside the image.

## Local visual detection — unified workflow (1.1.0-dev.17)

### Example setup and editing

- The dialog edits examples only; it contains no inference, candidate-selection or model-settings workflow. One to twenty valid examples are required. Examples never create counts.
- Without saved examples for the selected type, the current-photo action opens setup. Draw individual objects and choose **Save & detect** to register them and start current-photo detection, or **Save & close** to register them for later. The separate Pin action is removed.
- Each type stores an independent, immutable 640 × 640 letterboxed PNG snapshot with normalized example boxes. It survives source-photo removal, lightweight history and draft/saved-work round trips. CSV contains counts and markers only. Preserve the native app identifier, schema 4 and storage slug `image-counter`.
- Opening saved examples immediately enters a draft editor over the saved source snapshot, at rotation zero and independent of the current target. Save shares the existing PNG and replaces only its boxes. **Use this photo** stages a fresh source and boxes from the current target without deleting the previous saved reference; only a valid save replaces it.
- Save validates snapshot/reference geometry, a nonempty prompt mask and project limits before committing one history/autosave transaction. A valid unchanged save creates no history but can continue to detection. Failed, empty or stale saves remain in the editor and cannot start inference. Distinguish image decoding, invalid project/size limits and invalid example errors; do not label every failure as storage trouble. Validation failures retain the pending boxes and previous saved reference. After successful Save & detect, recheck the captured project/photo/type owner, close the editor, then start the shared detection path.
- Every valid positive-size example must contribute to the model prompt, including small boxes, image-edge boxes and boxes on very wide or tall photos. Keep the existing 80 × 80 mask intervals where nonempty; if an axis collapses during quantization, cover the cell containing that box's center on that axis. Keep the saved box geometry unchanged. This prevents save failures and omitted prompts, without promising better detection accuracy for tiny objects.
- Cancel, Escape, close and stale loading discard pending example changes and retain the saved reference and all counts. Clearing all boxes requires adding at least one valid box before saving. Late image decoding cannot reopen a closed editor or change newer work.
- Imports validate PNG magic/header dimensions, version, 2 MiB snapshot limit, one to twenty finite in-bounds boxes and aggregate project budget. Existing schema-4 projects without references remain supported.

### Selecting and adjusting examples

- Both new examples and saved-reference drafts provide **Add** and **Select / edit** modes. Add draws a new box; Select / edit selects from the canvas or numbered list without creating a box. Show the selected box distinctly; deletion affects only that box and is unavailable without selection.
- Drag inside a selected box to move it or use any of its four corner handles to resize it. Keep positive-size geometry inside the image at every supported rotation. Percentage bounds describe displayed-image coordinates; map them through the existing display/original transform. Saved snapshots use rotation zero.
- Selection fills left/top/right/bottom bounds. In Select / edit, the numeric action updates that example; in Add it adds a new example. Validate finite 0–100% values, ordered edges and valid size before committing. Invalid values leave geometry unchanged. Keep keyboard-accessible selection, deletion and numeric controls.
- Pointer cancellation, lost capture or the start of multitouch abandons the unfinished add/move/resize. Preserve selection and reject surviving/late events from that gesture. Selection and unfinished geometry are temporary and never serialized.
- Support 1–8× zoom with anchored pinch, two-finger pan, **Pan view** for one-pointer panning, adjacent **− / +**, zoom level and **Fit** controls. Buttons scale by 1.5 within limits; Fit restores the whole image. Corner handles retain a fixed CSS size.
- Image, overlays and pointer mapping share one viewport transform. Zoom/pan changes no boxes, saved pixels, counts, inference input or history. Reset the view on dialog/source/reference transitions; switching Add / Select keeps it and exits Pan view.

### Detection and lifecycle

- Use the embedded 6.44 MiB YOLOE-26n automatically with CPU/WASM FP32 computation. Stored FP16 weights do not change compute precision. Remove user-facing model-file, backend and precision settings. The existing embedded assets remain unchanged; WebGPU assets may remain bundled but are not selectable in this workflow.
- ORT assets and model weights decode lazily. Blob module Workers, `wasmBinary`, one WASM thread and `wasm-unsafe-eval` retain `connect-src 'none'`; no external runtime request occurs. Each run receives fresh transferable model bytes.
- **Detect this photo**, **Detect list (N)** and **Detect all photos**, including Save & detect, use the same captured selected-type reference and detection settings. Pending imports or processing block starts. All/list require saved examples, and list also requires matching photos. All includes completed photos; list captures its matching-photo snapshot at start.
- Run phases are ready → loading-runtime → processing → result or error. Reuse one Worker, model session and computed visual prompt within a run; prepare the saved reference once and then process targets sequentially with guarded request IDs. A later run starts fresh.
- The reference pass uses saved-source pixels and the detection pass uses original target pixels, without display brightness/contrast corrections. Preprocessing and candidates retain original-image normalized coordinates, including compressed drafts and all 0/90/180/270-degree displays.
- Sensitivity presets are **Find more** (0.01), **Standard** (0.05, default) and **More selective** (0.25). The labels describe the missed-object/extra-result tradeoff instead of presenting scores as accuracy percentages. NMS IoU > 0.5 suppresses lower-score boxes. Cap results at 1000 and report truncation; reject truncated replacement results.
- Validate complete output, then apply the photo's inclusive center-inside detection region. Existing rectangle overlaps are duplicates at IoU ≥ 0.5 or intersection/smaller-area ≥ 0.8; a point inside a candidate also excludes it. Include hidden/other-type markers and accepted new candidates when checking duplicates.
- New automatic rectangles carry `needsReview:true` and `autoPending:true`. Every successfully processed photo becomes incomplete and receives an unreviewed detection check, including zero or duplicate-only results. Review occurs on the main photo canvas, with no separate candidate Apply action.
- One lazy history transaction covers the entire run's additions, removals, checks and completion changes. **Stop** preserves earlier committed photos and one Undo restores them all. Target decode failures are reported and skipped; runtime/output failures stop the run. Failure or cancellation cannot partially commit the current photo.
- Lock editing, navigation, imports and hidden toast actions while running. Check project/photo/type/model/reference identities before committing. Stop, finish, stale ownership and page navigation terminate the Worker, reject pending work, close untransferred bitmaps and revoke URLs. Returning to a cached page allows another run.
- Show progress, target filename, added/removed counts, per-photo results and Stop outside inert editing roots. Report total elapsed time including preparation. Runtime assets, computed prompts, progress reports, selected rerun mode and temporary example edits never enter project/draft/viewer/CSV data.
- The integrated release remains AGPL v3 with offline license text and public corresponding source. Tiles and cross-run prompt caching remain deferred. See `docs/YOLOE_VALIDATION.md` for measured results and explicitly untested environments; HTTP success does not establish direct file-origin detection.

### Review, status and safe reruns

- Derive photo status in order: flagged marker or unreviewed detection check → **Needs review**; completed → **Complete**; marker or reviewed check → **In progress**; otherwise → **Undetected**. Do not invent legacy detection history. Show text/accessible status beside counts; zero-result checks do not inflate the flagged-marker count.
- Enter Review after any run with a successfully committed photo, including zero results and Stop after partial success. Failed/cancelled work with no success must not trigger a stale transition in another project.
- **Clear review flags** clears all photo flags and replacement eligibility and reviews all checks, including hidden/other types, in one undoable transaction. It preserves counts, geometry, other photos and completion. No-op review preserves history/redo; inference blocks edits.
- **Review complete & next** performs the same review, sets completion and navigates to the next incomplete photo in list order, wrapping once and skipping the current photo. When all are complete, remain on the photo and announce completion. Undo/Redo restores the photo data.
- **Add detections** preserves existing markers. **Replace unreviewed auto results** removes only the selected category's `autoPending === true && needsReview === true` markers whose centers are inside the detection region. Preserve manual, reviewed, edited, other-type, outside-region and legacy detections without explicit eligibility.
- Committed moves, resizes, type changes and review toggles remove eligibility; reflagging never recreates it. Cancelled edits preserve eligibility. Undo restores prior eligibility with prior geometry/state.
- Complete inference and validate the full output before atomically replacing/adding for each photo. Duplicate filtering uses retained markers. A valid zero-result replacement may remove eligible old results; failed, malformed, cancelled or truncated results cannot remove them.
- Optional schema-4 `image.detectionChecks` stores at most one `{categoryId, detectedAt, reviewed}` per category. Every successful detection refreshes its timestamp and sets `reviewed:false`. Validate categories/timestamps/booleans on import; preserve checks and eligibility in history, drafts and saved work. Type deletion removes its checks and protects reassigned markers.

### Detection acceptance checks

- Cover first-time setup, existing-reference edit, save-only and save-and-detect, valid unchanged save, validation failure, close/cancel, staged source replacement, stale asynchronous loading, type switching, Undo/Redo and draft/saved-work round trips. Include small/edge boxes, mixed small and large examples, wide/tall source images and unchanged saved geometry. Check that stale autosave preparation, compression and failure callbacks cannot affect replacement work.
- Cover local/saved examples, canvas/list selection, selected-only deletion, all resize handles, numeric bounds, rotations, anchored pinch/pan, limits/Fit and interrupted/late gestures without changing saved data.
- Cover zero/duplicate-only review, all statuses, hidden/other types, both rerun modes, protected markers, errors/truncation/cancellation, one-step run Undo/Redo, keyboard and bilingual layouts. Record physical Android, browser-width and direct-file checks separately; automated checks alone establish none of them.
