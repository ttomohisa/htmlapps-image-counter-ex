# SPDX-License-Identifier: AGPL-3.0-only
"""Export released YOLOE26 visual-prompt weights for the Image Counter EX ABI.

Download trusted official Ultralytics checkpoints separately. PyTorch checkpoint
loading executes pickle; do not pass files from untrusted sources.
"""
import argparse
import hashlib
import json
from pathlib import Path

import onnx
import torch
from ultralytics import YOLOE
from model import BrowserYOLOE
from compact import compact

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--size',choices=['n','s'],default='n')
    ap.add_argument('--weights',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args()
    torch.set_num_threads(2);torch.set_grad_enabled(False)
    core=YOLOE(f'yoloe-26{args.size}.yaml').load(str(args.weights)).model.eval()
    wrapper=BrowserYOLOE(core).eval().cpu()
    image=torch.zeros(1,3,640,640);mask=torch.zeros(1,1,80,80);mask[:,:,30:50,30:50]=1
    prompt=torch.zeros(1,1,512)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    torch.onnx.export(wrapper,(image,mask,prompt),str(args.output),input_names=['image','vp_mask','prompt'],output_names=['vpe','boxes','scores'],opset_version=17,do_constant_folding=True,dynamo=False)
    onnx.checker.check_model(onnx.load(args.output),full_check=True)
    compact_path=args.output.with_name(args.output.stem+'-compact.onnx')
    metadata=compact(args.output,compact_path)
    metadata.update(architecture=f'YOLOE26{args.size} visual prompt one2many detection',source_checkpoint_sha256=hashlib.sha256(args.weights.read_bytes()).hexdigest(),source_checkpoint_bytes=args.weights.stat().st_size,fp32_sha256=hashlib.sha256(args.output.read_bytes()).hexdigest(),license='AGPL-3.0-only',ultralytics='8.4.131',opset=17)
    compact_path.with_suffix('.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print(json.dumps(metadata,indent=2))

if __name__=='__main__':main()
