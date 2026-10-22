# SPDX-License-Identifier: AGPL-3.0-only
from pathlib import Path
import json, sys, time
import numpy as np
import torch, cv2
from PIL import Image
from model import BrowserYOLOE, letterbox_image, prompt_mask_from_boxes, nms_xyxy
from ultralytics import YOLOE
torch.set_num_threads(2);torch.set_grad_enabled(False)

def pack_arguments(args):
    packs=[]
    for entry in args.pack:
        group,path=entry.split('=',1);packs.append((group,Path(path)))
    return packs

def accepted(boxes,scores,meta,threshold):
    b=boxes.copy();cx=b[:,[0,2]].mean(1);cy=b[:,[1,3]].mean(1)
    b[:,[0,2]]=np.clip((b[:,[0,2]]-meta.pad_x)/(meta.scale*meta.source_width),0,1)
    b[:,[1,3]]=np.clip((b[:,[1,3]]-meta.pad_y)/(meta.scale*meta.source_height),0,1)
    wh=b[:,2:]-b[:,:2]
    valid=(wh>=.003).all(1)&(cx>=meta.pad_x)&(cx<meta.pad_x+meta.source_width*meta.scale)&(cy>=meta.pad_y)&(cy<meta.pad_y+meta.source_height*meta.scale)&(scores>=threshold)
    bb=b[valid];ss=scores[valid];keep=nms_xyxy(bb,ss,.5)[:1000];selected=[]
    for i in keep:
        box=bb[i];area=np.prod(box[2:]-box[:2]);duplicate=False
        for j in selected:
            other=bb[j];inter=np.prod(np.maximum(0,np.minimum(box[2:],other[2:])-np.maximum(box[:2],other[:2])));oa=np.prod(other[2:]-other[:2])
            if inter/(area+oa-inter or 1)>=.5 or inter/(min(area,oa) or 1)>=.8:duplicate=True;break
        if not duplicate:selected.append(i)
    return bb[selected],ss[selected]

def point_match(boxes,points,w,h):
    # Maximum one-to-one matching: annotation point must be inside predicted box.
    # This is a localization proxy, NOT box-IoU detection AP / true precision.
    points=np.asarray(points)/[w,h]
    edges=[np.where(((points>=b[:2])&(points<=b[2:])).all(1))[0].tolist() for b in boxes]
    matched={}
    def visit(i,seen):
        for p in edges[i]:
            if p in seen:continue
            seen.add(p)
            if p not in matched or visit(matched[p],seen):matched[p]=i;return True
        return False
    for i in range(len(boxes)):visit(i,set())
    return len(matched)

def main():
    import argparse
    ap=argparse.ArgumentParser(description='Fixed-exemplar threshold, resize and branch comparison (AGPL-3.0-only).')
    ap.add_argument('--pack',action='append',required=True,help='group=folder containing sources-and-annotations.json and photos')
    ap.add_argument('--weights-n',type=Path,required=True);ap.add_argument('--weights-s',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    outdir=args.output;outdir.mkdir(parents=True,exist_ok=True);packs=pack_arguments(args)
    rows=[]
    for size in ['n','s']:
        weights=args.weights_n if size=='n' else args.weights_s
        core=YOLOE(f'yoloe-26{size}.yaml').load(str(weights)).model.eval()
        wrapper=BrowserYOLOE(core).eval()
        for group,pack in packs:
            data=json.loads((pack/'sources-and-annotations.json').read_text(encoding='utf-8'))
            for sample in data['samples']:
                photo=Image.open(pack/sample['file']).convert('RGB');base,meta=letterbox_image(photo)
                for resize in ['pil','opencv']:
                    image=base.copy()
                    if resize=='opencv':
                        nw=round(meta.source_width*meta.scale);nh=round(meta.source_height*meta.scale)
                        resized=cv2.resize(np.asarray(photo),(nw,nh),interpolation=cv2.INTER_LINEAR)
                        image[0,:,meta.pad_y:meta.pad_y+nh,meta.pad_x:meta.pad_x+nw]=resized.transpose(2,0,1).astype(np.float32)/255
                    t=torch.from_numpy(image)
                    features=wrapper._features(t)
                    for n in [1,3]:
                        boxes=[]
                        for e in sample['examples'][:n]:
                            l,u,r,b=e['percent_left_top_right_bottom'];boxes.append(meta.source_box_to_model([l/100*meta.source_width,u/100*meta.source_height,r/100*meta.source_width,b/100*meta.source_height]))
                        mask=prompt_mask_from_boxes(boxes);mt=torch.from_numpy(mask)
                        vpe=wrapper.savpe(features,mt)
                        pred=core.model[-1]([*features,vpe])[1]
                        for branch in ['one2many','one2one']:
                            raw=core.model[-1]._inference(pred[branch])[0].numpy()
                            for threshold in [.01,.05,.1,.25]:
                                bb,ss=accepted(raw[:4].T,raw[4],meta,threshold)
                                pts=sample.get('points_xy',[])
                                matches=point_match(bb,pts,meta.source_width,meta.source_height) if pts else None
                                row=dict(group=group,file=sample['file'],title=sample['title_ja'],model=size,resize=resize,examples=n,branch=branch,threshold=threshold,gt=sample['reference_count'],count=len(bb),point_matches=matches,boxes=bb.tolist(),scores=ss.tolist())
                                rows.append(row)
                print(size,group,sample['file'],flush=True)
                (outdir/'comparison.json').write_text(json.dumps(rows,ensure_ascii=False),encoding='utf-8')
    print('DONE',len(rows),flush=True)

if __name__=='__main__':main()
