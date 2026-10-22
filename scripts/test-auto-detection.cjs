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
  const c={Float32Array,Number,Math,Date,structuredClone,Set,Map,Array,Error};vm.createContext(c);
  vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END'),c);return c;
}
const plain = value => JSON.parse(JSON.stringify(value));
const box=(x,y,w,h,score=.9)=>({x,y,w,h,score});
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
test('incompatible model outputs stop before the second run and still dispose tensors',async()=>{
  const c=engine(),f=runtimeFixture(true),mask=new Float32Array(6400);mask[0]=1;
  await assert.rejects(c.autoRunModel(f.ort,f.session,new Float32Array(3*640*640),mask),/autoInvalidOutput/);
  assert.equal(f.calls(),1);assert.ok(f.tensors.every(t=>t.disposed));
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
