# Architecture

## Overview

### EX local detection

The editable template contains `AUTO:CORE`, `AUTO:ENGINE` and `AUTO:UI` sections. Geometry/filtering and the one-history marker transaction are separate from transient dialog state. Model files and candidates are page-local only; the existing `image-counter` schema identifier and storage slug remain compatible. UI product/repository labels use Image Counter EX.

Each dialog Detect action decodes the selected embedded ORT assets lazily and starts a fresh module Worker. Main-screen runs reuse one Worker/session/reference prompt for their captured photo list, as described below. The selected ONNX buffer, image bitmap and WASM bytes transfer to the Worker. Its source includes the same pure helper functions tested in the main template. The first pass extracts a 512-float VPE from OR-combined examples on the reference photo (or the target when unpinned); the second uses that VPE with a zero mask to detect the current target image. A pinned category reference is a lossless 640 × 640 letterboxed PNG and mapped normalized boxes, independent of the original photo. Both bitmaps are transferred and closed; saved projects contain no model-derived embeddings. Boxes return to normalized original coordinates before NMS. The main thread validates owner/generation/model/reference identity, previews candidates and applies only explicit selection.

Cancel/close terminates the Worker and revokes its module URLs. Settings/model changes clear candidates; source replacement is checked on result and render. Duplicate filtering includes all existing markers and repeats at application time. Existing positive imported rectangles smaller than the new `.003` drawing minimum still participate in duplicate checks. One `pushHistory()` encloses the complete append; no-op applications leave history/redo/completion intact.

ORT Web is embedded through `dependencies.json`: WASM 1.29.0 bundle + threaded WASM with `numThreads=1`; WebGPU 1.27.0 bundle + asyncify WASM. `wasmBinary` avoids fetch under `connect-src 'none'`. The editor's `wasm-unsafe-eval` allows compilation while keeping JavaScript eval disallowed. The compact model is a pinned `source: local` dependency, with paths confined to the repository and required SHA-256 checks. Its stable descriptor is the default model; `bytesAsync` supplies fresh transferable copies from a lazily decoded cache. Tiles and cross-run embedding caching are deferred. See `docs/YOLOE_VALIDATION.md` for actual test coverage.

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


## Scoped detection and mobile Review (dev.14)

`Detect list (N)` captures `matchingPhotos()` in project order before asynchronous preparation; later status changes do not change the run's target set. It uses the existing batch Worker, ownership guards, cancellation and one-history transaction. Detect all still takes the complete project list, and totals/exports keep full-project scope.

Each photo may carry `detectionRegion:{x,y,w,h}` in normalized original-image coordinates. Validate finite positive-size rectangles contained in the image at import; missing regions mean full image for older schema-4 projects. Draft and work serializers preserve the optional rectangle independently of image compression. A pending editor copy commits only on Save/clear, with one history/autosave transaction and completion reopened; cancellation and unfinished gestures leave persisted state unchanged. Use the existing orientation/view transforms for drawing and pointer geometry. References retain their own source coordinates.

Inference inputs remain full images. Validate the complete raw output before applying inclusive center-inside acceptance to every detection path. For Replace, scope removal of otherwise eligible automatic markers by the same region; outside markers remain for duplicate filtering and counts. No cropped-inference performance or accuracy benefit is implied, and model assets/dependencies/schema version remain unchanged.

Compact Review at up to 760 px is transient UI presentation. Its explicit Show settings / photos toggle restores hidden panels, while review controls and canvas remain accessible. The compact Review bottom bar provides Undo, filtered Previous/Next, Review & next and Save; completion still follows its project-wide workflow. Expanded settings/photos restores the normal Undo/Redo/Add/Types/Save bar, including access to Redo. Return to photo review folds the panels again; the mode selector remains accessible. Neither this presentation state nor the photo filter belongs in saved project data.

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

### Portable work save

**Save / export** exposes **Save work as HTML** and **Open work** alongside the existing ZIP export. The mobile launcher is labeled **Save**. These use the existing viewer HTML format: the file includes photos, pinned references, annotations and review state, opens directly as a read-only viewer and can be reopened in the app for editing. Browser autosave is labeled separately from this portable file.

`saveViewer()` captures a cloned project and sanitized filename before awaiting preparation, blocks duplicate saves, and restores the button on failure or success. `compressProjectForViewer()` reads photos and quality settings from its own copy without consulting or updating the live project image cache; a project switch cannot mix photo data into a pending save. Compression changes only photo data, leaving pinned PNG references intact. Existing format/schema, import limits and offline constraints are unchanged.

`test-language-restore.cjs` covers validation-before-confirmation, accepted/cancelled replacement, newer-work ownership and out-of-order import requests. `test-export-zip.cjs` covers captured save content/filename, duplicate requests, failure recovery and isolated compression.

## Help and header interaction

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

Pinned references are optional category metadata in schema 4. Normalization validates and preserves them, and draft/viewer serialization includes them unchanged. History shallow-copies categories while sharing immutable references to avoid duplicating image data on each marker edit. Pin/unpin replace the entire field and are undoable. Sequential detection keeps the dialog open, clears old candidates before changing the target, and captures reference/model/generation before awaiting image decoding.

### Main-screen sequential detection

`QUICK:CORE` owns captured project/category/reference/model/source identities, append/replace mode and a single lazy history transaction. `QUICK:RUNNER` owns one transient `run.inferenceRuntime` per main-screen run. Its first valid photo transfers the model/WASM bytes and pinned-reference bitmap, creates a Worker/session, and computes the reference prompt once. Later photos transfer only their target bitmap and use that prompt with the captured settings. Request IDs pair responses with the pending photo; old responses cannot commit to the next one. Bad target decodes can be skipped, while runtime/output errors stop the run. Finish, cancellation, stale ownership and page navigation terminate the Worker, reject pending work, close untransferred bitmaps, revoke module URLs and drop runtime state. The next run starts fresh; the dialog path remains one-shot. `QUICK:UI` exposes progress/cancellation outside the inert editor, mobile bar and toast, and reports total elapsed duration including preparation when the run ends. Main-screen actions create `needsReview:true, autoPending:true` rectangles; the dialog keeps explicit candidate selection and creates no replacement eligibility. Pending `addFiles` calls block starts so a delayed import cannot erase a run’s Undo history. Cancellation synchronously invalidates the run, rejects pending inference and guards late asset/bitmap/result callbacks.

Replacement retains every marker except the captured category's explicitly eligible `autoPending === true && needsReview === true` markers whose centers lie inside the photo's detection region (or full image when unset). Inference and complete-output validation precede removal; duplicate filtering uses the retained markers. Each photo commits its removals, additions, incomplete state and detection check atomically. Valid zero results still commit; malformed/failed/cancelled results do not. Truncated replacement results are rejected. The first committed photo opens the run's only history entry; Stop preserves earlier commits and one Undo restores them all.

Optional schema-4 `image.detectionChecks` stores one `{categoryId, detectedAt, reviewed}` record per category. Every successful quick result refreshes its record with `reviewed:false`, including zero or duplicate-only output. Normalization validates these records and explicit marker eligibility without inventing legacy detection history. History copies the mutable checks; draft and viewer serialization preserve them. Category deletion removes matching checks and protects reassigned markers. Reports, elapsed duration, reference embeddings and selected rerun mode remain transient; model/runtime assets, schema 4 and storage identifiers are unchanged.

`photoStatus(image)` derives review first from pending markers/checks, then completion, then existing markers/reviewed checks, and finally undetected. The marker review count remains a count of flags; pending detection checks make a zero-marker photo reviewable without inflating that count. The current-photo bar, thumbnails and summary share the status rules.

`markImageReviewed()` clears all current-photo flags and eligibility and marks its checks reviewed in one `pushHistory()` transaction. It preserves completion and other photos. `reviewAndNext()` performs the same review plus completion, then selects the next incomplete photo with wraparound, skipping the current photo. The last photo stays selected and announces that all are complete. Both autosave through `touch()` and are blocked during inference; no-op review does not discard redo. Committed marker moves/resizes/type changes/review toggles delete eligibility, whereas cancelled pointer edits preserve it. Pin/unpin call the full render path to synchronize the modal, main-screen actions and history controls.

Pinned-reference editing uses `autoState.referenceEdit` as a transient owner/reference/image record and copies example boxes into the existing drawing buffer. The saved reference remains immutable until Save; snapshot coordinates use rotation zero, separate from the target. Closing/cancelling clears the edit identity so late image decoding cannot reopen it. Save shares the original PNG, replaces only boxes, validates the reference/project and makes one history entry.

Example selection and manipulation are transient dialog state shared by unpinned examples and pinned-reference drafts. Explicit Add and Select / edit modes separate new-box creation from canvas/list selection, selected-only deletion and selected-box geometry updates. A selected box exposes four corner handles and displayed-image percentage bounds; the existing display/original coordinate transforms also apply to moves, resizes and numeric updates. Pinned drafts use the saved snapshot at rotation zero. Selection alone does not invalidate example geometry or change count data.

Pointer edits stage geometry until a valid release. Cancellation, lost capture or another pointer abandons the staged edit, and late events cannot commit it. Committed example changes invalidate obsolete detection candidates while keeping the saved pinned reference immutable. Save validates the complete draft, replaces the reference once and creates one history entry; unchanged saves, discard and close do not create history. Local examples, mode, selection and gesture state are not serialized. The model/runtime assets, dependencies, schema-4 reference representation and storage identifiers remain unchanged.

The example preview has a transient 1–8× viewport transform shared by image/overlay rendering and pointer-to-source mapping. Pinch zoom anchors the image under the moving gesture center, two-finger translation pans, and Pan view supports one-pointer movement. The adjacent −/+ controls step by a factor of 1.5; Fit restores 1×. Corner handles use CSS dimensions independent of zoom. Box geometry and numeric bounds remain normalized source-image values, including rotated targets and rotation-zero reference snapshots.

When a second pointer arrives, the pending box edit is discarded while selection survives. The view gesture owns the participating pointers, and remaining/late releases cannot become an edit commit. Source and modal transitions, entering/saving/discarding reference editing, pin/unpin and next-photo navigation reset zoom/pan. Choosing Add/Select exits Pan view and preserves the viewport. View changes create no history, do not invalidate the saved PNG or inference geometry, and are absent from draft/viewer serialization.

## Review mode and selected-marker deletion

The main canvas adds Review alongside Point, Rectangle and Move. Entering Review directly or after detection defaults to Single. Review handles visible-marker selection separately from marker geometry edits. Single and Multiple distinguish taps from one-pointer panning; Range stages an additive selection rectangle and tests each visible marker's displayed center through the existing image/view transform. Review renders selection emphasis without resize handles. Single's popover keeps Edit and the per-marker review toggle; the toggle changes the flag while Review remains active. Edit transfers the marker into the Point or Rectangle editing mode matching its shape. Type-change and single-marker delete controls are hidden in Review; Multiple and Range hide the entire popover even for one selected marker.

Review submode, selected IDs, project/photo ownership and unfinished gestures are transient UI state. Selection changes create no history or autosave. Pointer cancellation, lost capture and pinch abandon a pending range without committing its preview; late events cannot select or edit markers. Project/photo and mode transitions clear selection, visibility/removal prunes it, and history restoration and detection boundaries invalidate it. Every selection/delete action rechecks ownership and visibility so hidden, removed or other-photo IDs cannot be acted on.

Bulk deletion resolves the eligible selected markers in the current photo before opening one history transaction. It removes only those IDs, sets that photo incomplete and schedules autosave; other markers, other photos and detection checks are preserved. A toast offers Undo for the whole deletion. Empty/stale selection is a no-op. History restores the deleted markers and prior completion together, but does not restore transient selection.

Main-screen detection enters Review after a run that committed at least one successful photo, including zero-result checks and Stop after partial success. Dialog candidate application also enters Review. Owner checks prevent a finished or cancelled old run from changing a replacement project's mode. No selection fields enter project serialization, schema 4, drafts, viewer HTML or CSV; model assets and inference behavior are unchanged.

## Photo-status filtering

The editor's photo filter is transient UI state associated with the live project, separate from its serialized fields and lightweight history. New/opened/restored projects start at All. Same-project edits, Undo/Redo, photo additions/removals and language changes retain the selection while deriving fresh matches. Filter changes do not call history or autosave and do not alter project timestamps or counts. Schema 4, draft/viewer data, model assets and storage identifiers are unchanged.

The native select sits directly above the thumbnail strip. Its option counts and matching/total display derive from the full image list through `photoStatus(image)`, using the same review-before-completion precedence as the current-photo bar and summary. The thumbnail renderer includes only matching images in project order. The canvas retains its current photo when it is excluded and displays a notice; zero matches display an empty state with a reset-to-All action.

Previous/Next and Left/Right resolve matching neighbors relative to the current photo's position in the full list. They do not wrap; an excluded current photo uses the nearest match on the requested side. Native form-control keyboard handling takes precedence over photo shortcuts. Filter changes and project replacement invalidate pending filtered navigation, and asynchronous decode completion rechecks current ownership before committing. Decode failures retain the previous displayed photo. Filtering or a status refresh never initiates an automatic photo switch.

Filtering controls the editor thumbnail list, its ordinary navigation and the explicit Detect list action. Summary totals, saved work, CSV/JPEG exports, Detect all photos, Next incomplete, Review complete & next and detection-dialog next-photo actions still use the full project. An explicit full-project navigation action may select an excluded photo and then show the notice. No filter field or filtered subset enters portable work or the read-only viewer.
