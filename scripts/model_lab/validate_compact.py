# SPDX-License-Identifier: AGPL-3.0-only
from pathlib import Path
import json,time
import numpy as np, torch, onnxruntime as ort
from PIL import Image
from evaluate import pack_arguments,letterbox_image,prompt_mask_from_boxes,accepted,point_match
import argparse
ap=argparse.ArgumentParser();ap.add_argument("--pack",action="append",required=True);ap.add_argument("--original",type=Path,required=True);ap.add_argument("--compact",type=Path,required=True);ap.add_argument("--output",type=Path,required=True);args=ap.parse_args()
packs=pack_arguments(args);outdir=args.output;outdir.mkdir(parents=True,exist_ok=True)
from ultralytics.data.augment import LoadVisualPrompt
opts=ort.SessionOptions();opts.intra_op_num_threads=2
original=ort.InferenceSession(str(args.original),sess_options=opts,providers=['CPUExecutionProvider'])
compact=ort.InferenceSession(str(args.compact),sess_options=opts,providers=['CPUExecutionProvider'])
rows=[]
for group,pack in packs:
 data=json.loads((pack/'sources-and-annotations.json').read_text(encoding='utf-8'))
 for sample in data['samples']:
  image,meta=letterbox_image(Image.open(pack/sample['file']))
  for n in [1,3]:
   boxes=[]
   for e in sample['examples'][:n]:
    l,u,r,b=e['percent_left_top_right_bottom'];boxes.append(meta.source_box_to_model([l/100*meta.source_width,u/100*meta.source_height,r/100*meta.source_width,b/100*meta.source_height]))
   mask=prompt_mask_from_boxes(boxes)
   official=LoadVisualPrompt().get_visuals(torch.zeros(n,dtype=torch.int), (640,640),bboxes=torch.tensor(boxes,dtype=torch.float32)).numpy()[None]
   mask_diff=int(np.count_nonzero(mask!=official))
   outputs=[];elapsed=[]
   for session in [original,compact]:
    start=time.perf_counter()
    vpe=session.run(['vpe'],{'image':image,'vp_mask':mask,'prompt':np.zeros((1,1,512),np.float32)})[0]
    _,bb,ss=session.run(None,{'image':image,'vp_mask':np.zeros_like(mask),'prompt':vpe})
    elapsed.append(time.perf_counter()-start);outputs.append((vpe,bb[0],ss[0]))
   a,b=outputs
   row=dict(group=group,file=sample['file'],examples=n,gt=sample['reference_count'],mask_exact=not mask_diff,mask_diff_cells=mask_diff,max_abs=dict(vpe=float(np.abs(a[0]-b[0]).max()),boxes=float(np.abs(a[1]-b[1]).max()),scores=float(np.abs(a[2]-b[2]).max())),seconds=elapsed,thresholds={})
   for t in [.01,.05,.1,.25]:
    aa,sa=accepted(a[1],a[2],meta,t);bb,sb=accepted(b[1],b[2],meta,t)
    row['thresholds'][str(t)]={'original_count':len(aa),'compact_count':len(bb),'compact_boxes':bb.tolist(),'compact_scores':sb.tolist(),'compact_matches':point_match(bb,sample['points_xy'],meta.source_width,meta.source_height) if sample.get('points_xy') else None}
   rows.append(row)
  print(group,sample['file'],flush=True)
  (outdir/'compact-validation.json').write_text(json.dumps(rows),encoding='utf-8')
print('DONE',len(rows),flush=True)
