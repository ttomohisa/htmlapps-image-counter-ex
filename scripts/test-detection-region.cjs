const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||require('node:path').join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing ${a}`);return source.slice(i,j)}
const c={Number,Math};vm.createContext(c);
test('strict normalized region and inclusive center predicate',()=>{vm.runInContext(section('// REGION:CORE:BEGIN','// REGION:CORE:END'),c);const r={x:.2,y:.3,w:.4,h:.5};assert.equal(c.validDetectionRegion(r),true);for(const bad of [null,[],{}, {...r,x:'0.2'},{...r,w:0},{...r,x:.8}])assert.equal(!!c.validDetectionRegion(bad),false);assert.equal(c.detectionRegionContains(r,{x:.1,y:.3,w:.2,h:.2}),true);assert.equal(c.detectionRegionContains(r,{x:.7,y:.4,w:.1,h:.1}),false);assert.equal(c.detectionRegionContains(undefined,{x:1,y:1}),true)});
test('scope filtering and replacement use shared predicate after raw validation',()=>{assert.match(source,/autoFilter\(candidates,retained,im.detectionRegion\)/);assert.match(source,/autoFilter\(candidates,im.markers,im.detectionRegion\)/);assert.match(source,/detectionRegionContains\(im.detectionRegion,m\)/);assert.match(source,/if\(im.detectionRegion!==undefined&&!validDetectionRegion\(im.detectionRegion\)\)fail\(\)/)});
test('region bounds reject even tiny overflow and centers include exact edges',()=>{
  vm.runInContext(section('// REGION:CORE:BEGIN','// REGION:CORE:END'),c);
  assert.equal(c.validDetectionRegion({x:.8,y:0,w:.200000000001,h:1}),false);
  assert.equal(c.validDetectionRegion({x:.2,y:.3,w:.4,h:.5,score:.8}),false);
  const r={x:.2,y:.3,w:.4,h:.5};
  assert.equal(c.detectionRegionContains(r,{x:.2,y:.3,w:0,h:0}),true);
  assert.equal(c.detectionRegionContains(r,{x:.6,y:.8,w:0,h:0}),true);
  assert.equal(c.detectionRegionContains(r,{x:.600001,y:.8,w:0,h:0}),false);
});
test('display rectangle maps back to original at each right-angle rotation',()=>{
  vm.runInContext(section('function toDisplayNorm(', 'function screenToOriginal(')+section('function autoOriginalRect(', 'function autoPromptMask('),c);
  const cases=[[0,{x:.2,y:.3,w:.4,h:.5}],[90,{x:.3,y:.4,w:.5,h:.4}],[180,{x:.4,y:.2,w:.4,h:.5}],[270,{x:.2,y:.2,w:.5,h:.4}]];
  for(const [rot,want] of cases){const got=c.autoOriginalRect(.2,.3,.6,.8,rot);for(const key of ['x','y','w','h'])assert.ok(Math.abs(got[key]-want[key])<1e-10,`${rot} ${key}: ${got[key]}`)}
});
test('region editor exposes an independent dialog and explicit save, cancel, clear controls',()=>{
  for(const id of ['detectionRegionOpen','detectionRegionSummary','detectionRegionDlg','detectionRegionTarget','detectionRegionCanvas','detectionRegionLeft','detectionRegionTop','detectionRegionRight','detectionRegionBottom','detectionRegionClear','detectionRegionCancel','detectionRegionSave'])assert.match(source,new RegExp(`id="${id}"`));
  assert.match(source,/function openDetectionRegion\(/);assert.match(source,/function saveDetectionRegion\(/);assert.match(source,/function cancelDetectionRegion\(/);
});
function saveContext(){
  const im={id:'photo',dataUrl:'pixels',detectionRegion:{x:.1,y:.2,w:.3,h:.4},completed:true},project={images:[im]},elements={detectionRegionError:{textContent:''}};
  let pushes=0,saves=0,renders=0;
  const s={Number,Math,P:project,regionState:{owner:{project,image:im,dataUrl:'pixels'},draft:{x:.2,y:.2,w:.3,h:.4},image:{},drag:null,pointers:new Set(),invalid:false},regionDialog:{open:true},activeImage:()=>im,regionOwnerCurrent(){return s.P===s.regionState.owner.project&&s.activeImage()===s.regionState.owner.image&&im.dataUrl===s.regionState.owner.dataUrl},$:selector=>elements[selector.slice(1)]||{},pushHistory(){pushes++},touch(){saves++},renderAll(){renders++},cancelDetectionRegion(){s.regionDialog.open=false},Toast:{show(){}},t:x=>x,undo(){}};
  vm.createContext(s);vm.runInContext(section('// REGION:CORE:BEGIN','// REGION:CORE:END')+section('function regionSame(', 'function regionFields(')+section('function saveDetectionRegion(', 'function regionReadFields('),s);
  return{s,im,project,counts:()=>({pushes,saves,renders})};
}
test('saving a changed region reopens completion and makes one history and autosave transaction',()=>{
  const {s,im,counts}=saveContext();s.saveDetectionRegion();assert.deepEqual(JSON.parse(JSON.stringify(im.detectionRegion)),{x:.2,y:.2,w:.3,h:.4});assert.equal(im.completed,false);assert.deepEqual(counts(),{pushes:1,saves:1,renders:1});
});
test('clearing a region is undoable, while a no-op and stale owner make no mutation',()=>{
  const cleared=saveContext();cleared.s.regionState.draft=null;cleared.s.saveDetectionRegion();assert.equal(Object.hasOwn(cleared.im,'detectionRegion'),false);assert.deepEqual(cleared.counts(),{pushes:1,saves:1,renders:1});
  const same=saveContext();same.s.regionState.draft={...same.im.detectionRegion};same.s.saveDetectionRegion();assert.deepEqual(same.counts(),{pushes:0,saves:0,renders:0});assert.equal(same.im.completed,true);
  const stale=saveContext();stale.s.P={images:[]};stale.s.saveDetectionRegion();assert.deepEqual(stale.counts(),{pushes:0,saves:0,renders:0});assert.equal(stale.im.completed,true);
});
test('dialog rejects malformed raw candidate before region filtering',()=>{
  const image={id:'p',dataUrl:'pixels',markers:[],detectionRegion:{x:.2,y:.2,w:.3,h:.3}},category={id:'a'},project={images:[image],categories:[category]};
  let pushes=0;const env={Number,Math,P:project,activeImage:()=>image,activeCategory:()=>category,pushHistory(){pushes++},markActiveIncomplete(){},nextOrder:()=>1,id:()=>'',setMode(){},touch(){},renderAll(){},Date};
  vm.createContext(env);vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END'),env);
  const owner={project,imageId:'p',dataUrl:'pixels',categoryId:'a'};
  assert.throws(()=>env.applyAutoCandidates(owner,[{x:NaN,y:.1,w:.2,h:.2}],category.id),/autoInvalidOutput/);
  assert.equal(pushes,0);assert.equal(image.markers.length,0);
});
test('dialog accepts only candidate centers within the target region',()=>{
  const env={Number,Math};vm.createContext(env);vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END'),env);
  const region={x:.2,y:.2,w:.4,h:.4},candidates=[{x:.1,y:.25,w:.2,h:.1},{x:.6,y:.25,w:.2,h:.1},{x:.3,y:.3,w:.1,h:.1}];
  const result=env.autoFilter(candidates,[],region);assert.equal(result.accepted.length,2);assert.equal(result.accepted[0].x,.1);assert.equal(result.accepted[1].x,.3);
});
test('Replace preserves pending markers outside the target region',()=>{
  const ref={},cat={id:'a',detectionReference:ref},region={x:.2,y:.2,w:.3,h:.3};
  const marker=(id,x)=>({id,shape:'rect',categoryId:'a',x,y:.25,w:.1,h:.1,order:1,createdAt:1,needsReview:true,autoPending:true});
  const im={id:'p',dataUrl:'pixels',detectionRegion:region,markers:[marker('outside',.7),marker('inside',.25)],detectionChecks:[],completed:true};
  const project={images:[im],categories:[cat],settings:{}},model={},run={project,category:cat,reference:ref,model,mode:'replace',sources:[{image:im,dataUrl:'pixels'}],targets:[im],historyStarted:false,added:0,removed:0};
  const history=[],env={Number,Math,Date,Set,Map,Array,Error,structuredClone,P:project,autoState:{model},quickState:{run},history,future:[],activeImage:()=>im,activeCategory:()=>cat,pushHistory(){history.push({})},nextOrder:()=>2,id:()=> 'new',touch(){},renderAll(){}};
  vm.createContext(env);vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END')+section('// QUICK:CORE:BEGIN','// QUICK:CORE:END'),env);
  const result=env.quickCommitResult(run,im,[{x:.25,y:.25,w:.1,h:.1}]);
  assert.equal(result.removed,1);assert.equal(im.markers.some(m=>m.id==='outside'),true);assert.equal(im.markers.some(m=>m.id==='inside'),false);assert.equal(im.markers.some(m=>m.id==='new'),true);
});
function regionUi(){
  const elements=new Map(),events=new Map(),captures=new Set();let saves=0;
  function element(id){if(elements.has(id))return elements.get(id);const handlers={};const e={id,open:false,disabled:false,value:'',textContent:'',clientWidth:100,clientHeight:100,handlers,addEventListener(type,fn){handlers[type]=fn},focus(){},getBoundingClientRect(){return{left:0,top:0,width:100,height:100}},setPointerCapture(id){captures.add(id)},hasPointerCapture(id){return captures.has(id)},releasePointerCapture(id){captures.delete(id)},showModal(){this.open=true},close(){this.open=false}};elements.set(id,e);return e}
  const $=selector=>element(selector.slice(1)),im={id:'photo',name:'Target',dataUrl:'pixels',adjustments:{rotation:90},detectionRegion:{x:.1,y:.2,w:.3,h:.4},completed:true,markers:[]},project={images:[im],categories:[{id:'a'}]};
  const env={Number,Math,Set,Map,Date,P:project,$,imageCache:new Map([['photo',{}]]),activeImage:()=>im,quickDetectionBusy:()=>false,quickImportsBusy:()=>false,document:{querySelector:()=>null},addEventListener(type,fn){events.set(type,fn)},cancelMarkerInteraction(){},pointers:new Map(),gesture:null,currentIndex:()=>0,t:(key)=>key,Toast:{show(){}},undo(){},pushHistory(){env.history++},history:0,touch(){saves++},renderAll(){},loadImage:async()=>({})};
  vm.createContext(env);vm.runInContext(section('// REGION:CORE:BEGIN','// REGION:CORE:END')+section('function displayDims(', 'function screenToOriginal(')+section('function autoOriginalRect(', 'function autoPromptMask(')+section('function autoDisplayBox(', 'function renderAutoPreview(')+section('// REGION:UI:BEGIN','// REGION:UI:END'),env);
  env.regionDraw=()=>{};const state=()=>vm.runInContext('regionState',env),canvas=element('detectionRegionCanvas'),dialog=element('detectionRegionDlg');
  const send=(type,id,u=.2,v=.3)=>{const e={pointerId:id,clientX:u*100,clientY:v*100,preventDefault(){}};canvas.handlers[type](e)};
  return{env,im,project,state,canvas,dialog,element,send,saves:()=>saves,events};
}
test('invalid numeric bounds show an error and disable Save, then recover on correction',()=>{
  const f=regionUi();f.state().owner={project:f.project,image:f.im,dataUrl:'pixels'};f.state().image={};f.state().draft={...f.im.detectionRegion};f.dialog.open=true;
  for(const [key,value] of [['Left','0'],['Top','0'],['Right','50'],['Bottom','100']])f.element('detectionRegion'+key).value=value;
  const original=JSON.stringify(f.im),draft=JSON.stringify(f.state().draft);
  for(const invalid of ['0','-1','101','']){
    f.element('detectionRegionRight').value=invalid;f.element('detectionRegionRight').handlers.input();
    assert.equal(f.element('detectionRegionError').textContent,'autoInvalidBounds');assert.equal(f.element('detectionRegionSave').disabled,true);
    f.env.saveDetectionRegion();assert.equal(JSON.stringify(f.im),original);assert.equal(JSON.stringify(f.state().draft),draft);assert.equal(f.env.history,0);
  }
  f.element('detectionRegionRight').value='50';f.element('detectionRegionRight').handlers.input();
  assert.equal(f.element('detectionRegionError').textContent,'');assert.equal(f.element('detectionRegionSave').disabled,false);assert.equal(f.state().invalid,false);
});
for(const end of ['pointercancel','lostpointercapture'])test(`${end} discards a rotated region drag and late release cannot commit it`,()=>{
  const f=regionUi(),before=JSON.stringify(f.im);f.state().owner={project:f.project,image:f.im,dataUrl:'pixels'};f.state().image={};f.dialog.open=true;
  f.send('pointerdown',1,.2,.3);f.send('pointermove',1,.6,.8);f.send(end,1,.6,.8);f.send('pointerup',1,.6,.8);
  assert.deepEqual(JSON.parse(JSON.stringify(f.state().draft)),null);assert.equal(JSON.stringify(f.im),before);assert.equal(f.env.history,0);assert.equal(f.saves(),0);
});
for(const order of [[1,2],[2,1]])test(`second pointer cancels region drag when pointer ${order[0]} releases first`,()=>{
  const f=regionUi(),before=JSON.stringify(f.im);f.state().owner={project:f.project,image:f.im,dataUrl:'pixels'};f.state().image={};f.state().draft={...f.im.detectionRegion};f.dialog.open=true;
  f.send('pointerdown',1,.2,.3);f.send('pointermove',1,.6,.8);f.send('pointerdown',2,.7,.7);f.send('pointerup',order[0],.6,.8);f.send('pointerup',order[1],.7,.7);f.send('pointerup',1,.6,.8);
  assert.deepEqual(JSON.parse(JSON.stringify(f.state().draft)),f.im.detectionRegion);assert.equal(JSON.stringify(f.im),before);assert.equal(f.env.history,0);assert.equal(f.saves(),0);
});
test('region editor ignores stale async image load after project replacement',async()=>{
  const f=regionUi();f.env.imageCache.clear();let resolve;f.env.loadImage=()=>new Promise(done=>resolve=done);
  const opening=f.env.openDetectionRegion();assert.equal(f.dialog.open,true);f.env.P={images:[]};resolve({late:true});await opening;
  assert.equal(f.state().image,null);assert.equal(f.env.imageCache.has('photo'),false);assert.equal(f.env.history,0);assert.equal(f.saves(),0);
});
test('region Save supports exact Undo and Redo with autosave on each transition',()=>{
  const f=regionUi(),env=f.env;env.P.title='Project';env.P.settings={};env.activeCategoryId='a';env.history=[];env.future=[];env.structuredClone=structuredClone;env.cancelMarkerInteraction=()=>{};env.resetReviewSelection=()=>{};env.scheduleSave=()=>{env.saved=(env.saved||0)+1};env.renderStorageSoon=()=>{};
  vm.runInContext(section('function cloneLight()','function dataUrlBytes('),env);
  f.state().owner={project:f.project,image:f.im,dataUrl:'pixels'};f.state().image={};f.state().draft={x:.2,y:.2,w:.3,h:.4};f.dialog.open=true;
  env.saveDetectionRegion();assert.equal(env.history.length,1);assert.equal(f.im.completed,false);assert.deepEqual(JSON.parse(JSON.stringify(f.im.detectionRegion)),{x:.2,y:.2,w:.3,h:.4});
  env.undo();assert.equal(f.im.completed,true);assert.deepEqual(JSON.parse(JSON.stringify(f.im.detectionRegion)),{x:.1,y:.2,w:.3,h:.4});
  env.redo();assert.equal(f.im.completed,false);assert.deepEqual(JSON.parse(JSON.stringify(f.im.detectionRegion)),{x:.2,y:.2,w:.3,h:.4});assert.equal(env.saved,3);
});
test('viewer import and draft normalization retain valid regions and reject malformed ones',()=>{
  const env={Number,Math,Set,Date,structuredClone,atob,MAX_IMAGES:30,MAX_PROJECT_BYTES:220*1024*1024,MAX_FILE_BYTES:35*1024*1024,COLORS:['#d15c52'],id:()=> 'new',t:()=> 'type',defaultSettings:()=>({draftCompression:{},viewerCompression:{}}),defaultAdjust:()=>({brightness:100,contrast:100,grayscale:0,rotation:0})};
  vm.createContext(env);vm.runInContext(section('// REGION:CORE:BEGIN','// REGION:CORE:END')+section('function normalizeProject(', 'function cloneLight('),env);
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZHcAAAAASUVORK5CYII=';
  const region={x:.2,y:.3,w:.4,h:.5},project={app:'image-counter',schemaVersion:4,categories:[{id:'a'}],images:[{id:'photo',name:'p.png',dataUrl:png,width:1,height:1,markers:[],detectionRegion:region}]};
  for(const viewer of [false,true]){const normalized=env.normalizeProject(JSON.parse(JSON.stringify(project)),{viewer});assert.deepEqual(JSON.parse(JSON.stringify(normalized.images[0].detectionRegion)),region)}
  const legacy=JSON.parse(JSON.stringify(project));delete legacy.images[0].detectionRegion;assert.equal(Object.hasOwn(env.normalizeProject(legacy,{viewer:true}).images[0],'detectionRegion'),false);
  for(const invalid of [{x:.8,y:.3,w:.3,h:.5},{x:'0.2',y:.3,w:.4,h:.5},{x:.2,y:.3,w:0,h:.5}]){const bad=JSON.parse(JSON.stringify(project));bad.images[0].detectionRegion=invalid;assert.throws(()=>env.normalizeProject(bad,{viewer:true}),/invalidProject/)}
});
