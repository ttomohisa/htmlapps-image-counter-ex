# Mobile review and scoped detection

User request: improve smartphone review display, detect only photos in the filtered list, and specify a detection area; publish verified release to GitHub Pages. Existing constraints: single self-contained HTML, local processing, JA/EN, Android-friendly controls, small unchanged embedded model.

## Approach

- Keep the existing review workflow and provide a compact mobile presentation. On screens <=760 px, Review folds setup controls, photo browsing and secondary tools behind a clearly labelled Show settings/photos toggle. Keep the current filename/status/count, review selection, canvas and completion accessible. Use the bottom bar for Undo, previous/next filtered photo, review-complete-and-next and Save; editing modes retain the normal bar. Desktop remains full view. A visible toggle always restores controls. This is transient presentation state, not saved project data.
- Add a separate `Detect list (N)` action next to the photo filter. Capture `matchingPhotos()` when starting, keep that ordered snapshot even when successful detection changes status, disable it when no matching photo/reference or while busy/importing. Existing Detect all still covers the full project. All three actions use the same batch Worker, cancellation, single Undo transaction and review semantics.
- Each photo may store one optional normalized rectangle `detectionRegion:{x,y,w,h}`. Unset means full image. A target-photo editor allows drawing a rectangle, numeric adjustments, clearing to full image, Save/Cancel. Use the existing orientation transforms, show dimmed outside area, preserve original pixels, support touch cancellation, keyboard, pinch/pan or explicit view controls where useful. Save/clear is one undoable, autosaved transaction; Cancel and unfinished gestures do not mutate data. Changed scope reopens photo completion; existing markers are untouched.
- Limit accepted detection candidates to those whose centers are inside the rectangle, inclusive boundaries. This release retains full-image inference; it limits accepted results and does not claim cropped-inference speed or small-object accuracy improvements. Apply to dialog and all quick detection paths. Replace unreviewed automatic results removes only eligible markers inside the region; outside markers are retained. Validate the whole raw output before region filtering. Examples always retain their separate source/coordinate system.
- Persist regions in drafts and work HTML (including compressed image round trips); validate optional regions strictly on import; old projects remain full-image. CSV/JPEG totals remain all markers, independent of detection area. No model, runtime dependency, CSP or schema-version change.

## Alternatives considered

Cropping inference could improve resolution within a region but changes model inputs and needs separate accuracy evaluation; defer it. Redefining Detect all to mean the filtered list would be ambiguous; use a separate action. A full-screen mobile replacement would hide familiar controls and require new navigation; improve the existing Review layout instead.

## Verification

Production-bound tests: region validity/persistence, rotations, cancellation, exact Undo/Redo, outside-marker preservation in Replace, stale ownership; filtered batch snapshot/empty/cancel/Undo; mobile state/focus/resizing and guards. Run the full repository matrix, inspect actual desktop/390px JA/320px EN browser UI, inference with a real model where feasible, export contents, reload/restore, readable and self-extract builds. Report physical Android and file-origin gaps honestly.
