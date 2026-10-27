const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let source = fs.readFileSync(process.env.IMAGE_COUNTER_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
if (source.includes('id="self-extract-payload"')) source = require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1], 'base64')).toString('utf8');
function section(start,end,text=source){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return text.slice(a,b);}
function editor(){
  const saved=[];
  const c={resetReviewSelection(){this.selectedMarkerId=null},cancelMarkerInteraction(){},pointers:new Map(),gesture:null,structuredClone,Date,P:{title:'Test',categories:[{id:'a'}],settings:{},images:[{id:'one',name:'one',note:'',completed:true,adjustments:{brightness:120,contrast:130,grayscale:20,rotation:90},markers:[]}]},activeImageId:'one',activeCategoryId:'a',selectedMarkerId:null,history:[],future:[],view:{zoom:2},$:()=>({}),renderAll(){},renderStorageSoon(){},defaultAdjust:()=>({brightness:100,contrast:100,grayscale:0,rotation:0})};
  c.activeImage=()=>c.P.images[0];c.scheduleSave=()=>saved.push(structuredClone(c.P));
  vm.createContext(c);vm.runInContext(section('// REVIEW:BEGIN','// REVIEW:END')+section('function cloneLight()','function dataUrlBytes(')+section('function resetCorrection()','function safeName()'),c);
  return {c,saved};
}
test('Undo and Redo schedule the restored project for autosave, empty stacks do not',()=>{
  const {c,saved}=editor();c.undo();c.redo();assert.equal(saved.length,0);
  c.pushHistory();c.P.images[0].markers.push({id:'marker'});c.undo();
  assert.equal(saved.length,1);assert.equal(saved[0].images[0].markers.length,0);
  c.redo();assert.equal(saved.length,2);assert.equal(saved[1].images[0].markers.length,1);
});
test('reset correction clears completion and Undo/Redo restore both correction and completion',()=>{
  const {c,saved}=editor(),before=structuredClone(c.P.images[0]);c.resetCorrection();
  assert.equal(c.P.images[0].completed,false);assert.deepEqual(c.P.images[0].adjustments,c.defaultAdjust());
  assert.equal(saved[0].images[0].completed,false);c.undo();assert.deepEqual(c.P.images[0],before);
  c.redo();assert.equal(c.P.images[0].completed,false);assert.deepEqual(c.P.images[0].adjustments,c.defaultAdjust());
});
function editorNavigation(){
  const pending=[],renders=[],messages=[];
  const c={resetReviewSelection(){this.selectedMarkerId=null},P:{images:['A','B','C'].map(id=>({id,dataUrl:id,markers:[{id:`marker-${id}`}]}))},activeImageId:'A',selectedMarkerId:'marker-A',interaction:{kind:'move'},draftRect:{x:1},view:{zoom:2,panX:4,panY:5},imageCache:new Map([['A',{src:'A'}]]),loadImage:src=>new Promise((resolve,reject)=>pending.push({src,resolve,reject})),resizeCanvas(){},fitView(){},Toast:{show:key=>messages.push(key)},t:key=>key};
  c.pointers=new Map();c.gesture=null;c.wrap={classList:{remove(){}}};
  c.activeImage=()=>c.P?.images.find(im=>im.id===c.activeImageId);c.renderAll=()=>renders.push([c.activeImageId,c.imageCache.get(c.activeImageId)?.src]);
  vm.createContext(c);vm.runInContext(section('// REVIEW:BEGIN','// REVIEW:END')+section('async function switchImage(', 'function displayDims(')+section('function cancelMarkerInteraction()', 'function pointerCancel('),c);
  const state=()=>JSON.parse(JSON.stringify({activeImageId:c.activeImageId,selectedMarkerId:c.selectedMarkerId,interaction:c.interaction,draftRect:c.draftRect,view:c.view}));
  return{c,pending,renders,messages,state};
}
test('editor navigation keeps the current display and editing state until matching pixels are decoded',async()=>{
  const {c,pending,renders,state}=editorNavigation(),before=state(),loading=c.switchImage('B');
  assert.deepEqual(state(),before);assert.deepEqual(renders,[]);pending[0].resolve({src:'B'});assert.equal(await loading,true);
  assert.equal(c.activeImageId,'B');assert.equal(c.selectedMarkerId,null);assert.equal(c.interaction,null);assert.equal(c.draftRect,null);assert.equal(c.view.zoom,1);assert.deepEqual(renders,[['B','B']]);
});
test('editor navigation commits only the latest selection and never caches stale decoded pixels',async()=>{
  const {c,pending,renders}=editorNavigation(),b=c.switchImage('B'),cc=c.switchImage('C');
  pending[1].resolve({src:'C'});assert.equal(await cc,true);pending[0].resolve({src:'B'});assert.equal(await b,false);
  assert.equal(c.activeImageId,'C');assert.equal(c.imageCache.has('B'),false);assert.deepEqual(renders,[['C','C']]);
});
test('editor latest decode failure preserves display and settles without allowing older success',async()=>{
  const {c,pending,renders,messages,state}=editorNavigation(),before=state(),b=c.switchImage('B'),cc=c.switchImage('C');
  pending[1].reject(new Error('broken'));await assert.doesNotReject(cc);pending[0].resolve({src:'B'});await b;
  assert.deepEqual(state(),before);assert.deepEqual(renders,[]);assert.deepEqual(messages,['decodeFail']);assert.equal(c.imageCache.has('B'),false);assert.equal(c.imageCache.has('C'),false);
});
test('editor stale decode failure cannot change the newer photo or report an unrelated error',async()=>{
  const {c,pending,renders,messages}=editorNavigation(),b=c.switchImage('B'),cc=c.switchImage('C');
  pending[1].resolve({src:'C'});await cc;pending[0].reject(new Error('old'));await assert.doesNotReject(b);
  assert.equal(c.activeImageId,'C');assert.deepEqual(renders,[['C','C']]);assert.deepEqual(messages,[]);
});
for(const change of ['project','source','record','selection'])for(const outcome of ['success','failure'])test(`editor ignores stale ${outcome} after ${change} ownership changes`,async()=>{
  const {c,pending,renders,messages,state}=editorNavigation(),loading=c.switchImage('B');
  if(change==='project')c.P={...c.P};
  if(change==='source')c.P.images[1].dataUrl='changed pixels';
  if(change==='record')c.P.images[1]={...c.P.images[1]};
  if(change==='selection')c.activeImageId='C';
  const before=state();if(outcome==='success')pending[0].resolve({src:'B'});else pending[0].reject(new Error('obsolete'));
  await assert.doesNotReject(loading);assert.deepEqual(state(),before);assert.deepEqual(renders,[]);assert.deepEqual(messages,[]);assert.equal(c.imageCache.has('B'),false);
});
test('returning to the cached current photo cancels a pending navigation',async()=>{
  const {c,pending,renders}=editorNavigation(),b=c.switchImage('B');assert.equal(await c.switchImage('A'),true);
  pending[0].resolve({src:'B'});assert.equal(await b,false);assert.equal(c.activeImageId,'A');assert.equal(c.imageCache.has('B'),false);assert.deepEqual(renders,[['A','A']]);
});
test('editor navigation can retry after failure and ignores a missing target',async()=>{
  const {c,pending,renders,state}=editorNavigation(),before=state();assert.equal(await c.switchImage('missing'),false);assert.deepEqual(state(),before);
  const failed=c.switchImage('B');pending[0].reject(new Error('broken'));assert.equal(await failed,false);
  const retry=c.switchImage('B');pending[1].resolve({src:'B'});assert.equal(await retry,true);assert.deepEqual(renders,[['B','B']]);
});
function viewer(){
  const build={lang:'en',safeJson:JSON.stringify,t:x=>x};vm.createContext(build);vm.runInContext(section('function csvEsc(', 'function markersCsv(')+section('function viewerHtml(', 'async function saveViewer('),build);
  const html=build.viewerHtml({title:'Test',images:[],categories:[],settings:{}});
  const pending=[],renders=[],frames=[],nodes=new Map();
  const c={P:{images:['A','B','C'].map(name=>({name,dataUrl:name,markers:[name]}))},idx:0,img:{name:'A'},requestedIdx:0,showGeneration:0,L:{decodeFail:'Could not decode image.'},load:name=>new Promise((resolve,reject)=>pending.push({name,resolve,reject})),byId:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,querySelector:()=>null});return nodes.get(id);},ui(){},requestAnimationFrame:fn=>frames.push(fn)};
  c.render=()=>renders.push([c.P.images[c.idx].name,c.img?.name]);
  vm.createContext(c);
  const declaration=html.match(/let idx=[^;]+;/);assert.ok(declaration);
  vm.runInContext(declaration[0].replace(/^let /,'var ')+section('async function show(n)', 'function ui()',html),c);c.img={name:'A'};
  assert.match(html, /id="loadStatus" role="status"/);
  return {c,pending,renders,frames,nodes,html};
}
test('viewer commits matching decoded image and markers only for the latest navigation',async()=>{
  const {c,pending,renders}=viewer();const b=c.show(1),a=c.show(0);
  assert.equal(c.idx,0,'pending navigation must not change displayed marker owner');
  pending[1].resolve({name:'A'});await a;pending[0].resolve({name:'B'});await b;
  assert.equal(c.idx,0);assert.equal(c.img.name,'A');assert.deepEqual(renders,[['A','A']]);
});
test('viewer latest decode failure preserves previous image/state and ignores older success',async()=>{
  const {c,pending,renders,nodes}=viewer();const b=c.show(1),cc=c.show(2);
  pending[1].reject(new Error('broken'));await assert.doesNotReject(cc);
  pending[0].resolve({name:'B'});await b;
  assert.equal(c.idx,0);assert.equal(c.img.name,'A');assert.deepEqual(renders,[]);
  assert.equal(c.requestedIdx,0);assert.equal(nodes.get('loadStatus').textContent,c.L.decodeFail);
});
test('viewer stale decode failure cannot change newer success or show an error',async()=>{
  const {c,pending,nodes}=viewer();const b=c.show(1),cc=c.show(2);
  pending[1].resolve({name:'C'});await cc;pending[0].reject(new Error('old'));await assert.doesNotReject(b);
  assert.equal(c.idx,2);assert.equal(c.img.name,'C');assert.equal(nodes.get('loadStatus').textContent,'');
});
test('viewer initial failure settles, keeps JPEG disabled, and can recover',async()=>{
  const {c,pending,nodes}=viewer();c.img=null;const first=c.show(0);pending[0].reject(new Error('invalid'));
  await assert.doesNotReject(first);assert.equal(c.img,null);assert.equal(nodes.get('jpg').disabled,true);
  const next=c.show(1);pending[1].resolve({name:'B'});await next;
  assert.equal(c.idx,1);assert.equal(nodes.get('jpg').disabled,false);assert.equal(nodes.get('loadStatus').textContent,'');
});
test('viewer navigation bindings use requested index during pending decodes',async()=>{
  const {c,pending,html}=viewer();
  vm.runInContext(section("byId('prev').onclick=", "byId('all').onchange",html),c);
  const one=c.byId('next').onclick(),two=c.byId('next').onclick();
  assert.deepEqual(pending.map(p=>p.name),['B','C']);pending[1].resolve({name:'C'});await two;pending[0].resolve({name:'B'});await one;
  assert.equal(c.idx,2);assert.equal(c.img.name,'C');
});

test('viewer ignores deferred thumbnail scrolling after a newer navigation starts',async()=>{
  const {c,pending,frames,nodes}=viewer();const b=c.show(1);pending[0].resolve({name:'B'});await b;
  const strip={scrollLeft:0,clientWidth:100,querySelector:()=>({offsetLeft:300,offsetWidth:50})};nodes.set('strip',strip);
  const cc=c.show(2);frames[0]();assert.equal(strip.scrollLeft,0);pending[1].resolve({name:'C'});await cc;
  frames[1]();assert.equal(strip.scrollLeft,256);
});
test('viewer arrow keys advance the pending target, retaining modifier and editable-field guards',async()=>{
  const {c,pending,html}=viewer();let handler,prevented=0;
  c.saveDlg={open:false};c.document={activeElement:{tagName:'BODY'},addEventListener:(name,fn)=>handler=fn};
  vm.runInContext(section("document.addEventListener('keydown'",'new ResizeObserver(render)',html),c);
  const key=(key,extra={})=>handler({key,preventDefault:()=>prevented++,...extra});
  key('ArrowRight');key('ArrowRight');assert.deepEqual(pending.map(p=>p.name),['B','C']);
  key('ArrowLeft',{ctrlKey:true});c.document.activeElement.tagName='INPUT';key('ArrowLeft');
  assert.equal(pending.length,2);assert.equal(prevented,2);
  pending[1].resolve({name:'C'});pending[0].resolve({name:'B'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(c.idx,2);assert.equal(c.img.name,'C');
});

function photoReview(){
  const {c,saved}=editor();c.Toast={show(){}};c.t=k=>k;c.quickDetectionBusy=()=>false;
  vm.runInContext(section('function imageReviewCount(', 'function drawReviewBadge(')+section('function clearImageReview(', 'async function toggleComplete()'),c);
  return{c,saved};
}
test('photo review clears all types only on the active photo with one undoable saved change',()=>{
  const {c,saved}=photoReview();const im=c.P.images[0];im.completed=false;
  im.markers=[{id:'a',categoryId:'a',needsReview:true},{id:'b',categoryId:'hidden',needsReview:true},{id:'c',needsReview:false}];
  c.P.images.push({...structuredClone(im),id:'two'});const before=structuredClone(c.P);
  c.markImageReviewed();assert.equal(c.history.length,1);assert.ok(c.P.images[0].markers.every(m=>!m.needsReview));
  assert.deepEqual(c.P.images[1],before.images[1]);assert.equal(c.P.images[0].completed,false);assert.equal(saved.length,1);
  c.undo();assert.deepEqual(c.P.images,before.images);c.redo();assert.ok(c.P.images[0].markers.every(m=>!m.needsReview));
});
test('photo review no-op or active inference preserves history, redo and existing flags',()=>{
  const {c,saved}=photoReview();c.future.push({sentinel:true});c.markImageReviewed();assert.equal(c.future.length,1);assert.equal(saved.length,0);
  c.P.images[0].markers=[{needsReview:true}];c.quickDetectionBusy=()=>true;c.markImageReviewed();assert.equal(c.P.images[0].markers[0].needsReview,true);assert.equal(c.history.length,0);
  c.activeImage=()=>null;assert.doesNotThrow(()=>c.markImageReviewed());
});

function draftSaving(){
  const pending=[],writes=[],messages=[],errors=[],draws=[],state={textContent:'saving'};
  const project={title:'Old work',categories:[{id:'a',detectionReference:{dataUrl:'reference pixels',examples:[{x:.1,y:.2,w:.3,h:.4}]}}],settings:{draftCompression:{enabled:true,quality:.8,maxEdge:100}},images:[{id:'shared',name:'old.jpg',dataUrl:'old-source',width:400,height:200,mime:'image/jpeg',markers:[{id:'one'}]},{id:'second',name:'second.jpg',dataUrl:'old-second',width:200,height:400,mime:'image/jpeg',markers:[]}]};
  const c={P:project,saveToken:1,lastDraftBytes:17,structuredClone,Blob,Math,imageCache:new Map(),draftImageCache:new Map(),console:{error:e=>errors.push(e.message)},$:()=>state,t:key=>key,Toast:{show:key=>messages.push(key)},renderStorage(){},
    loadImage:src=>new Promise((resolve,reject)=>pending.push({src,resolve,reject})),dbPut:async value=>writes.push(structuredClone(value)),
    document:{createElement(){let src;const canvas={width:0,height:0,getContext:()=>({drawImage(image){src=image.src;draws.push(src)}}),toDataURL(type,quality){return `data:image/webp;base64,${Buffer.from(`${src}|${quality}|${canvas.width}x${canvas.height}`).toString('base64')}`}};return canvas}}};
  vm.createContext(c);vm.runInContext(section('function dataUrlBytes(', 'function fmtBytes(')+section('async function webpForDraft(', 'function renderRestoreOffer('),c);
  return{c,project,pending,writes,messages,errors,draws,state};
}
const flushDraft=()=>new Promise(resolve=>setImmediate(resolve));

test('compressed draft uses one captured project and quality while preserving logical sizes and references',async()=>{
  const {c,project,pending,writes}=draftSaving(),before=structuredClone(project),saving=c.saveDraft(1);
  project.settings.draftCompression.quality=.3;project.images[0].markers.push({id:'later'});
  pending[0].resolve({src:'old-source'});await flushDraft();pending[1].resolve({src:'old-second'});await saving;
  assert.equal(writes.length,1);assert.equal(writes[0].images[0].width,400);assert.equal(writes[0].images[0].height,200);
  assert.equal(Buffer.from(writes[0].images[1].dataUrl.split(',')[1],'base64').toString(),'old-second|0.8|50x100');
  assert.deepEqual(writes[0].categories,before.categories);assert.deepEqual(writes[0].images[0].markers,[{id:'one'}]);
  assert.equal(project.images[0].dataUrl,'old-source');assert.equal(project.images[1].mime,'image/jpeg');
});

test('switching work during compression stops the old draft without touching new work or its cache',async()=>{
  const {c,pending,writes,messages,errors,state}=draftSaving(),saving=c.saveDraft(1);
  c.P=structuredClone(c.P);c.P.images=[{...c.P.images[0],dataUrl:'new-source'}];c.saveToken=2;
  state.textContent='new work is saving';pending[0].resolve({src:'old-source'});await saving;
  assert.equal(pending.length,1);assert.equal(writes.length,0);assert.deepEqual(messages,[]);assert.deepEqual(errors,[]);
  assert.equal(state.textContent,'new work is saving');assert.equal(c.lastDraftBytes,17);assert.equal(c.draftImageCache.size,0);
});

test('an old decoder cannot overwrite the compressed cache for a new project with identical photo IDs and source lengths',async()=>{
  const {c,pending,writes,state}=draftSaving(),oldSave=c.saveDraft(1);
  c.P=structuredClone(c.P);c.P.title='New work';c.P.images=[{...c.P.images[0],dataUrl:'new-source'}];c.saveToken=2;
  const newSave=c.saveDraft(2);assert.deepEqual(pending.map(p=>p.src),['old-source','new-source']);
  pending[1].resolve({src:'new-source'});await newSave;
  pending[0].resolve({src:'old-source'});await oldSave;
  c.saveToken=3;await c.saveDraft(3);
  assert.equal(writes.length,2);assert.equal(writes[1].title,'New work');
  assert.equal(Buffer.from(writes[1].images[0].dataUrl.split(',')[1],'base64').toString(),'new-source|0.8|100x50');
  assert.equal(state.textContent,'saved');assert.equal(pending.length,2,'valid current-project compression remains cached');
});

for(const change of ['token','project'])test(`a superseded ${change} ignores a late compression failure`,async()=>{
  const {c,pending,writes,messages,errors,state}=draftSaving(),saving=c.saveDraft(1);
  if(change==='token')c.saveToken=2;else c.P=structuredClone(c.P);
  state.textContent='newer work';pending[0].reject(new Error('obsolete decode'));await saving;
  assert.equal(writes.length,0);assert.deepEqual(messages,[]);assert.deepEqual(errors,[]);assert.equal(state.textContent,'newer work');
});

for(const outcome of ['success','failure'])test(`an obsolete database ${outcome} cannot mark newer edits saved or failed`,async()=>{
  const {c,state,messages,errors}=draftSaving();c.P.settings.draftCompression.enabled=false;
  let resolve,reject;c.dbPut=()=>new Promise((ok,ng)=>{resolve=ok;reject=ng});const saving=c.saveDraft(1);await flushDraft();
  c.saveToken=2;c.P.images[0].markers.push({id:'unsaved'});state.textContent='saving newer edits';
  if(outcome==='success')resolve();else reject(new Error('obsolete write'));await saving;
  assert.equal(state.textContent,'saving newer edits');assert.equal(c.lastDraftBytes,17);assert.deepEqual(messages,[]);assert.deepEqual(errors,[]);
});

test('the current autosave still reports a real failure and can save successfully on retry',async()=>{
  const {c,pending,messages,state,writes}=draftSaving();c.P.images=c.P.images.slice(0,1);
  const failed=c.saveDraft(1);pending[0].reject(new Error('current decode failed'));await failed;
  assert.equal(state.textContent,'!');assert.deepEqual(messages,['saveError']);assert.equal(writes.length,0);
  c.saveToken=2;const retry=c.saveDraft(2);pending[1].resolve({src:'old-source'});await retry;
  assert.equal(writes.length,1);assert.equal(state.textContent,'saved');assert.ok(c.lastDraftBytes>17);
});

test('saving originals preserves the project snapshot without decoding photos',async()=>{
  const {c,pending,writes,state}=draftSaving();c.P.settings.draftCompression.enabled=false;
  const before=structuredClone(c.P);await c.saveDraft(1);
  assert.equal(pending.length,0);assert.deepEqual(writes,[before]);assert.equal(state.textContent,'saved');
});

test('an already superseded timer does no preparation or write',async()=>{
  const {c,pending,writes,state}=draftSaving();c.saveToken=2;state.textContent='newer edits';
  const saving=c.saveDraft(1);await flushDraft();const started=pending.length;
  pending[0]?.reject(new Error('obsolete request should not decode'));await saving;
  assert.equal(started,0);assert.equal(writes.length,0);assert.equal(state.textContent,'newer edits');
});

function deferredDraftDatabase(){
  const f=draftSaving(),opens=[],transactions=[],closed=[];let stored;
  f.c.P.settings.draftCompression.enabled=false;
  f.c.openDb=()=>new Promise((resolve,reject)=>opens.push({resolve,reject}));
  vm.runInContext(section('async function dbPut(', 'async function dbGet('),f.c);
  function connection(name){return{close(){closed.push(name)},transaction(store,mode){
    transactions.push({name,store,mode});
    const tx={objectStore:()=>({put(value,key){assert.equal(key,'draft');stored=structuredClone(value)}})};
    queueMicrotask(()=>tx.oncomplete?.());return tx;
  }}}
  return{...f,opens,transactions,closed,connection,stored:()=>stored};
}

test('an old database open completing after a newer save cannot overwrite the newer draft',async()=>{
  const {c,opens,transactions,closed,connection,stored,state}=deferredDraftDatabase();
  const oldSave=c.saveDraft(1);await flushDraft();assert.equal(opens.length,1);
  c.P=structuredClone(c.P);c.P.title='Newest work';c.P.images[0].markers.push({id:'new-marker'});c.saveToken=2;
  const newSave=c.saveDraft(2);await flushDraft();assert.equal(opens.length,2);
  opens[1].resolve(connection('new'));await newSave;
  opens[0].resolve(connection('old'));await oldSave;
  assert.equal(stored().title,'Newest work');assert.equal(stored().images[0].markers.length,2);
  assert.deepEqual(transactions,[{name:'new',store:'state',mode:'readwrite'}]);
  assert.deepEqual(closed,['new','old']);assert.equal(state.textContent,'saved');
});

test('new edits while the database opens prevent the obsolete transaction and retain unsaved status',async()=>{
  const {c,opens,transactions,closed,connection,state}=deferredDraftDatabase(),saving=c.saveDraft(1);
  await flushDraft();c.saveToken=2;c.P.images[0].markers.push({id:'not-yet-saved'});state.textContent='saving newer edits';
  opens[0].resolve(connection('obsolete'));await saving;
  assert.deepEqual(transactions,[]);assert.deepEqual(closed,['obsolete']);assert.equal(state.textContent,'saving newer edits');
  assert.equal(c.lastDraftBytes,17);
});
