# Android / direct-file acceptance check

Target requested by the user: Android with Chrome. The user reported good Android Chrome behavior on the Pages 1.1.0-dev.3 build. Physical-device checks for the newer detection and example-editing workflows through dev.8 are pending; desktop viewport checks must not be recorded as an Android pass.

## Files

Version 1.1.0-dev.8 embeds the 6.44 MiB compact YOLOE-26n model in both `index.html` and `index.self-extract.html`. Each file works independently; no separate model file is needed. Download the HTML itself before local-file testing; do not open it inside a ZIP preview.

## Direct-file check on the computer

1. Open `index.html` in Chrome or Edge from the extracted folder. Verify that it opens as a local file, rather than the existing loopback HTTP preview.
2. Choose the sample, open Auto detect, keep the built-in model with Standard (CPU), and outline one or two circles.
3. Run detection, deselect a candidate, apply, Undo, and Redo.
4. Reload, restore the draft if offered, and export a CSV-only ZIP using an edited filename.
5. Repeat the inference path with `index.self-extract.html`.

## Android Chrome check

For the HTTPS test, open [Image Counter EX on GitHub Pages](https://ttomohisa.github.io/htmlapps-image-counter-ex/) in Chrome. Verify version **1.1.0-dev.8**, choose a photo or sample, open Auto detect and outline examples. The built-in model is already selected with CPU / FP32; advanced settings can stay closed. Continue with steps 2–8 below, recording HTTPS as the context. The [self-extract variant](https://ttomohisa.github.io/htmlapps-image-counter-ex/index.self-extract.html) is available separately. The initial HTML includes runtime and model; detection makes no additional network requests. HTTPS results do not replace the local-document test in step 1.

1. Copy the extracted trial files to the Android device. Open the HTML using Chrome if the system's file opener offers it. If it opens only a document preview, cannot select Chrome, or Chrome refuses the local document, record that outcome; do not count a preview or HTTP page as a direct-file pass.
2. Record phone model, Android version, Chrome version, HTML variant, and whether the address is local (`file:` / `content:`) or HTTP(S). These contexts are distinct.
3. Load the sample, keep the built-in model, outline one example by touch, and add a second example. Check portrait and landscape; use numeric bounds if touch drawing fails and record the difference.
4. Run detection, cancel once, then rerun. Review/deselect candidates and add them. Check Undo/Redo and a manual point.
5. Repeat at 90° image rotation and verify that examples and markers align with the displayed objects.
6. Switch away and return during inference; navigate away/back if appropriate. The page must either resume valid work, offer a cancelled state that can rerun, or reload. It must not remain permanently disabled. Already completed candidates should remain reviewable if the browser restores the page from its cache.
7. Reload and check draft restoration, then export a CSV-only ZIP with an edited filename.
8. Repeat the basic detection path with the self-extract HTML. Record blank page, unavailable picker, model error, tab reload, unresponsive UI, or failed download verbatim.

CPU/FP32 is the acceptance baseline. WebGPU/FP16 is an additional device-specific check after the baseline succeeds. A browser feature check alone does not prove inference, storage, touch, or download behavior.

## Result record

| Environment | Normal HTML | Self-extract | Inference | Touch | Restore / export |
| --- | --- | --- | --- | --- | --- |
| Desktop actual local file | Pending | Pending | Pending | N/A | Pending |
| Android Chrome actual local document | Pending | Pending | Pending | Pending | Pending |

The automation environment provides only an in-app HTTP(S) browser and no attached Android device. Its earlier `file://` rejection was not bypassed. See `YOLOE_VALIDATION.md` for tests that were actually run.

## Reusable-example check (dev.4)

Load at least two photos of similar objects at comparable apparent size. Outline one to three examples and pin them. Run detection, review candidates, then Add and detect next. Confirm the target filename changes while the pinned source/thumbnails remain. Close and reload, restore the draft, and check that detection works without redrawing. Unpin and use Undo to restore the reference. Each counting type has its own reference. A wide scene with much smaller objects may need fresh examples or a closer photo; pinning does not guarantee equal accuracy across shooting conditions.

## Main-screen detection

Pin examples, close settings, then run Detect this photo. Confirm the settings dialog stays closed and new markers are flagged Needs review. Run Detect all photos on at least three photos; stop during a later photo and confirm completed additions remain. One Undo must remove all additions from that run; Redo restores them. Repeat a completed run and check duplicate suppression. Reload and restore the draft to confirm examples and review flags persist. Check both buttons and Stop at a narrow portrait width.

## Photo-level review and reference changes

After detection, inspect the photo and use Mark this photo reviewed. Its flags should clear without changing counts or another photo. Undo/Redo should restore/clear all flags together; reload and exported viewer should preserve the result. Unpin an example, close settings, and confirm main detection is disabled with the no-reference hint. Draw new examples and pin them; closing settings should immediately show the new count and enable detection.

## Edit existing pinned examples

Open Add / edit examples with a pinned reference. Add a box on its saved source and save; repeat and discard. Check the original boxes survive, counts stay unchanged, Undo restores the prior reference and reload retains the saved edit. Also test a rotated target or a deleted source photo. Existing marker overlays start hidden; enable the dashed-marker toggle and check duplicate-only results explain the disabled Add action.

## Select, move and resize examples (dev.8; pending)

Run these checks for both unpinned current-photo examples and the pinned-reference draft editor, in Japanese and English. Record actual desktop browser, Android device, portrait/landscape viewport and local/HTTPS context separately.

1. In Add mode, create at least three example boxes. Switch to Select / edit and tap each box or its numbered list control. Confirm the selected box is distinct, selection creates no box, and Delete is disabled when no box is selected. Delete a middle example and confirm only it disappears and the remaining numbered controls still select the correct boxes.
2. Drag inside a selected box to move it. Resize from each of its four corners, including near every image edge; confirm boxes remain positive-size and inside the image. Repeat with unpinned examples at 0°, 90°, 180° and 270° rotation. Pinned drafts must continue to show the saved source at rotation zero, independently of the target rotation.
3. Use only the keyboard to select an example by number, edit its left/top/right/bottom percentages and activate Update selected example. Confirm the same box changes without adding one. Test invalid, empty and reversed bounds; they must leave geometry unchanged. Switch to Add and confirm numeric entry can still create a new box.
4. Interrupt an add, move and resize, then repeat while placing a second finger on the preview. Release the fingers in both orders. Confirm the unfinished operation is discarded, no late event commits it, and earlier boxes, counts and the saved reference remain unchanged. If pointer-cancel or lost-capture behavior cannot be exercised on the device, record it as untested.
5. In a pinned draft, combine add, move, resize and delete operations; save with at least one valid example remaining. One Undo must restore the full previous reference and Redo the saved update. Repeat with Discard, Escape where available and dialog close; reopening must show the last saved boxes. Try saving without changes and removing all boxes; neither may commit an invalid reference or add a no-op history entry.
6. Save a valid edit, reload and restore the draft, then export/import viewer HTML. Verify the saved boxes, source snapshot and counts survive. Repeat the basic selection/move/resize/save path with the self-extract variant and verify detection can run using the saved examples.

These are acceptance procedures, not completed test results. Model assets, runtime dependencies and stored reference format are unchanged by dev.8.


## Batch reuse and portable work (dev.11; device check pending)

1. With pinned examples, run Detect all photos on at least six photos at CPU / FP32 / 5%. Record device/browser, completion count and elapsed seconds. Stop midway, then run again; completed additions remain and one Undo reverses the completed part of that run. Watch for tab reloads or sustained memory pressure.
2. Choose Save → Save work as HTML and edit the filename. Reopen via Open work in the app; verify photos, pinned examples, review flags and counts. Directly opening the downloaded HTML is a read-only viewer, not the editor.
3. From an active work, choose Save → Open work. Cancel replacement once and check the original work remains; then accept a valid saved file. Browser autosave now belongs to the newly opened work. Check controls in portrait/landscape, including scrolling the save dialog.

These are device acceptance steps; desktop localhost checks are recorded separately in QUICK_DETECTION_VALIDATION.md.
