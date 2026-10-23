const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||path.join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing ${a}`);return source.slice(i,j)}
const box=(x=.1)=>({x,y:.2,w:.15,h:.2,score:.8});
function setup(){
  const reference={examples:[box()],dataUrl:'ref'},category={id:'a',detectionReference:reference},images=['one','two','three'].map(id=>({id,name:id,dataUrl:id,markers:[],completed:true,adjustments:{rotation:0}}));
  const c={Number,Math,Date,Set,Map,Array,Error,structuredClone,P:{images,categories:[category],settings:{}},history:[],future:[],activeImageId:'one',activeCategoryId:'a',selectedMarkerId:null,lastMarkerId:null,lastMarkerAt:0,quickState:{run:null,report:null},autoState:{model:{}},$:()=>({}),renderAll(){},renderStorageSoon(){},scheduleSave(){},renderQuickDetection(){},id:(()=>{let i=0;return()=>String(++i)})()};
  c.activeImage=()=>c.P.images.find(im=>im.id===c.activeImageId);
  vm.createContext(c);vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END')+section('function cloneLight()','function dataUrlBytes(')+section('function nextOrder(im)','function addPoint(')+section('// QUICK:CORE:BEGIN','// QUICK:CORE:END'),c);
  const run={project:c.P,category,reference,model:c.autoState.model,sources:images.map(image=>({image,dataUrl:image.dataUrl})),targets:images,rows:[],added:0,historyStarted:false,index:0};c.quickState.run=run;
  c.finishQuickDetection=(r,phase)=>{if(c.quickState.run!==r)return;c.quickState.run=null;r.phase=phase;c.quickState.report=r;r.cancelInference?.()};
  return {c,run,images,category};
}
test('quick apply adds only nonduplicates to the captured photo as needs-review, in one undoable transaction',()=>{
  const {c,run,images}=setup();images[0].markers=[{id:'manual',shape:'point',categoryId:'a',x:.15,y:.25,needsReview:false,order:1}];
  c.activeImageId='three';
  assert.equal(c.quickCommitResult(run,images[0],[box(),box(.6)]).added,1);
  assert.equal(c.quickCommitResult(run,images[1],[box()]).added,1);
  assert.equal(c.history.length,1);assert.equal(images[0].markers[0].needsReview,false);
  assert.equal(images[0].markers[1].needsReview,true);assert.equal(images[1].markers[0].needsReview,true);
  assert.equal(images[2].markers.length,0);assert.equal(images[2].completed,true);
  c.undo();assert.equal(c.P.images[0].markers.length,1);assert.equal(c.P.images[1].markers.length,0);assert.equal(c.P.images[1].completed,true);
  c.redo();assert.equal(c.P.images[1].markers[0].needsReview,true);
});
test('empty and repeated results preserve redo, completion and history',()=>{
  const {c,run,images}=setup();c.future.push({sentinel:1});
  c.quickCommitResult(run,images[0],[]);assert.equal(c.history.length,0);assert.equal(c.future.length,1);assert.equal(images[0].completed,true);
  c.quickCommitResult(run,images[0],[box()]);c.quickCommitResult(run,images[0],[box()]);
  assert.equal(c.history.length,1);assert.equal(images[0].markers.length,1);
});
for(const change of ['project','pixels','reference','category','model','images','cancel'])test(`stale ${change} rejects quick results`,()=>{
  const {c,run,images,category}=setup();
  if(change==='project')c.P={...c.P};if(change==='pixels')images[0].dataUrl='changed';if(change==='reference')category.detectionReference={};
  if(change==='category')c.P.categories=[];if(change==='model')c.autoState.model={};if(change==='images')c.P.images=images.slice(1);if(change==='cancel')c.quickState.run=null;
  assert.equal(c.quickRunCurrent(run),false);assert.equal(c.quickCommitResult(run,images[0],[box()]).added,0);assert.equal(c.history.length,0);
});
test('all photos run sequentially, retaining prior completed results on cancellation',async()=>{
  const {c,run,images}=setup();let release;const calls=[];
  c.quickInferImage=async(r,im)=>{calls.push(im.id);if(im.id==='two')await new Promise(resolve=>release=resolve);return{candidates:[box()],truncated:0}};
  const pending=c.quickProcessImages(run);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['one','two']);assert.equal(images[0].markers.length,1);assert.equal(images[1].markers.length,0);
  c.finishQuickDetection(run,'cancelled');release();await pending;
  assert.deepEqual(calls,['one','two']);assert.equal(images[1].markers.length,0);assert.equal(c.history.length,1);
  c.undo();assert.equal(c.P.images[0].markers.length,0);
});
test('bad photos are reported and skipped, while a model failure stops the batch',async()=>{
  for(const error of ['autoInvalidImage','autoModelError']){
    const {c,run,images}=setup();c.quickInferImage=async(r,im)=>{if(im.id==='two')throw new Error(error);return{candidates:[box()],truncated:2}};
    await c.quickProcessImages(run);
    assert.equal(images[0].markers.length,1);assert.equal(images[1].markers.length,0);
    assert.equal(images[2].markers.length,error==='autoInvalidImage'?1:0);
    assert.equal(run.rows[1].error,error);assert.equal(run.rows[0].truncated,2);assert.equal(run.phase,error==='autoInvalidImage'?'done':'error');
  }
});
function runner(){
  const {c,run,images}=setup(),bitmaps=[],revoked=[],workers=[];run.backend='wasm';run.precision='fp32';run.threshold=.05;run.model.arrayBuffer=async()=>new ArrayBuffer(3);
  Object.assign(c,{Blob,StandaloneAssets:{bytesAsync:async()=>new Uint8Array(3)},loadImage:async src=>({src}),createImageBitmap:async image=>{const b={image,closed:0,close(){this.closed++}};bitmaps.push(b);return b},autoWorkerSource:()=>'',I18N:{ja:{autoModelError:'error'}},URL:{createObjectURL:()=>`blob:${Math.random()}`,revokeObjectURL:u=>revoked.push(u)},Worker:class{constructor(){workers.push(this);this.terminated=0}postMessage(data,transfers){this.data=data;this.transfers=transfers}terminate(){this.terminated++}}});
  vm.runInContext(section('// QUICK:RUNNER:BEGIN','// QUICK:RUNNER:END'),c);return{c,run,images,bitmaps,revoked,workers};
}
test('headless runner transfers distinct source/target bitmaps and releases each worker on result',async()=>{
  const {c,run,images,bitmaps,revoked,workers}=runner(),pending=c.quickInferImage(run,images[1]);
  await new Promise(resolve=>setImmediate(resolve));const w=workers[0];
  assert.equal(w.data.bitmap.image.src,'two');assert.equal(w.data.referenceBitmap.image.src,'ref');assert.equal(w.transfers.length,4);
  w.onmessage({data:{phase:'processing'}});assert.equal(run.phase,'processing');
  w.onmessage({data:{phase:'result',candidates:[box()],truncated:4}});const result=await pending;
  assert.equal(result.candidates.length,1);assert.equal(result.truncated,4);assert.equal(w.terminated,1);assert.equal(revoked.length,2);assert.equal(run.cancelInference,null);
  // Transferred bitmaps belong to the worker and must not be closed by the sender.
  assert.ok(bitmaps.every(b=>b.closed===0));
});
test('cancelling during asset loading rejects immediately without starting a late worker',async()=>{
  const {c,run,images,workers}=runner();let release;const gate=new Promise(resolve=>release=resolve);c.StandaloneAssets.bytesAsync=async()=>{await gate;return new Uint8Array(3)};
  const pending=c.quickInferImage(run,images[0]);run.cancelInference();await assert.rejects(pending,/autoCancelled/);
  release(new Uint8Array(3));await new Promise(resolve=>setImmediate(resolve));assert.equal(workers.length,0);
});
function ui(){
  const f=setup(),{c,run,category}=f,nodes=new Map();c.$=key=>{if(!nodes.has(key))nodes.set(key,{hidden:false,open:false,textContent:'',value:key==='#autoThreshold'?'0.05':key==='#autoBackend'?'wasm':'fp32',focus(){},scrollIntoView(){},append(){},addEventListener(){}});return nodes.get(key)};
  Object.assign(c,{activeCategory:()=>category,autoCurrentReference:()=>category.detectionReference,t:k=>k,document:{body:{},querySelector:()=>null,createElement:()=>({})},addEventListener(){},Toast:{hide(){},show(){}},cancelMarkerInteraction(){},pointers:new Map(),Worker:class{},OffscreenCanvas:class{},createImageBitmap(){},imageCache:new Map()});c.autoState.model.size=1;
  vm.runInContext(section('// QUICK:UI:BEGIN','// QUICK:UI:END'),c);return{...f,nodes};
}
test('quick UI locks the hidden toast as well as editor and mobile controls',()=>{
  const {c,run}=ui();c.run=run;vm.runInContext('quickState.run=run',c);c.renderQuickDetection();
  for(const key of ['#workspace','#mobileBar','#toast'])assert.equal(c.$(key).inert,true,key);
  vm.runInContext('quickState.run=null',c);c.renderQuickDetection();for(const key of ['#workspace','#mobileBar','#toast'])assert.equal(c.$(key).inert,false,key);
});
test('quick detection waits for an already-pending photo import instead of losing its Undo',async()=>{
  const {c}=ui();let release,starts=0;c.fileToRecord=()=>new Promise(resolve=>release=resolve);c.MAX_IMAGES=30;c.MAX_PROJECT_BYTES=10000;c.projectBytes=()=>0;c.showWorkspace=()=>{};c.switchImage=async()=>{};
  vm.runInContext(section('async function addFiles(','async function switchImage('),c);c.quickProcessImages=async()=>{starts++};
  const importing=c.addFiles([{type:'image/jpeg'}]);await c.startQuickDetection();assert.equal(starts,0);assert.equal(vm.runInContext('quickState.run',c),null);
  release({id:'four',dataUrl:'four',byteSize:1,markers:[],adjustments:{}});await importing;await c.startQuickDetection();assert.equal(starts,1);
});
test('cancelling during reference bitmap creation closes both bitmaps and never starts a worker',async()=>{
  const {c,run,images,workers,bitmaps}=runner();let release;
  c.createImageBitmap=async image=>{const b={closed:0,close(){this.closed++}};bitmaps.push(b);if(image.src==='ref')await new Promise(resolve=>release=resolve);return b};
  const pending=c.quickInferImage(run,images[0]);await new Promise(resolve=>setImmediate(resolve));run.cancelInference();await assert.rejects(pending,/autoCancelled/);
  release();await new Promise(resolve=>setImmediate(resolve));assert.equal(workers.length,0);assert.deepEqual(bitmaps.map(b=>b.closed),[1,1]);
});
test('cancelling an active headless worker ignores late results and cleans resources',async()=>{
  const {c,run,images,workers,revoked}=runner(),pending=c.quickInferImage(run,images[0]);await new Promise(resolve=>setImmediate(resolve));
  const w=workers[0];run.cancelInference();await assert.rejects(pending,/autoCancelled/);w.onmessage({data:{phase:'result',candidates:[box()]}});
  assert.equal(w.terminated,1);assert.equal(revoked.length,2);assert.equal(images[0].markers.length,0);
});
