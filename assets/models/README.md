# Embedded YOLOE-26n model

The compact model is 6,756,087 bytes (6.44 MiB), validated in
[DETECTION_ACCURACY](../../docs/DETECTION_ACCURACY.md). It stores eligible weights
in FP16 and computes in FP32. This reduces download size, not necessarily runtime
memory. The browser defaults to CPU / FP32 and 5% confidence.

`metadata.json` records the original public checkpoint and compact-model hashes.
The original checkpoint is included here for corresponding source; it is not
embedded in HTML. Only the compact ONNX and `LICENSES.txt` are embedded, as pinned
local assets declared in `dependencies.json`. No evaluation photographs are shipped.

## Rebuild

Use Python 3.13, CPU PyTorch wheels and the pinned
`scripts/model_lab/requirements.txt`. From the repository root:

```sh
python scripts/model_lab/export.py --size n --weights assets/models/yoloe-26n-seg.pt --output .cache/rebuilt/browser-yoloe-26n-fp32.onnx
```

This emits a FP32 graph, a compact graph and metadata. Revalidate before replacing
the shipped graph and updating its dependency hash. Serialization may vary with
toolchain/platform. See `scripts/model_lab/` for complete transformation source.
The original checkpoint is PyTorch pickle: use only the trusted pinned file.

The integrated release is GNU AGPL v3; historical MIT notices are preserved.
See the root LICENSE, LICENSE-MIT and THIRD_PARTY_NOTICES.md.
