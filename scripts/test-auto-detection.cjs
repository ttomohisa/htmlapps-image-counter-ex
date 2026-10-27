const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let source = fs.readFileSync(process.env.IMAGE_COUNTER_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const outerSource = source;
if (source.includes('id="self-extract-payload"')) source = require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1], 'base64')).toString('utf8');
test('every enclosing document policy permits local WASM while retaining network isolation',()=>{
  for(const html of new Set([outerSource,source])){
    const policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    const scripts=policy.split(';').find(p=>p.trim().startsWith('script-src '));
    assert.ok(scripts.includes("'wasm-unsafe-eval'"),'An enclosing CSP blocks WebAssembly compilation');
    assert.ok(!scripts.includes("'unsafe-eval'"),'JavaScript eval must remain blocked');
    assert.match(policy,/connect-src 'none'(?:;|$)/);
  }
});
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Production section missing: ${start}`);return source.slice(a,b);}
function core(){
  const c={setMode(){},resetReviewSelection(){},cancelMarkerInteraction(){},pointers:new Map(),gesture:null,Float32Array,Number,Math,Date,structuredClone,Set,Map,Array,Error};vm.createContext(c);
  vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END'),c);return c;
}
const plain = value => JSON.parse(JSON.stringify(value));
const box=(x,y,w,h,score=.9)=>({x,y,w,h,score});

test('default visual search retains low-score objects without duplicating overlapping boxes',()=>{
  const select=source.match(/<select id="autoThreshold"[^>]*>([\s\S]*?)<\/select>/)[1];
  const options=[...select.matchAll(/<option value="([^"]+)"([^>]*)>/g)];
  const threshold=Number(options.find(x=>/\bselected\b/.test(x[2]))[1]);
  const c=core(),boxes=new Float32Array([64,64,128,128, 66,66,130,130, 320,320,384,384, 450,450,500,500]);
  const scores=new Float32Array([.07,.06,.08,.02]);
  const result=c.autoCandidates(boxes,scores,c.autoLetterbox(640,640),threshold);
  assert.equal(result.candidates.length,2,'default should recover two weak objects, suppress their duplicate and reject noise');
  assert.equal(threshold,.05);
  assert.ok(options.some(x=>Number(x[1])===.01),'very low-score recovery must be selectable');
  assert.equal(c.autoFilter(result.candidates,[]).accepted.length,2);
});
test('letterbox keeps original aspect ratio, padding and half-to-even rounding',()=>{
  const c=core();assert.deepEqual(plain(c.autoLetterbox(1200,600)),{width:1200,height:600,scale:640/1200,w:640,h:320,padX:0,padY:160});
  assert.deepEqual([c.autoRoundEven(2.5),c.autoRoundEven(3.5)],[2,4]);
  assert.throws(()=>c.autoLetterbox(0,1));assert.throws(()=>c.autoLetterbox(Infinity,1));
});
test('multiple examples form an OR mask, with no count of overlap and padding retained',()=>{
  const c=core(),mask=c.autoPromptMask([box(0,0,.5,1),box(.25,0,.5,1)],c.autoLetterbox(1200,600));
  assert.equal(mask.length,6400);assert.equal(mask.reduce((a,b)=>a+b,0),2400);
  assert.equal(mask[19*80],0);assert.equal(mask[20*80+59],1);assert.equal(mask[20*80+60],0);
  assert.throws(()=>c.autoPromptMask([],c.autoLetterbox(1200,600)));
});
test('model boxes return to normalized original pixels and reject padding, NaN and tiny boxes',()=>{
  const c=core(),r=c.autoCandidates(new Float32Array([64,192,192,256, 0,0,40,40, 0,160,.2,160.2, 64,192,192,256]),new Float32Array([.9,.9,.9,NaN]),c.autoLetterbox(1200,600),.25);
  assert.equal(r.candidates.length,1);const b=r.candidates[0];
  assert.ok(Math.abs(b.x-.1)<1e-6);assert.ok(Math.abs(b.y-.1)<1e-6);assert.ok(Math.abs(b.w-.2)<1e-6);assert.ok(Math.abs(b.h-.2)<1e-6);
  assert.throws(()=>c.autoCandidates([1,2],[.5],c.autoLetterbox(1,1),.25));
});
test('NMS retains the strongest box and limits preview with an explicit truncation count',()=>{
  const c=core(),r=c.autoCandidates([0,0,64,64, 1,1,65,65, 320,320,384,384],[.6,.9,.8],c.autoLetterbox(640,640),.25,1);
  assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].score,.9);assert.equal(r.truncated,1);
});
test('duplicate filtering covers hidden/different types, points, containment and the new batch',()=>{
  const c=core(),r=c.autoFilter([box(.1,.1,.2,.2),box(.5,.5,.2,.2),box(.8,.8,.1,.1),box(.8,.8,.1,.1)],
    [{shape:'point',x:.15,y:.15,categoryId:'hidden'}, {shape:'rect',x:.51,y:.51,w:.18,h:.18,categoryId:'other'}]);
  assert.equal(r.accepted.length,1);assert.equal(r.duplicates,3);
});
test('out-of-bounds and invalid candidate geometry cannot enter a project',()=>{
  const c=core(),r=c.autoFilter([box(-.1,0,.1,.1),box(.99,0,.1,.1),box(0,0,NaN,.1),box(0,0,.002,.1)],[]);
  assert.equal(r.accepted.length,0);assert.equal(r.invalid,4);
});
test('valid imported rectangles smaller than the drawing minimum still prevent duplicate counts',()=>{
  const c=core(),r=c.autoFilter([box(.1,.1,.05,.05)],[{shape:'rect',x:.12,y:.12,w:.002,h:.002}]);
  assert.equal(r.accepted.length,0);assert.equal(r.duplicates,1);
});
function editor(){
  const c=core(),saved=[];Object.assign(c,{P:{title:'Test',categories:[{id:'a'}],settings:{},images:[{id:'one',dataUrl:'data:original',width:1200,height:600,name:'one',note:'',completed:true,adjustments:{rotation:90},markers:[]}]},activeImageId:'one',activeCategoryId:'a',selectedMarkerId:null,lastMarkerId:null,lastMarkerAt:0,history:[],future:[],id:(()=>{let n=0;return()=>`id-${++n}`;})(),$:()=>({}),renderAll(){},renderStorageSoon(){},scheduleSave:()=>saved.push(1)});
  c.activeImage=()=>c.P.images.find(im=>im.id===c.activeImageId);
  vm.runInContext(section('function cloneLight()','function dataUrlBytes(')+section('function nextOrder(im)','function addPoint('),c);
  return{c,saved,owner:{project:c.P,imageId:'one',dataUrl:'data:original'}};
}
test('application is one Undo entry, reopens completed image, saves and preserves normal markers',()=>{
  const {c,saved,owner}=editor();assert.equal(c.applyAutoCandidates(owner,[box(.1,.1,.2,.2),box(.6,.5,.2,.2)],'a'),2);
  assert.equal(c.history.length,1);assert.equal(saved.length,1);assert.equal(c.P.images[0].completed,false);
  assert.equal(c.P.images[0].markers[0].shape,'rect');assert.equal(c.P.images[0].markers[0].needsReview,false);
  assert.equal(c.P.images[0].markers[1].order,2);assert.equal(new Set(c.P.images[0].markers.map(m=>m.id)).size,2);
  c.undo();assert.equal(c.P.images[0].markers.length,0);assert.equal(c.P.images[0].completed,true);
  c.redo();assert.equal(c.P.images[0].markers.length,2);assert.equal(c.P.images[0].completed,false);
});
test('reapplying candidates or applying zero results does not add history or clear redo',()=>{
  const {c,saved,owner}=editor(),items=[box(.1,.1,.2,.2)];c.applyAutoCandidates(owner,items,'a');
  c.future.push({sentinel:true});assert.equal(c.applyAutoCandidates(owner,items,'a'),0);
  assert.equal(c.applyAutoCandidates(owner,[],'a'),0);assert.equal(c.history.length,1);assert.equal(saved.length,1);assert.equal(c.future.length,1);
});
test('stale project, image pixels, selected image or deleted category cannot apply',()=>{
  for(const alter of [o=>o.project={},o=>o.dataUrl='data:changed',o=>o.imageId='other']){
    const {c,owner}=editor();alter(owner);assert.equal(c.applyAutoCandidates(owner,[box(.1,.1,.2,.2)],'a'),0);assert.equal(c.history.length,0);
  }
  const {c,owner}=editor();assert.equal(c.applyAutoCandidates(owner,[box(.1,.1,.2,.2)],'missing'),0);assert.equal(c.P.images[0].completed,true);
});
test('rotated portrait examples map back to original normalized rectangles',()=>{
  const c=core();vm.runInContext(section('function toDisplayNorm(','function canvasCssSize('),c);
  assert.deepEqual(plain(c.autoOriginalRect(.2,.1,.6,.4,90)),{x:.1,y:.4,w:.30000000000000004,h:.4});
  const b=c.autoOriginalRect(.8,.9,.4,.6,270);assert.ok(Math.abs(b.x-.1)<1e-8);assert.ok(Math.abs(b.y-.4)<1e-8);
});
function engine(){const c=core();vm.runInContext(section('// AUTO:ENGINE:BEGIN','// AUTO:ENGINE:END'),c);return c;}
function runtimeFixture(bad=false){
  const tensors=[];class Tensor{constructor(type,data,dims){Object.assign(this,{type,data,dims,disposed:false});tensors.push(this)}dispose(){this.disposed=true}}
  let calls=0;const session={inputNames:['image','vp_mask','prompt'],outputNames:['vpe','boxes','scores'],async run(feeds){
    assert.deepEqual([...feeds.image.dims],[1,3,640,640]);assert.deepEqual([...feeds.vp_mask.dims],[1,1,80,80]);assert.deepEqual([...feeds.prompt.dims],[1,1,512]);
    if(calls++===0){assert.equal(feeds.prompt.data[0],0);assert.equal(feeds.vp_mask.data[0],1)}else{assert.equal(feeds.prompt.data[0],.5);assert.equal(feeds.vp_mask.data.reduce((a,b)=>a+b,0),0)}
    return{vpe:new Tensor('float32',new Float32Array(512).fill(.5),[1,1,bad?511:512]),boxes:new Tensor('float32',new Float32Array(8400*4),[1,8400,4]),scores:new Tensor('float32',new Float32Array(8400),[1,8400])};
  }};return{ort:{Tensor},session,tensors,calls:()=>calls};
}
test('two-pass model run uses extracted prompt and zero target mask, and disposes every tensor',async()=>{
  const c=engine(),f=runtimeFixture(),mask=new Float32Array(6400);mask[0]=1;
  const out=await c.autoRunModel(f.ort,f.session,new Float32Array(3*640*640),mask);
  assert.equal(f.calls(),2);assert.equal(out.boxes.length,33600);assert.ok(f.tensors.every(t=>t.disposed));
});

test('a batch reuses its copied prompt for later targets and disposes every per-image tensor',async()=>{
  const c=engine(),f=runtimeFixture(),mask=new Float32Array(6400),cache={};mask[0]=1;
  const first=await c.autoRunModel(f.ort,f.session,new Float32Array(3*640*640),mask,undefined,cache);
  const second=await c.autoRunModel(f.ort,f.session,new Float32Array(3*640*640),null,undefined,cache);
  assert.equal(f.calls(),3,'one reference pass and two target passes');
  assert.deepEqual(second,first);assert.ok(f.tensors.every(t=>t.disposed));
});

test('batch Worker creates one session, extracts one prompt and closes all transferred bitmaps',async()=>{
  const c=core(),f=runtimeFixture(),messages=[],bitmaps=[];let creates=0,releases=0;
  Object.assign(f.ort,{env:{wasm:{}},InferenceSession:{async create(){creates++;return f.session}}});f.session.release=async()=>{releases++};
  Object.assign(c,{self:{postMessage:data=>messages.push(data)},performance:{now:()=>0},importOrt:async()=>f.ort,OffscreenCanvas:class{getContext(){return{fillRect(){},drawImage(){},getImageData(){return{data:new Uint8Array(640*640*4)}}}}}});
  vm.runInContext(section('// AUTO:ENGINE:BEGIN','// AUTO:ENGINE:END').replace('import(data.moduleUrl)','importOrt(data.moduleUrl)'),c);await c.autoDetectWorker();
  const bitmap=()=>{const b={width:640,height:640,closed:0,close(){this.closed++}};bitmaps.push(b);return b};
  await c.self.onmessage({data:{batch:true,requestId:1,moduleUrl:'local',wasm:new ArrayBuffer(1),model:new ArrayBuffer(1),bitmap:bitmap(),referenceBitmap:bitmap(),examples:[box(0,0,1,1)],backend:'wasm',precision:'fp32',threshold:.05}});
  await c.self.onmessage({data:{batch:true,requestId:2,bitmap:bitmap(),threshold:.05}});
  assert.equal(creates,1);assert.equal(f.calls(),3);assert.equal(releases,0);
  assert.deepEqual(messages.filter(m=>m.phase==='result').map(m=>m.requestId),[1,2]);assert.ok(bitmaps.every(b=>b.closed===1));assert.ok(f.tensors.every(t=>t.disposed));
});

test('non-batch Worker remains two-pass and releases its session after the result',async()=>{
  const c=core(),f=runtimeFixture(),messages=[],bitmaps=[];let releases=0;
  Object.assign(f.ort,{env:{wasm:{}},InferenceSession:{create:async()=>f.session}});f.session.release=async()=>{releases++};
  Object.assign(c,{self:{postMessage:data=>messages.push(data)},performance:{now:()=>0},importOrt:async()=>f.ort,OffscreenCanvas:class{getContext(){return{fillRect(){},drawImage(){},getImageData(){return{data:new Uint8Array(640*640*4)}}}}}});
  vm.runInContext(section('// AUTO:ENGINE:BEGIN','// AUTO:ENGINE:END').replace('import(data.moduleUrl)','importOrt(data.moduleUrl)'),c);await c.autoDetectWorker();
  const bitmap={width:640,height:640,closed:0,close(){this.closed++}};
  await c.self.onmessage({data:{moduleUrl:'local',wasm:new ArrayBuffer(1),model:new ArrayBuffer(1),bitmap,examples:[box(0,0,1,1)],backend:'wasm',precision:'fp32',threshold:.05}});
  assert.equal(f.calls(),2);assert.equal(releases,1);assert.equal(bitmap.closed,1);assert.deepEqual(messages.map(m=>m.phase),['processing','result']);assert.equal(messages[1].requestId,undefined);assert.ok(f.tensors.every(t=>t.disposed));
});

test('a later batch inference failure releases the retained session and both target bitmaps',async()=>{
  const c=core(),f=runtimeFixture(),messages=[];let releases=0;
  Object.assign(f.ort,{env:{wasm:{}},InferenceSession:{create:async()=>f.session}});f.session.release=async()=>{releases++};
  const run=f.session.run;f.session.run=async feeds=>{const out=await run(feeds);if(f.calls()===3)out.scores.data[0]=NaN;return out};
  Object.assign(c,{self:{postMessage:data=>messages.push(data)},performance:{now:()=>0},importOrt:async()=>f.ort,OffscreenCanvas:class{getContext(){return{fillRect(){},drawImage(){},getImageData(){return{data:new Uint8Array(640*640*4)}}}}}});
  vm.runInContext(section('// AUTO:ENGINE:BEGIN','// AUTO:ENGINE:END').replace('import(data.moduleUrl)','importOrt(data.moduleUrl)'),c);await c.autoDetectWorker();
  const bitmaps=[0,1].map(()=>({width:640,height:640,closed:0,close(){this.closed++}}));
  await c.self.onmessage({data:{batch:true,requestId:1,moduleUrl:'local',wasm:new ArrayBuffer(1),model:new ArrayBuffer(1),bitmap:bitmaps[0],examples:[box(0,0,1,1)],backend:'wasm',precision:'fp32',threshold:.05}});
  await c.self.onmessage({data:{batch:true,requestId:2,bitmap:bitmaps[1],threshold:.05}});
  assert.equal(releases,1);assert.equal(messages.at(-1).phase,'error');assert.equal(messages.at(-1).code,'autoInvalidOutput');assert.equal(messages.at(-1).requestId,2);assert.ok(bitmaps.every(b=>b.closed===1));assert.ok(f.tensors.every(t=>t.disposed));
});
test('incompatible model outputs stop before the second run and still dispose tensors',async()=>{
  const c=engine(),f=runtimeFixture(true),mask=new Float32Array(6400);mask[0]=1;
  await assert.rejects(c.autoRunModel(f.ort,f.session,new Float32Array(3*640*640),mask),/autoInvalidOutput/);
  assert.equal(f.calls(),1);assert.ok(f.tensors.every(t=>t.disposed));
});
for(const [field,value] of [['boxes',NaN],['boxes',Infinity],['scores',NaN],['scores',Infinity],['scores',-.1],['scores',1.1]])test(`invalid raw ${field} (${value}) cannot become empty replacement output and still disposes tensors`,async()=>{
  const c=engine(),f=runtimeFixture(),mask=new Float32Array(6400);mask[0]=1;
  const run=f.session.run;f.session.run=async feeds=>{const out=await run(feeds);if(f.calls()===2)out[field].data[0]=value;return out};
  await assert.rejects(c.autoRunModel(f.ort,f.session,new Float32Array(3*640*640),mask),/autoInvalidOutput/);
  assert.equal(f.calls(),2);assert.ok(f.tensors.every(t=>t.disposed));
});
test('fixed examples extract their prompt from the reference photo and detect on the target photo',async()=>{
  const c=engine(),tensors=[],images=[],masks=[];
  class Tensor{constructor(type,data,dims){Object.assign(this,{type,data,dims});tensors.push(this)}dispose(){this.disposed=true}}
  const session={inputNames:['image','vp_mask','prompt'],outputNames:['vpe','boxes','scores'],async run(feeds){
    images.push(feeds.image.data[0]);masks.push(feeds.vp_mask.data[0]);
    return{vpe:new Tensor('float32',new Float32Array(512).fill(.5),[1,1,512]),boxes:new Tensor('float32',new Float32Array(33600),[1,8400,4]),scores:new Tensor('float32',new Float32Array(8400),[1,8400])};
  }};
  const target=new Float32Array(3*640*640).fill(.2),reference=new Float32Array(target.length).fill(.8),mask=new Float32Array(6400);mask[0]=1;
  await c.autoRunModel({Tensor},session,target,mask,reference);
  assert.ok(Math.abs(images[0]-.8)<1e-6);assert.ok(Math.abs(images[1]-.2)<1e-6);
  assert.deepEqual(masks,[1,0]);assert.ok(tensors.every(t=>t.disposed));
});
test('cancellation terminates Worker, revokes Blob URLs and invalidates late messages',()=>{
  const c=engine();let stopped=0;const revoked=[];
  Object.assign(c,{URL:{revokeObjectURL:url=>revoked.push(url)},autoState:{generation:4,job:{terminate:()=>stopped++},urls:['blob:a','blob:b'],busy:true}});
  c.autoStopJob();assert.equal(stopped,1);assert.deepEqual(revoked,['blob:a','blob:b']);assert.equal(c.autoState.generation,5);assert.equal(c.autoState.job,null);assert.equal(c.autoState.busy,false);
});
test('job ownership rejects stale generation, replaced project and changed model',()=>{
  const c=engine(),project={},file={};Object.assign(c,{P:project,activeImage:()=>({id:'a',dataUrl:'pixels'}),autoState:{generation:3,model:file,owner:{project,imageId:'a',dataUrl:'pixels'}}});
  assert.equal(c.autoJobCurrent(3,file),true);assert.equal(c.autoJobCurrent(2,file),false);assert.equal(c.autoJobCurrent(3,{}),false);
  c.P={};assert.equal(c.autoJobCurrent(3,file),false);
});
function detectionUI(useDefault=false){
  const c=engine(),nodes=new Map(),events=new Map(),revoked=[];let terminated=0;
  const node=tag=>{
    const listeners=new Map(),captured=new Set(),attrs=new Map(),classes=new Set();
    return {disabled:false,dataset:{},style:{},textContent:'',open:true,listeners,children:[],tagName:tag.toUpperCase(),
      setAttribute:(name,value)=>attrs.set(name,String(value)),getAttribute:name=>attrs.get(name)??null,
      classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name),toggle(name,force){const on=force??!classes.has(name);on?classes.add(name):classes.delete(name);return on}},
      replaceChildren(...children){this.children=children},append(...children){this.children.push(...children)},
      focus(){c.document.activeElement=this},
      showModal(){this.open=true},close(){this.open=false;listeners.get('close')?.()},
      addEventListener:(name,handler)=>listeners.set(name,handler),querySelector:()=>null,
      getBoundingClientRect:()=>({left:30,top:50,width:240,height:180}),
      setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
  };
  const element=key=>{
    if(!nodes.has(key))nodes.set(key,node('div'));
    return nodes.get(key);
  };
  const im={id:'one',dataUrl:'pixels',width:600,height:800,adjustments:{rotation:90},markers:[],completed:true},
    project={categories:[{id:'a',name:'A'}],images:[im]},model={};
  Object.assign(c,{$:element,P:project,activeImage:()=>im,activeCategoryId:'a',activeCategory:()=>project.categories[0],quickDetectionBusy:()=>false,t:key=>key,
    URL:{revokeObjectURL:url=>revoked.push(url)},addEventListener:(name,handler)=>events.set(name,handler),
    renderAll(){},document:{activeElement:null,createElement:node},imageCache:new Map(),model,worker:{terminate:()=>terminated++}});
  vm.runInContext(section('function displayDims(','function canvasCssSize('),c);
  vm.runInContext(section('// AUTO:UI:BEGIN','// AUTO:UI:END'),c);
  vm.runInContext("autoState.owner={project:P,imageId:'one',dataUrl:'pixels',categoryId:'a'};autoState.examples=[{x:.1,y:.1,w:.2,h:.2}]",c);
  if(!useDefault)vm.runInContext('autoState.model=model',c);
  const pointer=(name,{id=1,primary=true,x=78,y=68,type='touch',button=0}={})=>{
    element('#autoCanvas').listeners.get(name)({pointerId:id,isPrimary:primary,button,pointerType:type,clientX:x,clientY:y,preventDefault(){}});
  };
  const resize=()=>{const handler=events.get('resize');assert.equal(typeof handler,'function','The preview must respond to viewport resize');handler()};
  return{c,element,events,revoked,im,pointer,resize,terminated:()=>terminated};
}
test('embedded model is ready without a file selection and survives transfer on repeated runs',async()=>{
  const {c,element}=detectionUI(true),reads=[];
  c.StandaloneAssets={bytesAsync:async(...args)=>{reads.push(args);return new Uint8Array([1,2,3])}};
  c.renderAutoControls();assert.equal(element('#autoSaveDetect').disabled,false);
  assert.equal(reads.length,0,'opening detection must not inflate weights');
  const model=vm.runInContext('autoState.model',c);
  assert.equal(model.size,6756087);
  const first=await model.arrayBuffer();structuredClone(first,{transfer:[first]});
  assert.equal(first.byteLength,0);
  assert.deepEqual([...new Uint8Array(await model.arrayBuffer())],[1,2,3]);
  assert.deepEqual(reads,[['yoloe-26n','model'],['yoloe-26n','model']]);
});
test('saving new examples stores an independent letterboxed source without changing counts',()=>{
  const {c,im,element}=detectionUI(true);c.renderAutoReference=()=>{};c.renderAutoPreview=()=>{};im.name='reference.jpg';
  c.imageCache.set(im.id,{naturalWidth:1200,naturalHeight:600});const draws=[],snapshots=[];
  c.document={createElement:()=>({getContext:()=>({fillRect(){},drawImage:(...a)=>draws.push(a.slice(1))}),toDataURL:()=>'snapshot'})};
  c.validateDetectionReference=()=>{};c.validateProject=()=>{};c.pushHistory=()=>snapshots.push({...c.P.categories[0]});c.touch=()=>{};c.Toast={show(){}};c.undo=()=>{};
  const original=plain(vm.runInContext('autoState.examples',c)),before=JSON.stringify(im);
  assert.equal(c.pinAutoExamples(),true);const ref=c.autoCurrentReference();
  assert.equal(ref.dataUrl,'snapshot');assert.equal(ref.sourceName,'reference.jpg');
  assert.deepEqual(draws,[[0,160,640,320]]);
  assert.deepEqual([...c.autoPromptMask(ref.examples,c.autoLetterbox(640,640))],[...c.autoPromptMask(original,c.autoLetterbox(1200,600))]);
  assert.equal(JSON.stringify(im),before);assert.equal(ref.examples.length,1);
  assert.equal(vm.runInContext('autoState.examples.length',c),0);
  assert.equal(snapshots.length,1);c.P.categories[0]=snapshots.pop();assert.equal(c.autoCurrentReference(),null);
});
// These synthetic events exercise production handlers, not native touch dispatch or device rendering.
for(const {rotation,start,end} of [
  {rotation:90,start:{x:78,y:68},end:{x:174,y:122}},
  {rotation:270,start:{x:222,y:212},end:{x:126,y:158}}
])test(`primary pointer drag creates an original-image example at ${rotation} degrees`,()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=rotation;
  vm.runInContext('autoState.examples=[]',c);const before=JSON.stringify(c.P);
  pointer('pointerdown',start);pointer('pointermove',end);pointer('pointerup',end);
  const examples=plain(vm.runInContext('autoState.examples',c));assert.equal(examples.length,1);
  for(const [key,want] of Object.entries({x:.1,y:.4,w:.3,h:.4}))assert.ok(Math.abs(examples[0][key]-want)<1e-12,`${key} should be ${want}`);
  assert.equal(vm.runInContext('autoState.drag',c),null);assert.equal(JSON.stringify(c.P),before,'Examples must not change counts or completion');
});
for(const rotation of [90,270])for(const cancellation of ['pointercancel','lostpointercapture','second-pointer-first','primary-pointer-first'])
test(`${cancellation} abandons example interaction at ${rotation} degrees`,()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=rotation;
  const snapshot=()=>JSON.stringify({project:c.P,state:plain(vm.runInContext('({examples:autoState.examples,selected:autoState.selectedExample})',c))});
  const before=snapshot();pointer('pointerdown');pointer('pointermove',{x:174,y:122});
  if(cancellation==='pointercancel'||cancellation==='lostpointercapture')pointer(cancellation);
  else{
    pointer('pointerdown',{id:2,primary:false,x:126,y:158});
    const ids=cancellation==='second-pointer-first'?[2,1]:[1,2];
    for(const id of ids)pointer('pointerup',{id,primary:id===1,x:174,y:122});
  }
  // Late movements/releases from an abandoned pointer must not resurrect the drag or modify a box.
  pointer('pointermove',{x:174,y:122});pointer('pointerup',{x:174,y:122});
  assert.equal(snapshot(),before);assert.equal(vm.runInContext('autoState.drag',c),null);
});
function editableReference(){
 const f=detectionUI(true),c=f.c;
 c.renderAutoReference=()=>{};c.renderAutoPreview=()=>{};c.touch=()=>{};c.Toast={show(){}};c.undo=()=>{};c.validateDetectionReference=()=>{};c.validateProject=()=>{};
 const ref={version:1,sourceName:'removed-source.jpg',dataUrl:'saved-pixels',examples:[box(.1,.2,.2,.2)]};c.P.categories[0].detectionReference=ref;
 c.loadImage=async()=>({naturalWidth:640,naturalHeight:640});c.pushHistory=()=>{c.historyCount=(c.historyCount||0)+1};
 return{...f,ref};
}
function snapshotEditor(f=detectionUI(true)){
  const {c,im}=f,createElement=c.document.createElement;
  c.renderAutoPreview=()=>{};c.touch=()=>{};c.Toast={show(){}};c.undo=()=>{};
  c.validateDetectionReference=()=>{};c.validateProject=()=>{};
  c.pushHistory=()=>{c.historyCount=(c.historyCount||0)+1};
  im.name='current.jpg';c.imageCache.set(im.id,{naturalWidth:1200,naturalHeight:600});
  c.document.createElement=tag=>tag==='canvas'?{getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>'current-snapshot'}:createElement(tag);
  return f;
}
test('example editor exposes save actions without technical model or candidate controls',()=>{
  for(const id of ['autoSave','autoSaveDetect','autoCloseEditor','autoReplaceExamples'])assert.ok(source.includes(`id="${id}"`),`Missing ${id}`);
  for(const id of ['autoModelDetails','autoModel','autoBackend','autoPrecision','autoRun','autoApply','autoApplyNext','autoCandidateList'])assert.ok(!source.includes(`id="${id}"`),`Obsolete ${id} is still exposed`);
});
test('example save action preserves the separate project autosave explanation in both languages',()=>{
  const c={};vm.createContext(c);vm.runInContext(section('const I18N={','let lang=')+'globalThis.words=I18N;',c);
  assert.equal(c.words.ja.autoSave,'このブラウザー内に自動保存');assert.equal(c.words.en.autoSave,'Auto-saved in this browser');
  assert.equal(c.words.ja.autoSaveClose,'保存して閉じる');assert.equal(c.words.en.autoSaveClose,'Save & close');
  const saveButton=source.match(/<button id="autoSave"[^>]*>/)?.[0];assert.match(saveButton,/data-i18n="autoSaveClose"/);
});
test('a ready new-example editor has no untranslated or redundant status label',()=>{
  const {c,element}=detectionUI();c.autoStatus('autoReady');assert.equal(element('#autoStatus').textContent,'');
});
test('opening registered examples edits their saved source directly, without decoding the current photo',async()=>{
  const {c,ref,element}=editableReference(),loads=[];
  c.loadImage=async dataUrl=>{loads.push(dataUrl);return{naturalWidth:640,naturalHeight:640}};
  await c.openAutoDetection();
  assert.deepEqual(loads,[ref.dataUrl]);assert.equal(c.autoCurrentReference(),ref);
  assert.equal(vm.runInContext('autoState.referenceEdit.reference',c),ref);
  assert.deepEqual(exampleState(c),plain(ref.examples));assert.equal(element('#autoSaveDetect').disabled,false);
});
for(const detect of [false,true])test(`saving new examples ${detect?'starts main-screen detection':'closes without detection'} only after committing`,async()=>{
  const {c,element}=snapshotEditor(),calls=[];
  c.startQuickDetection=async all=>calls.push({all,open:element('#autoDlg').open,reference:c.autoCurrentReference()});
  const button=element(detect?'#autoSaveDetect':'#autoSave');assert.equal(typeof button.onclick,'function');await button.onclick();
  assert.equal(element('#autoDlg').open,false);assert.equal(c.historyCount,1);
  assert.equal(c.autoCurrentReference().dataUrl,'current-snapshot');assert.equal(c.autoCurrentReference().sourceName,'current.jpg');
  assert.equal(calls.length,detect?1:0);if(detect){assert.equal(calls[0].all,false);assert.equal(calls[0].open,false);assert.equal(calls[0].reference,c.autoCurrentReference())}
});
for(const failure of ['empty','busy','owner','validation','snapshot'])test(`failed ${failure} example save keeps the editor open and never starts detection`,async()=>{
  const {c,element,im}=snapshotEditor();let detected=0;c.startQuickDetection=async()=>detected++;
  if(failure==='empty')vm.runInContext('autoState.examples=[]',c);
  if(failure==='busy')vm.runInContext('autoState.busy=true',c);
  if(failure==='owner')vm.runInContext('autoState.owner.project={}',c);
  if(failure==='validation')c.validateProject=()=>{throw new Error('storage limit')};
  if(failure==='snapshot')c.imageCache.delete(im.id);
  await c.saveAutoExamples(true);
  assert.equal(element('#autoDlg').open,true);assert.equal(detected,0);assert.equal(c.historyCount,undefined);assert.equal(c.autoCurrentReference(),null);
});
test('save continuation does not close or detect after its owner changes during saving',async()=>{
  const {c,element}=snapshotEditor();let detected=0;c.startQuickDetection=async()=>detected++;
  c.pinAutoExamples=()=>{vm.runInContext('autoState.owner={...autoState.owner}',c);return true};
  await c.saveAutoExamples(true);assert.equal(element('#autoDlg').open,true);assert.equal(detected,0);
});
test('unchanged saved examples may continue to detection without a new history entry',async()=>{
  const {c,element,ref}=editableReference();await c.editAutoReference();const calls=[];
  c.startQuickDetection=async all=>calls.push({all,reference:c.autoCurrentReference(),open:element('#autoDlg').open});
  await c.saveAutoExamples(true);
  assert.equal(c.historyCount,undefined);assert.equal(c.autoCurrentReference(),ref);
  assert.equal(element('#autoDlg').open,false);assert.equal(calls.length,1);assert.equal(calls[0].all,false);assert.equal(calls[0].reference,ref);assert.equal(calls[0].open,false);
});
test('cancelling the editor leaves the original reference and counts unchanged',async()=>{
  const {c,element,ref,im}=editableReference(),before=JSON.stringify(im);await c.editAutoReference();c.addAutoExample(box(.5,.5,.1,.1));
  assert.equal(typeof element('#autoCloseEditor').onclick,'function');element('#autoCloseEditor').onclick();
  assert.equal(element('#autoDlg').open,false);assert.equal(c.autoCurrentReference(),ref);assert.equal(JSON.stringify(im),before);assert.equal(c.historyCount,undefined);
});
for(const action of ['cancel','save','invalid-save'])test(`replacement draft ${action} preserves the previous reference until a valid commit`,async()=>{
  const {c,element,ref}=snapshotEditor(editableReference());await c.editAutoReference();
  assert.equal(typeof element('#autoReplaceExamples').onclick,'function');await element('#autoReplaceExamples').onclick();
  assert.equal(c.autoCurrentReference(),ref);assert.equal(c.historyCount,undefined);assert.equal(exampleState(c).length,0);assert.equal(c.autoExamplesEditable(),true);
  c.addAutoExample(box(.2,.3,.2,.2));assert.equal(exampleState(c).length,1);assert.equal(c.autoCurrentReference(),ref);
  if(action==='cancel')element('#autoCloseEditor').onclick();
  else{
    if(action==='invalid-save')c.validateProject=()=>{throw new Error('storage limit')};
    await c.saveAutoExamples(false);
  }
  if(action==='save'){assert.notEqual(c.autoCurrentReference(),ref);assert.equal(c.autoCurrentReference().dataUrl,'current-snapshot');assert.equal(c.autoCurrentReference().sourceName,'current.jpg');assert.equal(c.historyCount,1);assert.equal(element('#autoDlg').open,false)}
  else{assert.equal(c.autoCurrentReference(),ref);assert.equal(c.historyCount,undefined);assert.equal(element('#autoDlg').open,action==='invalid-save')}
});
test('replacement save cannot overwrite a reference changed since the draft began',async()=>{
  const {c,element,ref}=snapshotEditor(editableReference());await c.editAutoReference();await element('#autoReplaceExamples').onclick();
  c.addAutoExample(box(.2,.3,.2,.2));const newer={...ref,sourceName:'newer.jpg'};c.P.categories[0].detectionReference=newer;
  let detected=0;c.startQuickDetection=async()=>detected++;await c.saveAutoExamples(true);
  assert.equal(c.autoCurrentReference(),newer);assert.equal(c.historyCount,undefined);assert.equal(detected,0);assert.equal(element('#autoDlg').open,true);
});
test('editing a fixed reference preserves old boxes, allows new boxes on the saved source and commits once',async()=>{
 const {c,ref,element}=editableReference();await c.editAutoReference();
 assert.equal(c.autoCurrentReference(),ref);assert.equal(element('#autoSaveDetect').disabled,false);
 c.addAutoExample(box(.5,.5,.1,.1));assert.equal(ref.examples.length,1);assert.equal(vm.runInContext('autoState.examples.length',c),2);
 assert.equal(c.saveAutoReferenceEdit(),true);assert.equal(c.autoCurrentReference().examples.length,2);assert.equal(c.autoCurrentReference().dataUrl,ref.dataUrl);assert.equal(c.autoCurrentReference().sourceName,ref.sourceName);assert.equal(c.historyCount,1);
});
test('cancelling fixed reference edits leaves the saved reference and markers untouched',async()=>{
 const {c,ref,im}=editableReference();const before=JSON.stringify(im);await c.editAutoReference();c.addAutoExample(box(.5,.5,.1,.1));c.cancelAutoReferenceEdit();
 assert.equal(c.autoCurrentReference(),ref);assert.equal(c.historyCount,undefined);assert.equal(JSON.stringify(im),before);assert.equal(vm.runInContext('autoState.examples.length',c),0);
});
for(const action of ['cancel','close','replace'])test(`late saved reference loading cannot reopen editing after ${action}`,async()=>{
 const {c,element}=editableReference();let resolve;c.loadImage=()=>new Promise(r=>resolve=r);const task=c.editAutoReference();
 if(action==='cancel')c.cancelAutoReferenceEdit();if(action==='close')element('#autoDlg').listeners.get('close')();if(action==='replace')c.P.categories[0].detectionReference={};
 resolve({naturalWidth:640,naturalHeight:640});await task;assert.equal(vm.runInContext('autoState.referenceEdit',c),null);assert.equal(vm.runInContext('autoState.busy',c),false);
});
test('saved reference edit uses snapshot coordinates independent of target rotation',async()=>{
 const {c,pointer}=editableReference();await c.editAutoReference();c.setAutoExampleMode('add');pointer('pointerdown');pointer('pointermove',{x:174,y:122});pointer('pointerup',{x:174,y:122});
 const b=plain(vm.runInContext('autoState.examples[1]',c));for(const [k,v]of Object.entries({x:.2,y:.1,w:.4,h:.3}))assert.ok(Math.abs(b[k]-v)<1e-10);
});

test('unchanged or empty edited examples do not create a history entry or overwrite the reference',async()=>{
 const {c,ref,element}=editableReference();await c.editAutoReference();assert.equal(c.saveAutoReferenceEdit(),true);assert.equal(c.historyCount,undefined);assert.equal(c.autoCurrentReference(),ref);
 await c.editAutoReference();element('#autoClearExamples').onclick();assert.equal(element('#autoSave').disabled,true);assert.equal(c.saveAutoReferenceEdit(),false);assert.equal(c.autoCurrentReference(),ref);assert.equal(c.historyCount,undefined);
});
test('saving an edit cannot overwrite a newer category reference',async()=>{
 const {c}=editableReference();await c.editAutoReference();c.addAutoExample(box(.5,.5,.1,.1));const replacement={examples:[]};c.P.categories[0].detectionReference=replacement;assert.equal(c.saveAutoReferenceEdit(),false);assert.equal(c.autoCurrentReference(),replacement);assert.equal(c.historyCount,undefined);
});

const exampleState=c=>plain(vm.runInContext('autoState.examples',c));
function setExampleBounds(element,values){for(const [i,id]of ['autoLeft','autoTop','autoRight','autoBottom'].entries()){element('#'+id).valueAsNumber=values[i];element('#'+id).value=String(values[i])}}
function nearBox(actual,wanted){for(const key of ['x','y','w','h'])assert.ok(Math.abs(actual[key]-wanted[key])<1e-10,`${key}: ${actual[key]} should be ${wanted[key]}`)}

test('deleting the selected middle example preserves both neighbors and all saved data until Save',async()=>{
  const {c,ref,im}=editableReference();ref.examples=[box(.1,.2,.2,.2),box(.4,.2,.15,.2),box(.7,.2,.2,.2)];const original=plain(ref.examples),imageBefore=JSON.stringify(im);
  await c.editAutoReference();c.selectAutoExample(1);c.deleteAutoExample();
  assert.deepEqual(exampleState(c),[original[0],original[2]]);assert.deepEqual(plain(ref.examples),original);assert.equal(c.autoCurrentReference(),ref);assert.equal(c.historyCount,undefined);assert.equal(JSON.stringify(im),imageBefore);
  c.saveAutoReferenceEdit();assert.equal(c.historyCount,1);assert.deepEqual(plain(c.autoCurrentReference().examples),[original[0],original[2]]);assert.equal(c.autoCurrentReference().dataUrl,ref.dataUrl);
});

test('single-example deletion disables saving and discard restores the original pinned example',async()=>{
  const {c,ref,element}=editableReference();await c.editAutoReference();c.selectAutoExample(0);c.deleteAutoExample();
  assert.equal(exampleState(c).length,0);assert.equal(element('#autoSave').disabled,true);assert.equal(vm.runInContext('autoState.selectedExample',c),-1);
  c.cancelAutoReferenceEdit();assert.equal(c.autoCurrentReference(),ref);assert.equal(ref.examples.length,1);assert.equal(c.historyCount,undefined);
});

test('editing numeric bounds maps the displayed rectangle to a rotated original image',()=>{
  const {c,element}=detectionUI();c.selectAutoExample(0);setExampleBounds(element,[20,20,70,60]);c.updateAutoExampleBounds();
  nearBox(exampleState(c)[0],{x:.2,y:.3,w:.4,h:.5});
});

test('editing pinned numeric bounds ignores target rotation and preserves saved boxes until Save',async()=>{
  const {c,ref,element}=editableReference();await c.editAutoReference();c.selectAutoExample(0);setExampleBounds(element,[20,20,70,60]);c.updateAutoExampleBounds();
  nearBox(exampleState(c)[0],{x:.2,y:.2,w:.5,h:.4});nearBox(ref.examples[0],{x:.1,y:.2,w:.2,h:.2});assert.equal(c.historyCount,undefined);
});

test('invalid numeric edits keep the selected box unchanged',()=>{
  const {c,element}=detectionUI();c.selectAutoExample(0);const before=exampleState(c);
  for(const values of [[NaN,10,30,30],[-1,10,30,30],[10,10,101,30],[30,10,10,30],[10,10,10,30],[10,10,10.1,30]]){
    setExampleBounds(element,values);c.updateAutoExampleBounds();assert.deepEqual(exampleState(c),before);
  }
});

test('moving examples at every rotation preserves size and clamps to the image',()=>{
  const {c}=detectionUI();
  for(const rotation of [0,90,180,270])for(const end of [{u:-2,v:-2},{u:3,v:3}]){
    const original={x:.2,y:.3,w:.25,h:.4},moved=c.autoTransformExample(original,{u:.5,v:.5},end,null,rotation);
    assert.equal(c.autoValidRect(moved),true);assert.ok(Math.abs(moved.w-original.w)<1e-10);assert.ok(Math.abs(moved.h-original.h)<1e-10);assert.deepEqual(original,{x:.2,y:.3,w:.25,h:.4});
  }
});

test('each resize handle anchors the opposite corner and cannot flip or escape the image',()=>{
  const {c}=detectionUI();
  for(const rotation of [0,90,180,270])for(const handle of ['nw','ne','sw','se']){
    const original={x:.2,y:.3,w:.25,h:.4},before=c.autoDisplayBox(original,rotation),west=handle.includes('w'),north=handle.includes('n'),fixed={u:west?before.x+before.w:before.x,v:north?before.y+before.h:before.y};
    for(const end of [{u:west?2:-1,v:north?2:-1},{u:west?-1:2,v:north?-1:2}]){
      const resized=c.autoTransformExample(original,{u:west?before.x:before.x+before.w,v:north?before.y:before.y+before.h},end,handle,rotation),shown=c.autoDisplayBox(resized,rotation);
      assert.equal(c.autoValidRect(resized),true);assert.ok(Math.abs((west?shown.x+shown.w:shown.x)-fixed.u)<1e-10);assert.ok(Math.abs((north?shown.y+shown.h:shown.y)-fixed.v)<1e-10);
    }
  }
});

test('moving a selected example is transient until release',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;c.selectAutoExample(0);const before=exampleState(c),project=JSON.stringify(c.P);
  pointer('pointerdown',{x:78,y:86});pointer('pointermove',{x:102,y:104});assert.deepEqual(exampleState(c),before);
  pointer('pointerup',{x:102,y:104});nearBox(exampleState(c)[0],{x:.2,y:.2,w:.2,h:.2});assert.equal(JSON.stringify(c.P),project);
});

test('a selected corner resizes only that example after release and cancellation preserves its size',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;c.selectAutoExample(0);const before=exampleState(c);
  pointer('pointerdown',{x:102,y:104});pointer('pointermove',{x:126,y:122});assert.deepEqual(exampleState(c),before);pointer('pointercancel');assert.deepEqual(exampleState(c),before);
  pointer('pointerdown',{x:102,y:104});pointer('pointermove',{x:126,y:122});pointer('pointerup',{x:126,y:122});nearBox(exampleState(c)[0],{x:.1,y:.1,w:.3,h:.3});
});

test('an owner change during an example drag prevents release from changing the boxes',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;c.selectAutoExample(0);const before=exampleState(c);
  pointer('pointerdown',{x:78,y:86});pointer('pointermove',{x:102,y:104});vm.runInContext('autoState.owner.project={}',c);pointer('pointerup',{x:102,y:104});assert.deepEqual(exampleState(c),before);
});

for(const end of ['pointercancel','lostpointercapture','second-finger'])test(`${end} discards an example move without changing boxes or counts`,()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;c.selectAutoExample(0);const before=exampleState(c),project=JSON.stringify(c.P);
  pointer('pointerdown',{x:78,y:86});pointer('pointermove',{x:102,y:104});
  if(end==='second-finger')pointer('pointerdown',{id:2,primary:false,x:150,y:140});else pointer(end);
  pointer('pointerup',{x:102,y:104});pointer('pointerup',{id:2,primary:false,x:150,y:140});assert.deepEqual(exampleState(c),before);assert.equal(JSON.stringify(c.P),project);assert.equal(vm.runInContext('autoState.drag',c),null);
});

test('a cancelled old pointer cannot cancel or commit a newer example move',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;c.selectAutoExample(0);
  pointer('pointerdown',{x:78,y:86});pointer('pointercancel');pointer('pointerdown',{id:3,x:78,y:86});pointer('pointermove',{id:3,x:102,y:104});
  pointer('pointercancel');pointer('lostpointercapture');pointer('pointerup',{x:200,y:200});assert.ok(vm.runInContext('autoState.drag',c));pointer('pointerup',{id:3,x:102,y:104});nearBox(exampleState(c)[0],{x:.2,y:.2,w:.2,h:.2});
});

for(const guard of ['busy','owner','fixed'])test(`${guard} blocks deletion and numeric editing of examples`,()=>{
  const {c,element}=detectionUI();c.selectAutoExample(0);setExampleBounds(element,[20,20,70,60]);const before=exampleState(c);
  if(guard==='busy')vm.runInContext('autoState.busy=true',c);
  if(guard==='owner')vm.runInContext('autoState.owner.project={}',c);
  if(guard==='fixed')c.P.categories[0].detectionReference={examples:[box(.4,.4,.1,.1)]};
  c.deleteAutoExample();c.updateAutoExampleBounds();assert.deepEqual(exampleState(c),before);
});

test('a valid narrow saved example can move but cannot be made smaller than its original minimum',async()=>{
  const {c,ref}=editableReference();ref.examples=[{x:.2,y:.3,w:.002,h:.02}];await c.editAutoReference();
  c.commitAutoExample(0,{x:.4,y:.5,w:.002,h:.02});nearBox(exampleState(c)[0],{x:.4,y:.5,w:.002,h:.02});nearBox(ref.examples[0],{x:.2,y:.3,w:.002,h:.02});
  c.commitAutoExample(0,{x:.4,y:.5,w:.001,h:.02});nearBox(exampleState(c)[0],{x:.4,y:.5,w:.002,h:.02});
  c.saveAutoReferenceEdit();assert.equal(c.historyCount,1);nearBox(c.autoCurrentReference().examples[0],{x:.4,y:.5,w:.002,h:.02});
});

test('selection taps with small touch drift do not move a box',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;c.selectAutoExample(0);const before=exampleState(c);
  pointer('pointerdown',{x:78,y:86});pointer('pointermove',{x:79,y:87});pointer('pointerup',{x:79,y:87});
  assert.deepEqual(exampleState(c),before);
});

test('a stale saved reference edit cannot append new examples',async()=>{
  const {c}=editableReference();await c.editAutoReference();const before=exampleState(c);c.P.categories[0].detectionReference={examples:[box(.6,.6,.1,.1)]};
  c.addAutoExample(box(.5,.5,.1,.1));assert.deepEqual(exampleState(c),before);
});

test('dragging the explicitly selected overlapping example preserves the newer containing example',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;
  vm.runInContext('autoState.examples=[{x:.2,y:.2,w:.2,h:.2},{x:.1,y:.1,w:.6,h:.6}]',c);c.selectAutoExample(0);const containing=exampleState(c)[1];
  pointer('pointerdown',{x:102,y:104});assert.equal(vm.runInContext('autoState.selectedExample',c),0);
  pointer('pointermove',{x:126,y:122});pointer('pointerup',{x:126,y:122});
  nearBox(exampleState(c)[0],{x:.3,y:.3,w:.2,h:.2});assert.deepEqual(exampleState(c)[1],containing);
});

function pinchPreview(pointer,{startA={x:90,y:140},startB={x:150,y:140},endA={x:60,y:140},endB={x:180,y:140}}={}){
  pointer('pointerdown',startA);pointer('pointerdown',{...startB,id:2,primary:false});
  pointer('pointermove',endA);pointer('pointermove',{...endB,id:2,primary:false});
  pointer('pointerup',{...endB,id:2,primary:false});pointer('pointerup',endA);
}
const previewPoint=(c,x,y)=>c.autoCanvasPoint({clientX:x,clientY:y});
function nearPoint(actual,u,v){assert.ok(Math.abs(actual.u-u)<1e-10,`u: ${actual.u} should be ${u}`);assert.ok(Math.abs(actual.v-v)<1e-10,`v: ${actual.v} should be ${v}`)}

test('off-center preview pinch keeps its image anchor and changes inverse pointer coordinates',()=>{
  const {c,pointer}=detectionUI(),before=exampleState(c),project=JSON.stringify(c.P);
  pinchPreview(pointer);
  nearPoint(previewPoint(c,120,140),.375,.5);
  nearPoint(previewPoint(c,150,140),.4375,.5);
  assert.deepEqual(exampleState(c),before);assert.equal(JSON.stringify(c.P),project);
});

test('starting a pinch restores example selection changed by the first finger',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;c.selectAutoExample(0);
  pinchPreview(pointer);
  assert.equal(vm.runInContext('autoState.selectedExample',c),0);
  assert.equal(vm.runInContext('autoState.exampleMode',c),'select');
});

const centeredPinch={startA:{x:90,y:140},startB:{x:210,y:140},endA:{x:30,y:140},endB:{x:270,y:140}};
for(const [rotation,wanted]of [
  [0,{x:.3,y:.35,w:.3,h:.2}],[90,{x:.35,y:.4,w:.2,h:.3}],
  [180,{x:.4,y:.45,w:.3,h:.2}],[270,{x:.45,y:.3,w:.2,h:.3}]
])test(`zoomed example drawing stores original coordinates at ${rotation} degrees`,()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=rotation;vm.runInContext('autoState.examples=[]',c);
  const before=JSON.stringify(c.P);pinchPreview(pointer,centeredPinch);
  pointer('pointerdown',{x:54,y:86});pointer('pointermove',{x:198,y:158});pointer('pointerup',{x:198,y:158});
  assert.equal(exampleState(c).length,1);nearBox(exampleState(c)[0],wanted);assert.equal(JSON.stringify(c.P),before);
});

test('zoomed pinned drawing keeps snapshot coordinates and saved reference immutable',async()=>{
  const {c,im,ref,pointer}=editableReference();im.adjustments.rotation=270;await c.editAutoReference();c.setAutoExampleMode('add');
  const before=JSON.stringify(c.P);pinchPreview(pointer,centeredPinch);
  pointer('pointerdown',{x:54,y:86});pointer('pointermove',{x:198,y:158});pointer('pointerup',{x:198,y:158});
  nearBox(exampleState(c)[1],{x:.3,y:.35,w:.3,h:.2});assert.equal(JSON.stringify(c.P),before);assert.equal(c.autoCurrentReference(),ref);assert.equal(c.historyCount,undefined);
});

for(const action of ['move','resize'])test(`zoomed selected-example ${action} uses image deltas while retaining screen hit targets`,()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;
  vm.runInContext('autoState.examples=[{x:.35,y:.35,w:.2,h:.2}]',c);c.selectAutoExample(0);pinchPreview(pointer,centeredPinch);
  const before=exampleState(c),start=action==='move'?{x:126,y:122}:{x:174,y:158},end=action==='move'?{x:150,y:140}:{x:198,y:194};
  pointer('pointerdown',start);pointer('pointermove',end);assert.deepEqual(exampleState(c),before);pointer('pointerup',end);
  nearBox(exampleState(c)[0],action==='move'?{x:.4,y:.4,w:.2,h:.2}:{x:.35,y:.35,w:.25,h:.3});
});

for(const type of ['touch','mouse'])test(`zoomed ${type} corner hit radius stays fixed in CSS pixels`,()=>{
  const {c,im}=detectionUI();im.adjustments.rotation=0;vm.runInContext('autoState.examples=[{x:.4,y:.4,w:.2,h:.2}]',c);c.selectAutoExample(0);
  for(const zoom of [1,4]){
    vm.runInContext(`autoState.view={zoom:${zoom},panX:0,panY:0}`,c);
    const radius=type==='touch'?22:12,cornerX=zoom===1?126:54,cornerY=zoom===1?122:68;
    const within=c.autoHitExample(previewPoint(c,cornerX-radius+1,cornerY),type),outside=c.autoHitExample(previewPoint(c,cornerX-radius-1,cornerY),type);
    assert.equal(within?.handle,'nw');assert.equal(outside,null);
  }
});

test('zoomed selection taps keep a CSS-pixel drift threshold',()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;vm.runInContext('autoState.examples=[{x:.35,y:.35,w:.2,h:.2}]',c);c.selectAutoExample(0);pinchPreview(pointer,centeredPinch);
  const before=exampleState(c);
  pointer('pointerdown',{x:126,y:122});pointer('pointerup',{x:128,y:123});assert.deepEqual(exampleState(c),before);
  pointer('pointerdown',{x:126,y:122});pointer('pointerup',{x:130,y:122});
  nearBox(exampleState(c)[0],{x:.35+1/120,y:.35,w:.2,h:.2});
});

for(const released of [1,2])for(const extraPointer of [false,true])test(`pinch release of pointer ${released}${extraPointer?' with a third finger':''} cannot become an example edit`,()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;
  vm.runInContext('autoState.examples=[{x:.35,y:.35,w:.2,h:.2}]',c);c.selectAutoExample(0);
  const before=JSON.stringify({examples:exampleState(c),project:c.P});
  pointer('pointerdown',{x:126,y:122});pointer('pointermove',{x:150,y:140});pointer('pointerdown',{id:2,primary:false,x:210,y:140});
  if(extraPointer)pointer('pointerdown',{id:3,primary:false,x:180,y:180});
  pointer('pointermove',{id:2,primary:false,x:240,y:140});pointer('pointerup',{id:released,primary:released===1,x:150,y:140});
  const remaining=released===1?2:1;pointer('pointermove',{id:remaining,primary:remaining===1,x:200,y:180});pointer('pointerup',{id:remaining,primary:remaining===1,x:200,y:180});
  if(extraPointer){pointer('pointermove',{id:3,primary:false,x:126,y:122});pointer('pointerup',{id:3,primary:false,x:126,y:122})}
  pointer('pointermove',{x:126,y:122});pointer('pointerup',{x:126,y:122});
  assert.equal(JSON.stringify({examples:exampleState(c),project:c.P}),before);assert.equal(vm.runInContext('autoState.drag',c),null);
});

for(const cancellation of ['pointercancel','lostpointercapture'])test(`${cancellation} during pinch leaves survivors inert and permits a fresh gesture`,()=>{
  const {c,im,pointer}=detectionUI();im.adjustments.rotation=0;vm.runInContext('autoState.examples=[]',c);
  pointer('pointerdown',{x:90,y:140});pointer('pointerdown',{id:2,primary:false,x:210,y:140});pointer('pointermove',{id:2,primary:false,x:270,y:140});
  pointer(cancellation);pointer('pointermove',{id:2,primary:false,x:150,y:140});pointer('pointerup',{id:2,primary:false,x:150,y:140});
  assert.equal(exampleState(c).length,0);assert.equal(vm.runInContext('autoState.drag',c),null);
  vm.runInContext('autoState.view={zoom:1,panX:0,panY:0}',c);
  pointer('pointerdown',{id:3,x:78,y:86});pointer('pointermove',{id:3,x:150,y:140});pointer('pointerup',{id:3,x:150,y:140});
  nearBox(exampleState(c)[0],{x:.2,y:.2,w:.3,h:.3});
});

test('zoom controls clamp the preview, preserve geometry, and Fit restores the full image',()=>{
  const {c,element}=detectionUI(),before=exampleState(c),project=JSON.stringify(c.P);
  assert.equal(typeof element('#autoZoomIn').onclick,'function');assert.equal(typeof element('#autoZoomOut').onclick,'function');assert.equal(typeof element('#autoFit').onclick,'function');
  element('#autoZoomIn').onclick();nearPoint(previewPoint(c,30,50),1/6,1/6);
  for(let i=0;i<20;i++)element('#autoZoomIn').onclick();nearPoint(previewPoint(c,30,50),.4375,.4375);
  for(let i=0;i<30;i++)element('#autoZoomOut').onclick();nearPoint(previewPoint(c,30,50),0,0);nearPoint(previewPoint(c,270,230),1,1);
  element('#autoZoomIn').onclick();element('#autoFit').onclick();nearPoint(previewPoint(c,30,50),0,0);nearPoint(previewPoint(c,270,230),1,1);
  assert.deepEqual(exampleState(c),before);assert.equal(JSON.stringify(c.P),project);
});

test('explicit pan moves the zoomed image within its bounds without modifying selected examples',()=>{
  const {c,element,pointer}=detectionUI();c.selectAutoExample(0);pinchPreview(pointer,centeredPinch);const before=exampleState(c),project=JSON.stringify(c.P);
  assert.equal(typeof element('#autoPanMode').onclick,'function');element('#autoPanMode').onclick();
  pointer('pointerdown',{x:150,y:140});pointer('pointermove',{x:198,y:176});pointer('pointerup',{x:198,y:176});nearPoint(previewPoint(c,150,140),.4,.4);
  pointer('pointerdown',{x:150,y:140});pointer('pointermove',{x:1500,y:1400});pointer('pointerup',{x:1500,y:1400});nearPoint(previewPoint(c,30,50),0,0);nearPoint(previewPoint(c,270,230),.5,.5);
  pointer('pointerdown',{x:150,y:140});pointer('pointermove',{x:-1500,y:-1400});pointer('pointerup',{x:-1500,y:-1400});nearPoint(previewPoint(c,30,50),.5,.5);nearPoint(previewPoint(c,270,230),1,1);
  assert.deepEqual(exampleState(c),before);assert.equal(JSON.stringify(c.P),project);assert.equal(vm.runInContext('autoState.selectedExample',c),0);
});

test('changing example selection or edit mode retains the current preview position',()=>{
  const {c,pointer}=detectionUI();pinchPreview(pointer);const at=previewPoint(c,150,140);
  c.selectAutoExample(0);nearPoint(previewPoint(c,150,140),at.u,at.v);c.setAutoExampleMode('add');nearPoint(previewPoint(c,150,140),at.u,at.v);
  c.setAutoExampleMode('select');nearPoint(previewPoint(c,150,140),at.u,at.v);c.deleteAutoExample();nearPoint(previewPoint(c,150,140),at.u,at.v);
});

for(const boundary of ['enter-reference','cancel-reference','save-reference','close','replace'])test(`${boundary} resets preview coordinates and abandons pending gestures`,async()=>{
  const {c,element,ref,pointer}=editableReference();
  if(boundary!=='enter-reference')await c.editAutoReference();
  pinchPreview(pointer,centeredPinch);pointer('pointerdown',{x:150,y:140});pointer('pointermove',{x:174,y:158});
  if(boundary==='enter-reference')await c.editAutoReference();
  if(boundary==='cancel-reference')c.cancelAutoReferenceEdit();
  if(boundary==='save-reference'){c.addAutoExample(box(.5,.5,.1,.1));c.saveAutoReferenceEdit()}
  if(boundary==='close')element('#autoDlg').listeners.get('close')();
  if(boundary==='replace'){c.imageCache.set(c.activeImage().id,{naturalWidth:640,naturalHeight:640});await element('#autoReplaceExamples').onclick()}
  nearPoint(previewPoint(c,30,50),0,0);nearPoint(previewPoint(c,270,230),1,1);assert.equal(vm.runInContext('autoState.drag',c),null);
  const after=JSON.stringify({examples:exampleState(c),project:c.P});pointer('pointerup',{x:198,y:194});assert.equal(JSON.stringify({examples:exampleState(c),project:c.P}),after);
  if(boundary==='cancel-reference'||boundary==='close'||boundary==='replace')assert.equal(c.autoCurrentReference(),ref);
});

test('opening detection starts from a fitted preview and ignores the previous dialog pointer',async()=>{
  const {c,im,pointer}=detectionUI();Object.assign(c,{activeCategoryId:'a',pointers:new Map(),gesture:null,cancelMarkerInteraction(){}});
  c.imageCache.set(im.id,{});c.renderAutoPreview=()=>{};pinchPreview(pointer,centeredPinch);pointer('pointerdown',{x:150,y:140});
  await c.openAutoDetection();nearPoint(previewPoint(c,30,50),0,0);nearPoint(previewPoint(c,270,230),1,1);
  pointer('pointerup',{x:198,y:194});assert.equal(exampleState(c).length,0);assert.equal(vm.runInContext('autoState.drag',c),null);
});

test('pinching a zoomed preview translates the image and limits excessive scale without moving examples',()=>{
  const {c,pointer}=detectionUI(),before=exampleState(c);pinchPreview(pointer,centeredPinch);
  pinchPreview(pointer,{startA:{x:90,y:140},startB:{x:210,y:140},endA:{x:138,y:176},endB:{x:258,y:176}});
  nearPoint(previewPoint(c,150,140),.4,.4);
  pinchPreview(pointer,{startA:{x:149,y:140},startB:{x:151,y:140},endA:{x:-500,y:140},endB:{x:800,y:140}});
  const left=previewPoint(c,30,140),right=previewPoint(c,270,140);assert.ok(Math.abs(right.u-left.u-.125)<1e-10);
  assert.deepEqual(exampleState(c),before);
});

function previewDrawing(){
  const f=detectionUI(),{c,im,element}=f;im.adjustments.rotation=0;
  const rects=[],labels=[],stack=[];let matrix={a:1,d:1,e:0,f:0};
  const context={fillStyle:'',save(){stack.push({...matrix,fillStyle:this.fillStyle})},restore(){const saved=stack.pop();this.fillStyle=saved.fillStyle;matrix=saved},translate(x,y){matrix.e+=matrix.a*x;matrix.f+=matrix.d*y},scale(x,y){matrix.a*=x;matrix.d*=y},setTransform(a,b,cc,d,e,f){assert.equal(b,0);assert.equal(cc,0);matrix={a,d,e,f}},drawImage(){},clearRect(){},setLineDash(){},strokeRect(){},fillText:label=>labels.push(label),measureText:()=>({width:30}),fillRect(x,y,w,h){rects.push({fill:this.fillStyle,x:matrix.e+x*matrix.a,y:matrix.f+y*matrix.d,w:w*matrix.a,h:h*matrix.d})}};
  element('#autoCanvas').getContext=()=>context;c.imageCache.set(im.id,{naturalWidth:600,naturalHeight:800});
  return{...f,rects,labels,clearDrawing(){rects.length=0;labels.length=0;matrix={a:1,d:1,e:0,f:0}}};
}
test('selected preview handles render at 12 CSS pixels after zoom',()=>{
  const {c,element,rects,clearDrawing}=previewDrawing();
  vm.runInContext('autoState.examples=[{x:.4,y:.4,w:.2,h:.2}]',c);c.selectAutoExample(0);
  for(const zoom of [1,4]){
    clearDrawing();vm.runInContext(`autoState.view={zoom:${zoom},panX:0,panY:0}`,c);c.renderAutoPreview();
    const canvas=element('#autoCanvas'),handles=rects.filter(rect=>rect.fill==='#fff');assert.equal(handles.length,4);
    for(const handle of handles){assert.ok(Math.abs(handle.w*240/canvas.width-12)<1e-10);assert.ok(Math.abs(handle.h*180/canvas.height-12)<1e-10)}
    const first=handles[0],centerX=(first.x+first.w/2)*240/canvas.width,centerY=(first.y+first.h/2)*180/canvas.height;
    assert.ok(Math.abs(centerX-(zoom===1?96:24))<1e-10);assert.ok(Math.abs(centerY-(zoom===1?72:18))<1e-10);
  }
});

test('zoomed preview does not paint labels for fully offscreen example boxes',()=>{
  const {c,labels}=previewDrawing();c.t=(key,values)=>key==='autoExampleShort'?`Example ${values.count}`:key;
  vm.runInContext('autoState.view={zoom:4,panX:0,panY:0};autoState.examples=[{x:.4,y:.1,w:.1,h:.1},{x:.4,y:.8,w:.1,h:.1},{x:.1,y:.4,w:.1,h:.1},{x:.8,y:.4,w:.1,h:.1},{x:.4,y:.4,w:.2,h:.2}]',c);
  c.renderAutoPreview();assert.deepEqual(labels,['Example 5']);
});

test('preview resize redraws fixed-size handles and abandons a pending example edit',()=>{
  const {c,element,rects,clearDrawing,pointer,resize}=previewDrawing();
  vm.runInContext('autoState.view={zoom:4,panX:0,panY:0};autoState.examples=[{x:.4,y:.4,w:.2,h:.2}]',c);c.selectAutoExample(0);resize();
  const before=exampleState(c);pointer('pointerdown',{x:150,y:140});pointer('pointermove',{x:174,y:158});
  element('#autoCanvas').getBoundingClientRect=()=>({left:30,top:50,width:120,height:90});clearDrawing();resize();
  const canvas=element('#autoCanvas'),handles=rects.filter(rect=>rect.fill==='#fff');assert.equal(handles.length,4);
  for(const handle of handles){assert.ok(Math.abs(handle.w*120/canvas.width-12)<1e-10);assert.ok(Math.abs(handle.h*90/canvas.height-12)<1e-10)}
  pointer('pointerup',{x:198,y:194});assert.deepEqual(exampleState(c),before);assert.equal(vm.runInContext('autoState.drag',c),null);
});
