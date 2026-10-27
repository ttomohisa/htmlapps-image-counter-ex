# Architecture

## Overview

### EX local detection

The editable template separates pure geometry/filtering in `AUTO:CORE`, inference in `AUTO:ENGINE`, and example-editor state in `AUTO:UI`. All user-facing detection uses `QUICK:CORE`, `QUICK:RUNNER` and `QUICK:UI`. The dialog edits saved examples; it no longer has a separate inference/candidate-application path. The existing `image-counter` schema identifier and storage slug remain compatible.

Each run lazily decodes the built-in compact model and CPU/WASM runtime, then reuses one Worker/session/reference prompt for its captured photo list. The first pass extracts a 512-float VPE from OR-combined boxes on the saved reference; the second uses that VPE with a zero mask to detect each target. A reference is a lossless 640 × 640 letterboxed PNG with normalized boxes, independent of its original photo. Bitmaps transfer to the Worker and close after use. Saved projects contain no model-derived embeddings. Output returns to normalized original-image coordinates before NMS; the main thread validates ownership and the full result before applying it as unreviewed markers.

`autoPromptMask()` preserves the existing ceil-based intervals on the 80 × 80 prompt grid. A positive-size example can nevertheless collapse to an empty interval, depending on position or letterboxing. Only a collapsed axis falls back to the cell containing the transformed box center, clamped to 0–79. Each valid example then contributes to the OR mask even when larger examples are also present. This rule is shared by save validation and inference; it does not expand saved boxes, change the model or establish improved small-object accuracy.

Stop, finish, stale ownership and page navigation terminate the Worker and revoke module URLs. Each photo commits additions/removals/checks/completion atomically after duplicate filtering against retained markers and accepted candidates. Positive imported rectangles smaller than the new `.003` drawing minimum still participate in duplicate checks. One lazy history transaction covers a run; valid zero results still record an unreviewed check.

ORT Web remains embedded through `dependencies.json`: WASM 1.29.0 bundle + threaded WASM with `numThreads=1`, plus the retained WebGPU 1.27.0 assets. The UI offers no model, backend or precision controls and always selects the built-in model with WASM / FP32. `wasmBinary` avoids fetch under `connect-src 'none'`; `wasm-unsafe-eval` permits WASM compilation without JavaScript eval. The model is a pinned `source: local` dependency with repository-confined paths and SHA-256 checks. `bytesAsync` supplies fresh transferable copies from its lazily decoded cache. Tiles and cross-run prompt caching remain deferred. See `docs/YOLOE_VALIDATION.md` for actual test coverage.

The repository separates editable source from the release artifact:

```text
app.config.json              Product metadata
APP_SPEC.md                  Product behavior and acceptance contract
dependencies.json            Exact npm packages and files to embed
components/                   Reusable source snippets copied/adapted into apps
src/index.template.html      Editable application source
build-standalone.ps1         Dependency fetch, hash, embed, and build
scripts/verify-standalone.ps1 Static release checks
image-counter.html           Tracked readable release alias for downstream consumers
dist/index.html              Generated readable release artifact
dist/index.self-extract.html Generated gzip self-extracting artifact
dist/build-size-report.json    Generated size and embedded-asset storage report
```

`image-counter.html`, `dist/index.html` and `dist/index.self-extract.html` are generated and must not be edited manually.

A default build copies the readable output byte-for-byte to the tracked root alias. Custom `-OutputPath` builds leave that alias unchanged. Commit the regenerated alias with source changes so downstream raw-file consumers receive the current runtime.

The repository check uses `-CheckReleaseAlias` to compare the existing root alias with a fresh build before any alias write. It ignores the generated manifest timestamp and equivalent gzip encodings, which differ between Windows PowerShell 5.1 and modern PowerShell/.NET. Before comparing decoded assets, it verifies compressed lengths, decoded lengths, and SHA-256 against the embedded manifest; source, configuration, and other metadata must still match. A stale alias makes CI fail instead of silently repairing the working tree. The same check verifies exact self-extract payload parity and runs camera lifecycle, counting/cancellation, ZIP export, language/restore-ownership, Help/header, type-dialog focus, and paired-dialog return tests against source, readable output, root alias, and unpacked self-extract output. Node.js 24 is installed by each CI build workflow.


## Scoped detection (introduced in dev.14)

`Detect list (N)` captures `matchingPhotos()` in project order before asynchronous preparation; later status changes do not change the run's target set. It uses the existing batch Worker, ownership guards, cancellation and one-history transaction. Detect all still takes the complete project list, and totals/exports keep full-project scope.

Each photo may carry `detectionRegion:{x,y,w,h}` in normalized original-image coordinates. Validate finite positive-size rectangles contained in the image at import; missing regions mean full image for older schema-4 projects. Draft and work serializers preserve the optional rectangle independently of image compression. A pending editor copy commits only on Save/clear, with one history/autosave transaction and completion reopened; cancellation and unfinished gestures leave persisted state unchanged. Use the existing orientation/view transforms for drawing and pointer geometry. References retain their own source coordinates.

Inference inputs remain full images. Validate the complete raw output before applying inclusive center-inside acceptance to every detection path. For Replace, scope removal of otherwise eligible automatic markers by the same region; outside markers remain for duplicate filtering and counts. No cropped-inference performance or accuracy benefit is implied, and model assets/dependencies/schema version remain unchanged.

## Photo workspace (dev.18)

All counting modes share a bounded photo workspace and one nonmodal inspector. Its Photos / Detection / Project panels switch rather than stack. Above 900 px, the 300 px inspector sits to the right and owns its scroll area. The photo header contains a state-labelled Open panel / Hide panel toggle, so closing the inspector with × leaves an explicit way to reopen it. At 900 px and below, the inspector replaces the canvas working area; Return to photo restores the canvas. Keep the existing canvas/stage nodes and their cached references intact.

Photos owns status filtering, the captured-list detection action, thumbnails and photo management. Detection owns saved-example editing, detection regions, rerun behavior and current/all-photo actions. Project begins with Photo review, containing standalone completion/reopening and review-only clearing, followed by totals, work name/types, and collapsed display/storage settings. Type totals are expandable; the current photo filename identifies the review target. The photo toolbar groups mode controls, direct current-photo detection/setup, Review complete & next and quiet Save. Detection is emphasized outside Review; review-and-advance is emphasized in Review. Saved-example editing has one entry in Detection. The context row contains only Review selection controls and disappears outside Review; the canvas retains the memo action without a separate completion overlay. Show the excluded-current notice in photo view. The phone Review bar provides Undo, Redo, Previous/Next and Save; other modes provide Undo, Redo, Add, Types and Save. Save is not duplicated in the mobile toolbar. While the phone inspector is open, a `tools-open` bar instead exposes Return to photo, Undo, Redo and Save, suppressing invisible-photo navigation. `mobReturnPhoto` follows the same workspace guards and never changes saved project state. Full-width segmented tabs replace the cramped inline close control; desktop retains ×. Project text buttons use `project-tool-btn` to avoid legacy icon-width selectors.

Inspector open/selected-panel state belongs to the active project but is not serialized or added to history. Accepted project replacement resets it; same-project edits and language changes retain it. Cancel pending canvas gestures before panel visibility or responsive changes can alter coordinate transforms. Keep progress and Stop outside inert editing roots, and apply the existing processing/import/modal guards to new actions. Focus repair applies only when its owner is hidden and must respect newer native-dialog/control ownership. Escape closes the inspector only when a dialog, editor or input does not own the key. These presentation changes do not change detection scope, schema 4, model assets, inference or export behavior.

The toggle remains inside the viewer header, preserving mobile viewer-inert and focus-fallback behavior. Its separate label span updates without replacing the sidebar icon; visible/accessibility labels, title and expanded state follow the same open state. Moving `reviewNext`, `reviewPhoto` and `completeBtn` preserves their existing IDs and handlers: review-and-advance clears review, completes and navigates; review-only clearing preserves completion; standalone completion refuses unresolved review and can reopen a completed photo.

### Detection setup and readiness (dev.17)

`renderQuickDetection()` updates inspector controls and `workspaceDetect` together, including import start/finally refreshes that do not render the whole shell. Missing saved examples changes the current-photo action into an explicit setup action; once saved, it runs detection. All/list remain unavailable until a reference exists, and only list requires matching photos. Loading, running and no-photo states still disable unavailable actions with a reason.

The example dialog opens new boxes or immediately loads a saved-reference draft. Save & close commits a valid reference; Save & detect first validates/commits, rechecks its captured owner, closes, then invokes the common current-photo run. A failed/empty/stale save cannot close or continue. A valid unchanged save can continue without history. Starting over on the current photo stages replacement and leaves the old saved reference intact until Save. Close and stale image decoding cannot commit a pending draft.

The active workspace header uses full width with matching outer gutters; the toolbar action group aligns to the photo frame's right edge. The Detection inspector groups saved-example status/editing, detection actions, sensitivity/region/rerun choices and review guidance. Model/backend/precision details are absent. Mobile keeps wrapping and reachable setup/editor actions.

## Reusable component layer

`components/` contains dependency-free source snippets for common UI patterns. These files are not loaded at runtime and are not a separate bundle layer. An app copies or adapts the needed CSS, HTML, and JavaScript into `src/index.template.html`, preserving the one-file runtime model.

The starter includes the canonical confirmation and toast APIs in the default source, while `components/` also carries the mobile bottom bar, compact popover, preset/custom setting field, and async source-state guard. Reversible operations should normally use Toast + Undo; irreversible/high-risk operations use `AppConfirm`. See `docs/COMPONENTS.md`.

## Build pipeline

1. Read `app.config.json` and `dependencies.json`.
2. Resolve each exact npm version through the npm registry.
3. Cache and extract each tarball.
4. Validate the package's own version.
5. Read only the explicitly listed asset files.
6. Calculate SHA-256 hashes for the package tarball and every original embedded asset.
7. Optionally gzip each declared asset (`gzip` / `auto`), then Base64-encode the stored bytes exactly once.
8. Embed the asset bundle JSON directly, avoiding a second Base64 wrapper around the whole bundle.
9. Replace the three source placeholders exactly once.
10. Write and verify `dist/index.html`.
11. Gzip that HTML, embed it into a small ASCII-only native `DecompressionStream` loader, inherit the readable HTML favicon, and write `dist/index.self-extract.html`.
12. Verify that the loader stays ASCII-only and embedded-only, the favicon matches the readable HTML, and the gzip payload restores byte-for-byte.
13. Write manifests, `build-size-report.json`, and `dist/.nojekyll`; emit warning-only size-budget messages when configured thresholds are exceeded.
14. Reject the declared unresolved build placeholders and common external runtime resource references.

### Startup visibility

The readable HTML places a startup notice before the embedded bundle and clears it when application initialization completes. The self-extract shell distinguishes loading the application file from local unpacking and starting the app. Its Base64 decoder processes bounded chunks and yields to let the browser update the status before expanding gzip with `DecompressionStream`. The loader remains ASCII-only, inherits the favicon and must restore the readable HTML byte-for-byte.

Both variants still transfer their complete embedded model/runtime bundle as part of the initial HTML. ORT/model asset decoding remains lazy on Detect. Cooperative loader decoding and status text improve visibility of the wait; Node timings and file sizes do not establish browser or Android startup latency. See `docs/QUICK_DETECTION_VALIDATION.md` for the baseline evidence and pending browser checks.

## Build placeholders

The source template contains exactly one of each:

- `__APP_CONFIG_JSON__`
- `__BUILD_MANIFEST_JSON__`
- `__EMBEDDED_ASSET_BUNDLE_JSON__`

Do not rename or duplicate them without changing the builder and verifier. Other runtime identifiers that happen to use a `__NAME__` convention are allowed and must not be rejected as build placeholders.

## Embedded asset API

The generated page exposes `window.StandaloneAssets`:

```js
StandaloneAssets.list();
StandaloneAssets.has('library-id', 'asset-key');
StandaloneAssets.bytes('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.bytesAsync('library-id', 'asset-key'); // compressed or uncompressed
StandaloneAssets.text('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.textAsync('library-id', 'asset-key');
StandaloneAssets.blobUrl('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.blobUrlAsync('library-id', 'asset-key');
await StandaloneAssets.loadClassicScript('library-id', 'main', 'ExpectedGlobal');
const module = await StandaloneAssets.importModule('library-id', 'main');
```

Blob URLs are revoked after script/module loading and on page exit. Gzip assets are expanded with native `DecompressionStream` and cached in memory after first use.

### Important limitation

`importModule` does not rewrite relative imports inside a module. Choose a self-contained browser bundle, list every required file and implement a package-specific loader, or bundle the library before embedding.

## Runtime security boundary

The default Content Security Policy blocks all network connections with `connect-src 'none'`. It also blocks frames, objects, forms, and external base URLs. Inline CSS and JavaScript are allowed because the release is intentionally one HTML document. Embedded scripts and workers may be loaded through `blob:` URLs.

Static scanning is a guardrail, not a proof. Browser developer tools should still be used to verify that the generated app makes no unexpected request.

## Large applications

Keep source in one HTML while it remains understandable. When an app grows substantially, development files may be split under `src/` and assembled by the build script. Preserve these properties:

- Two generated one-file release variants.
- Pinned and auditable dependencies.
- No runtime external resource.
- Clear state ownership.
- A build that fails on missing input.

## Restore-offer ownership

The startup draft offer stores only summary metadata. `showWorkspace()` retires that offer and advances its generation after a project is accepted. Startup reads, restore reads/decodes, discard confirmations, and viewer imports check that ownership before committing. **Open work** normalizes the schema-4 viewer data and decodes its initial image before replacing `P`. An import-specific request generation and captured project identity guard both decoding and replacement confirmation. Active work requires confirmation after validation; cancellation, failed imports and stale callbacks keep the current project and restore offer. `addFiles()` captures its project, checks ownership after each decode/display await, and rechecks the image limit immediately before insertion; same-project concurrent imports remain supported. Language changes re-render the summary and declarative accessible attributes without rebuilding editable type inputs.

### Selected-image normalization

`fileToRecord()` is shared by file selection, drop and clipboard image input. After browser decoding, it validates positive safe intrinsic dimensions and uses `embeddedRasterBytes()` to preserve permitted raster payloads byte-for-byte. A decodable but unsupported format such as SVG is rendered to a PNG before it enters the project, with a 20-megapixel / 16,384-pixel-per-axis allocation guard and encoded-payload validation. The original filename, source MIME and source byte size remain metadata; the working MIME, byte size and data URL describe the stored raster. A failed conversion does not create a record.

`addFiles()` validates the candidate image and full image-plus-metadata project budget immediately before insertion. This aligns direct image input with reference saves, autosave and saved-work validation rather than allowing an image that only fails later. Project import remains a separate trust boundary: raw SVG in legacy drafts/viewer HTML is still rejected, without execution or automatic migration. `test-image-import.cjs` covers direct-input normalization with the real project validator, unchanged raster bytes, canvas failures, size limits and stale import ownership.

Within one `addFiles()` request, a photo-object keyed cache reuses an already validated payload's byte count only while its exact data URL is unchanged. Using the photo as the key avoids expensive comparisons between large similar strings. Changed payloads and later requests are revalidated; all project metadata, references and markers are checked on every admission. Public `validateProject()` always uses the uncached raster validator.

### Autosave ownership

Draft preparation captures the project snapshot and compression settings instead of looking up later photos through live `P`. Save generation and project ownership guard preparation and compression-cache updates; stale prepared results are not sent to IndexedDB. Recheck the same owner/generation after awaiting the database connection and before starting its write transaction; a stale connection is closed without writing. A write already in progress is not cancelled or rolled back, but its late completion or failure cannot change the new work's saved-size report or save status. Old image decodes cannot overwrite the replacement project's compression cache, including when image IDs and payload lengths match. Successful current saves retain compression caching; genuine current failures still show the save error. `test-counting-correctness.cjs` exercises these interleavings with the production save functions.

### Portable work save

The **Save** action opens the save/export dialog, which exposes **Save work as HTML** and **Open work** alongside the existing ZIP export. The phone launcher stays in the bottom bar. These use the existing viewer HTML format: the file includes photos, pinned references, annotations and review state, opens directly as a read-only viewer and can be reopened in the app for editing. Browser autosave is labeled separately from this portable file.

`saveViewer()` captures a cloned project and sanitized filename before awaiting preparation, blocks duplicate saves, and restores the button on failure or success. `compressProjectForViewer()` reads photos and quality settings from its own copy without consulting or updating the live project image cache; a project switch cannot mix photo data into a pending save. Compression changes only photo data, leaving pinned PNG references intact. Existing format/schema, import limits and offline constraints are unchanged.

`exportZip()` likewise captures project data, optional visibility and filename before asynchronous JPEG rendering. Its CSV and JPEG entries use one snapshot. Export image decoding is isolated from the active editor cache, so edits or a replacement project with reused image IDs cannot alter an in-flight ZIP or receive a stale decoded image from it.

`test-language-restore.cjs` covers validation-before-confirmation, accepted/cancelled replacement, newer-work ownership and out-of-order import requests. `test-export-zip.cjs` covers captured HTML/ZIP content and filename, duplicate HTML requests, failure recovery, isolated compression and ZIP rendering across work replacement.

## Help and header interaction

Help starts with three quick-start steps and four short cautions: review AI results including zero detections, save important work as HTML because browser autosave can be lost, keep processing local/offline, and expect initial HTML loading/detection preparation to take time. A native details section holds optional practical controls and saving tips, closed initially. Keep license/source markup, translation labels, `appLicenseDetails`/`appLicenseText` loading behavior and the following build block byte-for-byte unchanged. The three-step/four-note content contract is separate from the unchanged dialog shell and responsive build behavior.

The header reserves non-shrinking space for language/Help actions and the version badge, while the app title can truncate at narrow widths. Only modal Help locks document scrolling through `html:has(#helpDlg:modal)` and `body:has(#helpDlg:modal)`; closing it releases the lock without saved scroll state. The Help shell alone uses a flex-column layout when open: its header does not shrink and its body has min-height: 0 and owns the remaining scroll area. This avoids separate viewport-height calculations clipping the body. Native focus/Escape behavior is unchanged. At 760 px and below, Help Build info and the page footer are hidden; their desktop behavior remains available. Shared backdrop handlers ignore descendant targets before checking the dialog rectangle, including zero-coordinate keyboard clicks from the Build info summary.

`node --test scripts/test-help-header.cjs` exercises the actual binding code and CSS contracts without a browser. The repository aggregate applies it to source, readable, root-alias, and unpacked self-extract variants. Native rendering, wheel scrolling, keyboard focus, and short/narrow content reachability still require browser verification.

## Type-dialog focus

Name commits normalize the same input; visibility changes refresh the same eye button's label and icon. Neither operation rebuilds `catList` or schedules a focus repair. `renderAll()` continues to refresh counts, overlays, and summaries outside the dialog. This preserves the browser's Tab destination and existing focus ownership. Adding and deleting types retain their existing rebuilding behavior.

`node --test scripts/test-type-dialog-focus.cjs` runs the production handlers, history, and render dispatcher with a small DOM/focus model. It covers both name rows, forward/reverse Tab candidates around blur/change, repeated bilingual Hide/Show, newer focus/modal ownership, and unchanged count/data/history semantics. Native event ordering and viewport/scroll reachability still require browser verification.

## Paired dialog return focus

Only Types and Export use `showPairedDialog` around native `showModal()`. The close handler records the actual desktop/mobile launcher and checks the current viewport at close time. If that launcher is non-rendered or wholly offscreen, its visible, enabled peer may receive normal focus, allowing the browser to reveal it. The fallback runs only if focus is still on that launcher, BODY, or a descendant of the now-closed dialog. It skips reopened dialogs, another modal, meaningful unrelated focus, non-paired Types launchers, and visible original launchers. There is no focus trap, resize handler, delayed focus callback, or change to Display/history/export data behavior.

`node --test scripts/test-dialog-return-focus.cjs` exercises the production Types/Export opening and shared dismissal bindings with modeled native close restoration. It covers both breakpoint directions, closed-dialog/BODY ownership, ordinary returns, unavailable peers, newer focus/modals, reopen ordering, and unchanged export setup. Both focus suites join the source/readable/root-alias/self-extract check matrix; actual browser event/viewport behavior remains a separate gate.

## Counting state correctness

Lightweight history restoration schedules autosave after restoring project fields. Correction reset records history before clearing completion and restoring default adjustments. Exported viewer navigation separates requested and committed indices: a generation token guards decode success, failure, and deferred thumbnail scrolling. Image, marker ownership, and metadata commit together. Failed navigation retains the previous committed state and exposes a localized status; initial failure leaves current-JPEG download disabled.

`node --test scripts/test-counting-correctness.cjs` executes actual history/reset functions and generated-viewer navigation with controlled decode promises, including out-of-order success, stale failure, latest failure, and recovery. The repository check includes all four artifact variants.

Pinned references are optional category metadata in schema 4. Normalization validates and preserves them, and draft/viewer serialization includes them unchanged. History shallow-copies categories while sharing immutable references to avoid duplicating image data on each marker edit. Saving new or changed examples replaces the entire field in one undoable transaction. Closing the example editor preserves the saved field; detection runs capture source/reference identities before asynchronous work.

### Main-screen sequential detection

`QUICK:CORE` owns captured project/category/reference/model/source identities, append/replace mode and a single lazy history transaction. `QUICK:RUNNER` owns one transient `run.inferenceRuntime` per main-screen run. Its first valid photo transfers the model/WASM bytes and pinned-reference bitmap, creates a Worker/session, and computes the reference prompt once. Later photos transfer only their target bitmap and use that prompt with the captured settings. Request IDs pair responses with the pending photo; old responses cannot commit to the next one. Bad target decodes can be skipped, while runtime/output errors stop the run. Finish, cancellation, stale ownership and page navigation terminate the Worker, reject pending work, close untransferred bitmaps, revoke module URLs and drop runtime state. The next run starts fresh. `QUICK:UI` exposes progress/cancellation outside the inert editor, mobile bar and toast, and reports total elapsed duration including preparation when the run ends. Every detection action creates `needsReview:true, autoPending:true` rectangles for review on the main photo. Pending `addFiles` calls block starts so a delayed import cannot erase a run’s Undo history. Cancellation synchronously invalidates the run, rejects pending inference and guards late asset/bitmap/result callbacks.

Replacement retains every marker except the captured category's explicitly eligible `autoPending === true && needsReview === true` markers whose centers lie inside the photo's detection region (or full image when unset). Inference and complete-output validation precede removal; duplicate filtering uses the retained markers. Each photo commits its removals, additions, incomplete state and detection check atomically. Valid zero results still commit; malformed/failed/cancelled results do not. Truncated replacement results are rejected. The first committed photo opens the run's only history entry; Stop preserves earlier commits and one Undo restores them all.

Optional schema-4 `image.detectionChecks` stores one `{categoryId, detectedAt, reviewed}` record per category. Every successful quick result refreshes its record with `reviewed:false`, including zero or duplicate-only output. Normalization validates these records and explicit marker eligibility without inventing legacy detection history. History copies the mutable checks; draft and viewer serialization preserve them. Category deletion removes matching checks and protects reassigned markers. Reports, elapsed duration, reference embeddings and selected rerun mode remain transient; model/runtime assets, schema 4 and storage identifiers are unchanged.

`photoStatus(image)` derives review first from pending markers/checks, then completion, then existing markers/reviewed checks, and finally undetected. The marker review count remains a count of flags; pending detection checks make a zero-marker photo reviewable without inflating that count. The current-photo bar, thumbnails and summary share the status rules.

`markImageReviewed()` clears all current-photo flags and eligibility and marks its checks reviewed in one `pushHistory()` transaction. It preserves completion and other photos. `reviewAndNext()` performs the same review plus completion, then selects the next incomplete photo with wraparound, skipping the current photo. The last photo stays selected and announces that all are complete. Both autosave through `touch()` and are blocked during inference; no-op review does not discard redo. Committed marker moves/resizes/type changes/review toggles delete eligibility, whereas cancelled pointer edits preserve it. Reference saves call the full render path to synchronize the editor, detection actions and history controls.

Pinned-reference editing uses `autoState.referenceEdit` as a transient owner/reference/image record and copies example boxes into the existing drawing buffer. The saved reference remains immutable until Save; snapshot coordinates use rotation zero, separate from the target. Closing/cancelling clears the edit identity so late image decoding cannot reopen it. Save shares the original PNG, replaces only boxes, validates the reference/project and makes one history entry. Starting a fresh source on the current photo is a separate pending replacement, committed only after validation; close/cancel keeps the previous reference. Save helpers return success, including unchanged valid drafts, so their caller can safely close and optionally continue to detection.

Example selection and manipulation are transient dialog state shared by unpinned examples and pinned-reference drafts. Explicit Add and Select / edit modes separate new-box creation from canvas/list selection, selected-only deletion and selected-box geometry updates. A selected box exposes four corner handles and displayed-image percentage bounds; the existing display/original coordinate transforms also apply to moves, resizes and numeric updates. Pinned drafts use the saved snapshot at rotation zero. Unchanged numeric fields recover the exact stored bounds instead of reusing their six-decimal percentage display. Position edits preserve dimensions within the display-rounding tolerance (1e-8 normalized), with the same small edge correction to remain in bounds; the minimum-size rule is not relaxed. Selection alone does not invalidate example geometry or change count data.

Pointer edits stage geometry until a valid release. Cancellation, lost capture or another pointer abandons the staged edit, and late events cannot commit it. Committed example gestures update only the draft while keeping the saved reference immutable. Save validates the complete draft, replaces the reference once and creates one history entry; unchanged saves, discard and close do not create history. Local examples, mode, selection and gesture state are not serialized. The model/runtime assets, dependencies, schema-4 reference representation and storage identifiers remain unchanged.

The example preview has a transient 1–8× viewport transform shared by image/overlay rendering and pointer-to-source mapping. Pinch zoom anchors the image under the moving gesture center, two-finger translation pans, and Pan view supports one-pointer movement. The adjacent −/+ controls step by a factor of 1.5; Fit restores 1×. Corner handles use CSS dimensions independent of zoom. Box geometry and numeric bounds remain normalized source-image values, including rotated targets and rotation-zero reference snapshots.

When a second pointer arrives, the pending box edit is discarded while selection survives. The view gesture owns the participating pointers, and remaining/late releases cannot become an edit commit. Source and modal transitions, entering/saving/discarding reference editing, saving or replacing examples reset zoom/pan. Choosing Add/Select exits Pan view and preserves the viewport. View changes create no history, do not invalidate the saved PNG or inference geometry, and are absent from draft/viewer serialization.

## Review mode and selected-marker deletion

The main canvas adds Review alongside Point, Rectangle and Move. Entering Review directly or after detection defaults to Single. Review handles visible-marker selection separately from marker geometry edits. Single and Multiple distinguish taps from one-pointer panning; Range stages an additive selection rectangle and tests each visible marker's displayed center through the existing image/view transform. Review renders selection emphasis without resize handles. Single's popover keeps Edit and the per-marker review toggle; the toggle changes the flag while Review remains active. Edit transfers the marker into the Point or Rectangle editing mode matching its shape. Type-change and single-marker delete controls are hidden in Review; Multiple and Range hide the entire popover even for one selected marker.

Review submode, selected IDs, project/photo ownership and unfinished gestures are transient UI state. Selection changes create no history or autosave. Pointer cancellation, lost capture and pinch abandon a pending range without committing its preview; late events cannot select or edit markers. Project/photo and mode transitions clear selection, visibility/removal prunes it, and history restoration and detection boundaries invalidate it. Every selection/delete action rechecks ownership and visibility so hidden, removed or other-photo IDs cannot be acted on.

Bulk deletion resolves the eligible selected markers in the current photo before opening one history transaction. It removes only those IDs, sets that photo incomplete and schedules autosave; other markers, other photos and detection checks are preserved. A toast offers Undo for the whole deletion. Empty/stale selection is a no-op. History restores the deleted markers and prior completion together, but does not restore transient selection.

Main-screen detection enters Review after a run that committed at least one successful photo, including zero-result checks and Stop after partial success. Owner checks prevent a finished or cancelled old run from changing a replacement project's mode. No selection fields enter project serialization, schema 4, drafts, viewer HTML or CSV; model assets and inference behavior are unchanged.

## Photo-status filtering

The editor's photo filter is transient UI state associated with the live project, separate from its serialized fields and lightweight history. New/opened/restored projects start at All. Same-project edits, Undo/Redo, photo additions/removals and language changes retain the selection while deriving fresh matches. Filter changes do not call history or autosave and do not alter project timestamps or counts. Schema 4, draft/viewer data, model assets and storage identifiers are unchanged.

The native select sits directly above the thumbnail strip. Its option counts and matching/total display derive from the full image list through `photoStatus(image)`, using the same review-before-completion precedence as the current-photo bar and summary. The thumbnail renderer includes only matching images in project order. The canvas retains its current photo when it is excluded and displays a notice; zero matches display an empty state with a reset-to-All action.

Previous/Next and Left/Right resolve matching neighbors relative to the current photo's position in the full list. They do not wrap; an excluded current photo uses the nearest match on the requested side. Native form-control keyboard handling takes precedence over photo shortcuts. Filter changes and project replacement invalidate pending filtered navigation, and asynchronous decode completion rechecks current ownership before committing. Decode failures retain the previous displayed photo. Filtering or a status refresh never initiates an automatic photo switch.

Filtering controls the editor thumbnail list, its ordinary navigation and the explicit Detect list action. Summary totals, saved work, CSV/JPEG exports, Detect all photos, Next incomplete, Review complete & next still use the full project. An explicit full-project navigation action may select an excluded photo and then show the notice. No filter field or filtered subset enters portable work or the read-only viewer.
