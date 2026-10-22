# Detection investigation — 2026-10-23

This is development-set evidence, not a general accuracy guarantee. The original
12 apple photos and six countable use-case inputs were held fixed, with the
original first exemplar or all three exemplars. A seventh full steel photo has
no reliable reference count and is excluded from scored aggregates; its crop is
already one of the six use cases. No evaluation photos are published in this repo.

## Findings

1. **Threshold calibration is the largest actionable cause.** Visual-prompt
   YOLOE26n scores are often below the former 25% cutoff even on clearly repeated
   objects. The default becomes 5%, with 1% available for more recall. Users still
   review and explicitly apply candidates; score percentages are not accuracy.
2. **No evidence of a broken ONNX conversion.** On the six initial steel/cans/
   screws probes, identical tensors and prompts yielded VPE error below 4e-7,
   score error below 5e-6 and box-coordinate error below 0.008 model pixels between
   the FP32 wrapper and native ONNX. This comparison does not test browser resize.
3. **RGB, 0–1 normalization, 640px letterboxing, 114 padding, xyxy decoding and
   same-class OR prompt masks agree with the intended pipeline.** PIL vs OpenCV
   interpolation changed few counts and did not explain the main deficit.
   Official float32 mask rasterization and our double-coordinate rasterization
   match on all scored inputs; the full steel image differs in 3/6400 boundary
   cells. No production preprocessing change was justified by these results.
4. **The branch choice is deliberate, not equivalent to official defaults.** The
   wrapper retains one2many + NMS while official YOLOE26 defaults to one2one.
   Both branches were compared. Switching to one2one did not consistently improve
   this task. The current branch remains.
5. **A bigger model does not automatically fix counting.** YOLOE26s, loaded with
   the official architecture/checkpoint, was tested using both branches and four
   thresholds. At 5%, three exemplars, its use-case MAE is 4.83 vs 1.00 for 26n.
   At 1% it improves to 0.50 but apples still have MAE 17.08. Its FP32 exported
   graph is 44.21 MiB (compact storage 22.28 MiB), compared with 26n at 12.54 MiB
   (compact 6.44 MiB). Retain 26n for the small browser target.

## Controlled native comparison

CPU PyTorch, PIL bilinear preprocessing, one2many, identical fixed three examples.
Candidate counts follow the app's NMS .5, containment .8 and minimum box .003.

| Group | 26n @25% MAE | @10% MAE | @5% MAE | @1% MAE |
|---|---:|---:|---:|---:|
| Six use-case inputs | 15.33 | 2.50 | 1.00 | 2.17 |
| Twelve apple photos | 33.42 | 28.83 | 25.25 | 18.33 |

MAE is mean absolute error in **number of objects per image**. Count agreement
can hide both misses and false positives. A secondary localization proxy uses
maximum one-to-one matching, allowing a match only when an annotated object point
is inside a predicted box. On six use cases at 5%, three exemplars, 181/186
predictions match points and 181/184 points are covered. At 25%, the corresponding
values are 91/92 and 91/184. These are **point-containment proxies**, not audited
detection precision/recall or box-IoU AP; loose or partial boxes can still match.
The local HTML report supplies overlays for visual inspection.

Thresholds were selected after observing these photos. Independent user-domain
photos and negative/control scenes are still needed to assess generalization.
Dense apples remain undercounted. Consider crop/tiling and counting-specialized
models next, with independent evaluation rather than fitting this subset.

## Compact CPU model

In-app Chromium, actual app CPU inference at 5% with compact weights produced
the following counts for three fixed examples: steel crop 29/27, logs 17/18,
cans 12/10, crates 17/17, bricks 11/12, screws 100/100. The prior browser 25%
baseline counts were 11, 11, 9, 7, 6, 46 respectively. Browser MAE improves from
15.67 to 1.00. With one example it improves from 26.67 to 3.00. These before/after
browser figures change threshold and weight storage together; the controlled
native comparisons above isolate their effects.

`scripts/model_lab/compact.py` stores eligible weights as FP16 and restores FP32
before computation. This works with the existing CPU/FP32 UI and avoids requiring
GPU FP16 support. File size: 13,151,186 → 6,756,087 bytes (48.6% reduction).
SHA-256: `d33ebb16c8cb03ef4b5e1888e759b96b4e0366769287f003798c3c1c75db41ba`.

Both passes were run for all 38 exemplar/input combinations. At 5%, counts changed
in 2/38 runs by one object (apples); all six use-case counts were unchanged.
Maximum raw differences across all anchors: VPE 0.00120, score 0.01570, box 38.34
model pixels. The box maximum includes weak unused anchors; this is a lossy model,
not numerical identity. On-disk savings do not imply equivalent runtime-memory
savings: the runtime can expand/fold weights back to FP32.

The generated HTML still loads an external model. A single HTML with the compact
model appears practical by file size, but its mobile peak memory, startup behavior
and distribution/source packaging are not yet validated. No new embedded-model
or Android-device compatibility claim is made by this investigation.

## Reproduction and licensing

- `scripts/model_lab/README.md`: pinned export/compaction environment and commands.
- Local report bundle: fixed manifests, image hashes/exemplars, native comparison
  JSON (1,216 combinations), compact validation JSON (38 two-pass comparisons),
  browser candidate results/screenshots, source package and generated HTML.
- Native/PIL counts and browser/canvas counts are reported separately.
- Ultralytics 8.4.131, torch 2.10.0 CPU, torchvision 0.25.0, ONNX 1.22.0,
  native ORT 1.29.0; browser CPU ORT 1.29.0.
- The user accepts AGPL-compliant source publication. AGPL permits commercial
  use subject to its obligations; proprietary embedding is a separate licensing
  decision. Official terms: https://www.ultralytics.com/license.
- Model-lab tools and exported YOLOE weights are AGPL-3.0-only. Historical app
  sources retain their MIT notice. A future combined distribution requires
  compatible terms, corresponding source and notices. Loading the model as a
  separate file does not automatically resolve these obligations.
- Official architecture/visual prompting docs: https://docs.ultralytics.com/models/yoloe/.

Repository checks passed; readable and self-extracting HTML both ran compact
CPU inference over loopback HTTP. A 100-marker batch, Undo/Redo, saved-draft
restoration and Japanese/English controls were verified. No console errors were
observed. Direct file opening was blocked by the browser automation URL policy.
The requested 360px viewport override did not actually apply (DOM remained
1265/1280px wide), so those captures are desktop evidence, not mobile validation.
Android hardware and direct-file execution remain unverified for this build.

The local source package includes build and export code. No evaluation photos or
new model files have been pushed to GitHub Pages as part of this investigation.
