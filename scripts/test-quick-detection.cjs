const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||path.join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing ${a}`);return source.slice(i,j)}
const box=(x=.1)=>({x,y:.2,w:.15,h:.2,score:.8});
const plain=value=>JSON.parse(JSON.stringify(value));
const pendingMarker=(id,x=.1,extra={})=>({id,shape:'rect',categoryId:'a',x,y:.2,w:.15,h:.2,order:1,createdAt:123,needsReview:true,autoPending:true,...extra});
function setup(mode='append'){
  const reference={examples:[box()],dataUrl:'ref'},category={id:'a',detectionReference:reference},images=['one','two','three'].map(id=>({id,name:id,dataUrl:id,markers:[],detectionChecks:[],completed:true,adjustments:{rotation:0}}));
  const c={Number,Math,Date,Set,Map,Array,Error,structuredClone,P:{images,categories:[category],settings:{}},history:[],future:[],activeImageId:'one',activeCategoryId:'a',selectedMarkerId:null,lastMarkerId:null,lastMarkerAt:0,quickState:{run:null,report:null},autoState:{model:{}},$:()=>({}),renderAll(){},renderStorageSoon(){},scheduleSave(){},renderQuickDetection(){},id:(()=>{let i=0;return()=>String(++i)})()};
  c.activeImage=()=>c.P.images.find(im=>im.id===c.activeImageId);
  vm.createContext(c);vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END')+section('function cloneLight()','function dataUrlBytes(')+section('function nextOrder(im)','function addPoint(')+section('// QUICK:CORE:BEGIN','// QUICK:CORE:END'),c);
  const run={project:c.P,category,reference,model:c.autoState.model,mode,sources:images.map(image=>({image,dataUrl:image.dataUrl})),targets:images,rows:[],added:0,removed:0,historyStarted:false,index:0};c.quickState.run=run;
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
  assert.equal(images[0].markers[1].autoPending,true);assert.equal(images[1].markers[0].autoPending,true);
  assert.equal(images[2].markers.length,0);assert.equal(images[2].completed,true);
  c.undo();assert.equal(c.P.images[0].markers.length,1);assert.equal(c.P.images[1].markers.length,0);assert.equal(c.P.images[1].completed,true);
  c.redo();assert.equal(c.P.images[1].markers[0].needsReview,true);assert.equal(c.P.images[1].markers[0].autoPending,true);
});
test('append retains prior automatic results and filters new candidates against them',()=>{
  const {c,run,images}=setup();images[0].markers=[pendingMarker('old')];const before=plain(images[0].markers);
  const result=c.quickCommitResult(run,images[0],[box(),box(.6)]);
  assert.equal(result.added,1);assert.equal(result.duplicates,1);assert.deepEqual(plain(images[0].markers.slice(0,1)),before);
  assert.equal(images[0].markers[1].autoPending,true);assert.equal(images[0].markers[1].needsReview,true);
});
test('replace removes only pending unreviewed automatic markers of the captured type',()=>{
  const {c,run,images}=setup('replace');c.P.categories.push({id:'b',visible:false});c.activeCategoryId='b';
  const legacy=pendingMarker('legacy',.1,{y:.6});delete legacy.autoPending;
  images[0].markers=[pendingMarker('replace-me'),pendingMarker('reviewed',.4,{needsReview:false}),pendingMarker('other-type',.7,{categoryId:'b'}),legacy,
    pendingMarker('manual',.4,{y:.6,autoPending:false}),pendingMarker('untrusted-tag',.7,{y:.6,autoPending:'true'})];
  const retained=plain(images[0].markers.slice(1)),candidates=images[0].markers.map(m=>({x:m.x,y:m.y,w:m.w,h:m.h,score:.8}));
  const result=c.quickCommitResult(run,images[0],candidates);
  assert.equal(result.added,1,'the removed marker must not block its corrected replacement');assert.equal(result.duplicates,5);
  assert.deepEqual(plain(images[0].markers.slice(0,5)),retained);assert.equal(images[0].markers.length,6);
  assert.equal(images[0].markers.some(m=>m.id==='replace-me'),false);assert.equal(images[0].markers[5].autoPending,true);
  assert.equal(images[0].markers[5].needsReview,true);assert.equal(images[0].completed,false);assert.equal(c.history.length,1);
  assert.equal(result.removed,1);assert.equal(run.removed,1);
});
test('replacement retains manual points and nonboolean review flags even when their auto tag is truthy',()=>{
  const {c,run,images}=setup('replace');images[0].markers=[{id:'manual-point',shape:'point',categoryId:'a',x:.15,y:.25,needsReview:true,order:1},pendingMarker('nonboolean-review',.6,{needsReview:'true'})];
  const before=plain(images[0].markers),result=c.quickCommitResult(run,images[0],[box(),box(.6)]);
  assert.equal(result.added,0);assert.equal(result.removed,0);assert.equal(result.duplicates,2);assert.deepEqual(plain(images[0].markers),before);
});
test('a valid zero-candidate replacement removes pending markers and Undo restores their exact metadata',()=>{
  const {c,run,images}=setup('replace');images[0].markers=[pendingMarker('old',.1,{order:17})];c.P.updatedAt=123;c.future.push({sentinel:1});
  const before=plain(images[0]);const result=c.quickCommitResult(run,images[0],[]);
  assert.equal(result.added,0);assert.equal(result.removed,1);assert.equal(images[0].markers.length,0);assert.equal(images[0].completed,false);assert.equal(c.history.length,1);assert.equal(c.future.length,0);
  c.undo();assert.deepEqual(plain(images[0]),before);c.redo();assert.equal(images[0].markers.length,0);assert.equal(images[0].completed,false);
});
test('duplicates-only replacement keeps protected markers but records a photo check for review',()=>{
  const {c,run,images}=setup('replace');images[0].markers=[pendingMarker('reviewed',.1,{needsReview:false})];c.P.updatedAt=123;c.future.push({sentinel:1});let saves=0;c.scheduleSave=()=>saves++;
  const before=plain(images[0].markers),result=c.quickCommitResult(run,images[0],[box()]);
  assert.equal(result.added,0);assert.equal(result.duplicates,1);assert.equal(result.removed,0);assert.deepEqual(plain(images[0].markers),before);
  assert.equal(images[0].detectionChecks.length,1);assert.equal(images[0].detectionChecks[0].categoryId,'a');assert.equal(images[0].detectionChecks[0].reviewed,false);
  assert.ok(Number.isFinite(images[0].detectionChecks[0].detectedAt));assert.equal(images[0].completed,false);assert.equal(c.history.length,1);assert.equal(c.future.length,0);assert.equal(saves,1);
});
test('replacement across photos is one Undo transaction including original marker metadata',async()=>{
  const {c,run,images}=setup('replace');images[0].markers=[pendingMarker('old-one')];images[1].markers=[pendingMarker('old-two',.1,{order:7})];
  const before=plain(images);c.quickInferImage=async(r,im)=>({candidates:im.id==='two'?[]:[box(.6)],truncated:0});
  await c.quickProcessImages(run);assert.equal(c.history.length,1);assert.equal(images[0].markers.some(m=>m.id==='old-one'),false);assert.equal(images[1].markers.length,0);assert.equal(images[2].markers.length,1);
  const after=plain(images);c.undo();assert.deepEqual(plain(images),before);c.redo();assert.deepEqual(plain(images),after);
});
test('zero and repeated successful results share history and record the current type check only once',()=>{
  const {c,run,images}=setup();c.future.push({sentinel:1});images[0].detectionChecks=[{categoryId:'b',detectedAt:456,reviewed:true},{categoryId:'a',detectedAt:123,reviewed:true}];
  const before=plain(images[0]);c.quickCommitResult(run,images[0],[]);assert.equal(c.history.length,1);assert.equal(c.future.length,0);assert.equal(images[0].completed,false);
  assert.equal(images[0].detectionChecks.length,2);assert.deepEqual(plain(images[0].detectionChecks.find(check=>check.categoryId==='b')),{categoryId:'b',detectedAt:456,reviewed:true});
  assert.equal(images[0].detectionChecks.find(check=>check.categoryId==='a').reviewed,false);
  c.quickCommitResult(run,images[0],[box()]);c.quickCommitResult(run,images[0],[box()]);
  assert.equal(c.history.length,1);assert.equal(images[0].markers.length,1);assert.equal(images[0].detectionChecks.length,2);
  c.undo();assert.deepEqual(plain(images[0]),before);
});
for(const change of ['project','pixels','reference','category','model','images','cancel'])test(`stale ${change} rejects replacement and preserves prior results`,()=>{
  const {c,run,images,category}=setup('replace');images[0].markers=[pendingMarker('old')];images[0].detectionChecks=[{categoryId:'a',detectedAt:123,reviewed:false}];c.future.push({sentinel:1});c.P.updatedAt=123;
  if(change==='project')c.P={...c.P};if(change==='pixels')images[0].dataUrl='changed';if(change==='reference')category.detectionReference={};
  if(change==='category')c.P.categories=[];if(change==='model')c.autoState.model={};if(change==='images')c.P.images=images.slice(1);if(change==='cancel')c.quickState.run=null;
  const before=plain(images[0]);assert.equal(c.quickRunCurrent(run),false);assert.equal(c.quickCommitResult(run,images[0],[box()]).added,0);assert.equal(c.history.length,0);
  assert.deepEqual(plain(images[0]),before);assert.equal(c.future.length,1);assert.equal(c.P.updatedAt,123);
});
test('a current-photo run cannot replace markers or record a check on an untargeted photo',()=>{
  const {c,run,images}=setup('replace');run.targets=[images[0]];images[1].markers=[pendingMarker('untargeted')];const before=plain(images[1]);
  assert.equal(c.quickCommitResult(run,images[1],[]).added,0);assert.deepEqual(plain(images[1]),before);assert.equal(c.history.length,0);
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
test('stopping a replacement batch keeps completed replacements and preserves the pending and later photos',async()=>{
  const {c,run,images}=setup('replace');for(const im of images){im.markers=[pendingMarker(`old-${im.id}`)];im.detectionChecks=[{categoryId:'a',detectedAt:123,reviewed:false}]}
  const before=plain(images);let release;const calls=[];c.quickInferImage=async(r,im)=>{calls.push(im.id);if(im.id==='two')await new Promise(resolve=>release=resolve);return{candidates:[box(.6)],truncated:0}};
  const pending=c.quickProcessImages(run);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['one','two']);assert.equal(images[0].markers.some(m=>m.id==='old-one'),false);assert.deepEqual(plain(images[1]),before[1]);assert.deepEqual(plain(images[2]),before[2]);
  c.finishQuickDetection(run,'cancelled');release();await pending;
  assert.deepEqual(calls,['one','two']);assert.deepEqual(plain(images[1]),before[1]);assert.deepEqual(plain(images[2]),before[2]);assert.equal(run.rows.length,1);assert.equal(run.rows[0].removed,1);assert.equal(c.history.length,1);
  c.undo();assert.deepEqual(plain(images),before);
});
for(const error of ['autoInvalidImage','autoModelError'])test(`${error} preserves old automatic markers and detection metadata during replacement`,async()=>{
  const {c,run,images}=setup('replace');for(const im of images){im.markers=[pendingMarker(`old-${im.id}`)];im.detectionChecks=[{categoryId:'a',detectedAt:123,reviewed:true}]}
  const before=plain(images);c.quickInferImage=async(r,im)=>{if(im.id==='two')throw new Error(error);return{candidates:[],truncated:0}};
  await c.quickProcessImages(run);assert.deepEqual(plain(images[1]),before[1]);assert.equal(images[0].markers.length,0);assert.equal(images[0].detectionChecks[0].reviewed,false);
  if(error==='autoModelError')assert.deepEqual(plain(images[2]),before[2]);else assert.equal(images[2].markers.length,0);
  assert.equal(run.rows[1].error,error);assert.equal(c.history.length,1);c.undo();assert.deepEqual(plain(images),before);
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
function runner(mode='append'){
  const {c,run,images}=setup(mode),bitmaps=[],revoked=[],workers=[];run.backend='wasm';run.precision='fp32';run.threshold=.05;run.model.arrayBuffer=async()=>new ArrayBuffer(3);
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
for(const [label,result] of [['explicit zero',{phase:'result',candidates:[],truncated:0}],['omitted truncation count',{phase:'result',candidates:[]}]])test(`a validated empty worker result (${label}) completes replacement and records the photo for review`,async()=>{
  const {c,run,images,workers}=runner('replace');run.targets=[images[0]];images[0].markers=[pendingMarker('old')];
  const pending=c.quickProcessImages(run);await new Promise(resolve=>setImmediate(resolve));workers[0].onmessage({data:result});await pending;
  assert.equal(run.phase,'done');assert.equal(images[0].markers.length,0);assert.equal(images[0].detectionChecks[0].reviewed,false);assert.equal(run.rows[0].added,0);assert.equal(run.rows[0].removed,1);assert.equal(c.history.length,1);
});
for(const candidates of [[],[box(.6)]])test(`capped replacement output (${candidates.length} returned candidates) preserves prior markers and review metadata`,async()=>{
  const {c,run,images,workers}=runner('replace');run.targets=[images[0]];images[0].markers=[pendingMarker('old')];images[0].detectionChecks=[{categoryId:'a',detectedAt:123,reviewed:true}];c.future.push({sentinel:1});c.P.updatedAt=123;const before=plain(images[0]);
  const pending=c.quickProcessImages(run);await new Promise(resolve=>setImmediate(resolve));workers[0].onmessage({data:{phase:'result',candidates,truncated:1}});await pending;
  assert.deepEqual(plain(images[0]),before);assert.equal(c.history.length,0);assert.equal(c.future.length,1);assert.equal(c.P.updatedAt,123);assert.equal(run.phase,'error');assert.equal(run.rows[0].error,'autoReplaceTruncated');assert.equal(workers[0].terminated,1);
});
test('capped append output keeps prior markers and reports the omitted candidate count',async()=>{
  const {c,run,images,workers}=runner('append');run.targets=[images[0]];images[0].markers=[pendingMarker('old')];const before=plain(images[0].markers[0]);
  const pending=c.quickProcessImages(run);await new Promise(resolve=>setImmediate(resolve));workers[0].onmessage({data:{phase:'result',candidates:[box(.6)],truncated:3}});await pending;
  assert.equal(run.phase,'done');assert.deepEqual(plain(images[0].markers[0]),before);assert.equal(images[0].markers.length,2);assert.equal(images[0].detectionChecks.length,1);assert.equal(images[0].detectionChecks[0].reviewed,false);assert.equal(run.rows[0].truncated,3);assert.equal(run.rows[0].added,1);assert.equal(run.rows[0].removed,0);
});
for(const [label,result] of [
  ['missing candidates',{phase:'result',truncated:0}],
  ['invalid box among valid boxes',{phase:'result',candidates:[box(),{...box(.6),w:0}],truncated:0}],
  ['invalid box only',{phase:'result',candidates:[{...box(),x:-.1}],truncated:0}],
  ['nonfinite geometry',{phase:'result',candidates:[{...box(),x:Infinity}],truncated:0}],
  ['negative truncated count',{phase:'result',candidates:[],truncated:-1}],
  ['fractional truncated count',{phase:'result',candidates:[],truncated:.5}],
  ['nonfinite truncated count',{phase:'result',candidates:[],truncated:NaN}],
  ['string truncated count',{phase:'result',candidates:[],truncated:'1'}],
])test(`malformed inference (${label}) cannot erase pending results in replace mode`,async()=>{
  const {c,run,images,workers}=runner('replace');run.targets=[images[0]];images[0].markers=[pendingMarker('old')];images[0].detectionChecks=[{categoryId:'a',detectedAt:123,reviewed:false}];c.future.push({sentinel:1});const before=plain(images[0]);
  const pending=c.quickProcessImages(run);await new Promise(resolve=>setImmediate(resolve));workers[0].onmessage({data:result});await pending;
  assert.deepEqual(plain(images[0]),before);assert.equal(c.history.length,0);assert.equal(c.future.length,1);assert.equal(run.phase,'error');assert.equal(run.rows[0].error,'autoInvalidOutput');assert.equal(workers[0].terminated,1);
});
function ui(){
  const f=setup(),{c,run,category}=f,nodes=new Map();c.$=key=>{if(!nodes.has(key))nodes.set(key,{hidden:false,open:false,textContent:'',value:key==='#autoThreshold'?'0.05':key==='#autoBackend'?'wasm':key==='#quickMode'?'append':'fp32',focus(){},scrollIntoView(){},append(){},addEventListener(){}});return nodes.get(key)};
  Object.assign(c,{activeCategory:()=>category,autoCurrentReference:()=>category.detectionReference,t:k=>k,document:{body:{},querySelector:()=>null,createElement:()=>({})},addEventListener(){},Toast:{hide(){},show(){}},cancelMarkerInteraction(){},pointers:new Map(),Worker:class{},OffscreenCanvas:class{},createImageBitmap(){},imageCache:new Map()});c.autoState.model.size=1;
  vm.runInContext(section('// QUICK:UI:BEGIN','// QUICK:UI:END'),c);return{...f,nodes};
}
test('quick UI locks the hidden toast as well as editor and mobile controls',()=>{
  const {c,run}=ui();c.run=run;vm.runInContext('quickState.run=run',c);c.renderQuickDetection();
  for(const key of ['#workspace','#mobileBar','#toast'])assert.equal(c.$(key).inert,true,key);
  vm.runInContext('quickState.run=null',c);c.renderQuickDetection();for(const key of ['#workspace','#mobileBar','#toast'])assert.equal(c.$(key).inert,false,key);
});
test('quick detection captures append mode and the current photo target at start',async()=>{
  const {c,images}=ui();let captured;c.quickProcessImages=async run=>captured=run;await c.startQuickDetection();
  assert.equal(captured.mode,'append');assert.equal(captured.targets.length,1);assert.equal(captured.targets[0],images[0]);
});
test('changing the selector after an all-photo run starts cannot change its captured replacement mode',async()=>{
  const {c,images}=ui();let release,captured;c.$('#quickMode').value='replace';c.quickProcessImages=async run=>{captured=run;await new Promise(resolve=>release=resolve)};
  const pending=c.startQuickDetection(true);c.$('#quickMode').value='append';
  assert.equal(captured.mode,'replace');assert.deepEqual(Array.from(captured.targets),images);release();await pending;
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
