# Third-Party Notices

## Embedded ONNX Runtime Web

| Package | Version | Assets | License |
| --- | --- | --- | --- |
| onnxruntime-web | 1.29.0 | ort.wasm.bundle.min.mjs; ort-wasm-simd-threaded.wasm | MIT |
| onnxruntime-web | 1.27.0 | ort.webgpu.bundle.min.mjs; ort-wasm-simd-threaded.asyncify.wasm | MIT |

Homepage: https://onnxruntime.ai/ · Source: https://github.com/microsoft/onnxruntime

Exact package versions, original SHA-256 hashes and storage sizes are recorded in the generated dependency manifest. These assets are embedded in the editor, not the exported result viewer. The npm bundle headers retain their included license notices.

## User-supplied model and build-time reference

No model weights, ONNX models, Python packages or reference PoC ZIP are tracked or embedded in the release HTML. The developer regenerated local FP32/FP16 models from the supplied PoC v0.2.0 reference, using Ultralytics 8.4.131 and yoloe-26n-seg.pt. Reference files and generated binaries remain in ignored local build storage.

Ultralytics describes its code/model licensing through AGPL-3.0 or an Enterprise license: https://www.ultralytics.com/license (checked 2026-10-22). Keeping weights external is not a finding that the combined integration is exempt. The existing app's MIT license does not grant model rights or establish compatibility for an integrated distribution. Resolving applicable obligations and any corresponding-source requirements is a separate release gate. This development branch must not be presented as an unrestricted MIT-only model/application distribution.

The supplied PoC informed the runtime prompt contract and letterbox/mask/NMS implementation. The first integration does not include its tile pipeline or Python source in release HTML.

## Other development tooling

The repository includes GitHub Actions workflow files inherited from the Browser Kitty HTML app template. Those workflows reference GitHub-maintained actions under the terms published by their respective projects.

## ONNX Runtime license

MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
# Model development tools (2026-10-23)

`scripts/model_lab/` and its exported YOLOE models are covered by AGPL-3.0-only;
see `scripts/model_lab/COPYING` and its README for checkpoint provenance and
reproduction. The historical application source license does not relicense
these tools, upstream Ultralytics code, or model weights. Model weights are not
embedded in the current HTML. An eventual combined model-embedded distribution
must carry compatible licensing, corresponding source and required notices.
Official licensing: https://www.ultralytics.com/license.
