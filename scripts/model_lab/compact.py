# SPDX-License-Identifier: AGPL-3.0-only
"""FP16 storage only: reconstruct FP32 weights before existing operators.

No FP16 Conv or activation is introduced. This reduces the download/file size,
not necessarily the expanded session's memory footprint or inference time.
"""
from pathlib import Path
import argparse, hashlib, json
import numpy as np
import onnx
from onnx import numpy_helper, helper, TensorProto

def compact(source,output):
    model=onnx.load(source)
    used={s for n in model.graph.node for s in [*n.input,*n.output]}
    used.update(x.name for x in model.graph.initializer)
    casts=[];converted=0
    for tensor in model.graph.initializer:
        if tensor.data_type!=TensorProto.FLOAT:continue
        array=numpy_helper.to_array(tensor)
        if array.size<16 or not np.isfinite(array).all() or np.abs(array).max()>65504:continue
        name=tensor.name;stored=name+'__stored_fp16'
        if stored in used:raise ValueError('Tensor name collision: '+stored)
        used.add(stored)
        tensor.CopyFrom(numpy_helper.from_array(array.astype(np.float16),stored))
        casts.append(helper.make_node('Cast',[stored],[name],name=stored+'__decode',to=TensorProto.FLOAT))
        converted+=1
    nodes=list(model.graph.node);del model.graph.node[:];model.graph.node.extend(casts+nodes)
    onnx.checker.check_model(model,full_check=True)
    onnx.save(model,output)
    return dict(source_bytes=Path(source).stat().st_size,output_bytes=Path(output).stat().st_size,converted_tensors=converted,sha256=hashlib.sha256(Path(output).read_bytes()).hexdigest(),compute='float32',weight_storage='float16')

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('output',type=Path);args=ap.parse_args()
    result=compact(args.source,args.output);args.output.with_suffix('.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
