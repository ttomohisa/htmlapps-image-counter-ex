# Model lab (AGPL-3.0-only)

This directory is distributed under GNU AGPL version 3, separately from the
historical MIT application sources. See `COPYING`. `model.py` adapts the supplied
browser-yoloe-poc-v0.2.0 wrapper and uses Ultralytics YOLOE components. Ultralytics
code and checkpoints carry their own AGPL/commercial licensing terms:
https://www.ultralytics.com/license and https://github.com/ultralytics/ultralytics.
The original upstream copyright notices in dependencies remain applicable.

Use Python 3.13 and install `requirements.txt` in a development venv. The app has
no Python dependency. Official checkpoint sources (never load untrusted pickle):

- https://github.com/ultralytics/assets/releases/download/v8.4.0/yoloe-26n-seg.pt
- https://github.com/ultralytics/assets/releases/download/v8.4.0/yoloe-26s-seg.pt

```
python scripts/model_lab/export.py --size n --weights /path/yoloe-26n-seg.pt --output /path/browser-yoloe-26n-fp32.onnx
python scripts/model_lab/compact.py /path/browser-yoloe-26n-fp32.onnx /path/browser-yoloe-26n-compact-fp32.onnx
python scripts/model_lab/evaluate.py --pack usecases=/path/usecase-pack --pack apples=/path/apple-pack --weights-n /path/yoloe-26n-seg.pt --weights-s /path/yoloe-26s-seg.pt --output /path/results
python scripts/model_lab/validate_compact.py --pack usecases=/path/usecase-pack --pack apples=/path/apple-pack --original /path/browser-yoloe-26n-fp32.onnx --compact /path/browser-yoloe-26n-compact-fp32.onnx --output /path/results
```

The exporter retains the one2many head and static 640px image, 80px mask and
512-dimensional prompt ABI. It does not export segmentation, text prompts or the
one2one head. The compact graph stores eligible initializers in FP16 and casts
them to FP32 before existing operators. Input, output and computations remain
FP32. Choose **CPU / FP32** in Image Counter EX for this compact graph.

This is lossy weight storage, not lossless compression. Revalidate on the target
photos and browser. It reduces file size, not necessarily runtime memory or
latency. All large FP32 tensors are retained if nonfinite or outside FP16 range.

The local validation report includes exact versions, input hashes, fixed exemplar
coordinates, original and compact counts and output differences. Different export
toolchain versions may change serialized hashes even with equivalent outputs.
The validation environment used CPU wheels (`torch 2.10.0+cpu` and
`torchvision 0.25.0+cpu`); requirements pin public version numbers and direct
NumPy/Pillow/OpenCV dependencies. Use the CPU wheels for comparable timings.
Keep the source checkpoint hash and the full build/source package when distributing
a model. A separately loaded model does not by itself settle the combined work's
license obligations. For an AGPL model-embedded release, distribute the combined
work under compatible terms with corresponding source and license notices.
