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
