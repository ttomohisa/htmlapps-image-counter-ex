# Third-Party Notices

## Embedded ONNX Runtime Web

| Package | Version | Assets | License |
| --- | --- | --- | --- |
| onnxruntime-web | 1.29.0 | ort.wasm.bundle.min.mjs; ort-wasm-simd-threaded.wasm | MIT |
| onnxruntime-web | 1.27.0 | ort.webgpu.bundle.min.mjs; ort-wasm-simd-threaded.asyncify.wasm | MIT |

Homepage: https://onnxruntime.ai/ · Source: https://github.com/microsoft/onnxruntime

Exact package versions, original SHA-256 hashes and storage sizes are recorded in the generated dependency manifest. These assets are embedded in the editor, not the exported result viewer. The npm bundle headers retain their included license notices.

## Embedded YOLOE-26n and corresponding source

The 1.1.0-dev.3 editor embeds the 6.44 MiB compact YOLOE-26n model under
GNU AGPL version 3. Copyright Ultralytics; upstream source:
https://github.com/ultralytics/ultralytics (8.4.131).
Licensing: https://www.ultralytics.com/license.

The integrated distribution uses the root AGPL `LICENSE`, preserving the historical
app notice in `LICENSE-MIT` and ORT's MIT notice below and in the HTML. The in-app
Help offers the complete AGPL and historical MIT texts offline, plus a prominent
link to https://github.com/ttomohisa/htmlapps-image-counter-ex for corresponding source.

`assets/models/metadata.json` pins the shipped ONNX and original official checkpoint.
Both are tracked; `scripts/model_lab/` supplies the complete export/compaction source,
pinned dependencies and build instructions. Only the compact ONNX and license text
are embedded, not the original checkpoint, Python tooling or evaluation photos.
The user has elected the source-publication route under AGPL for this distribution.

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
