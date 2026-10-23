const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||path.join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing production region ${a}`);return source.slice(i,j)}
const plain=x=>JSON.parse(JSON.stringify(x));
const markers=[{id:'a',shape:'rect',categoryId:'one',x:.15,y:.2,w:.2,h:.2,order:1,createdAt:123,needsReview:true,autoPending:true},{id:'b',shape:'point',categoryId:'two',x:.7,y:.6,order:2,createdAt:456,needsReview:false},{id:'hidden',shape:'point',categoryId:'hidden',x:.5,y:.5,order:3,needsReview:true}];
function fixture(rotation=0,width=1200,height=800){
  const handlers={},nodes=new Map(),attrs=new Map();let saves=0,toast;
  const node=()=>({hidden:false,disabled:false,inert:false,tagName:'BODY',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){attrs.set(k,v)},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),closest:()=>null,addEventListener:(k,fn)=>handlers[k]=fn});
  const c={structuredClone,Date,Math,Set,Map,console,P:{title:'Review',updatedAt:1,categories:[{id:'one',visible:true},{id:'two',visible:true},{id:'hidden',visible:false}],settings:{markersVisible:true,markerSize:28},images:[{id:'photo',dataUrl:'pixels',width,height,name:'Photo',note:'Keep',completed:true,adjustments:{rotation},markers:structuredClone(markers),detectionChecks:[{categoryId:'one',detectedAt:800,reviewed:false}]}]},activeImageId:'photo',activeCategoryId:'one',selectedMarkerId:null,mode:'review',view:{zoom:1.7,panX:21,panY:-17},pointers:new Map(),gesture:null,interaction:null,draftRect:null,history:[],future:[{redo:'keep'}],lastMarkerId:null,lastMarkerAt:0,wrap:node(),canvas:node(),$:k=>{if(!nodes.has(k))nodes.set(k,node());return nodes.get(k)},document:{activeElement:node(),querySelector:()=>null},quickDetectionBusy:()=>false,t:(k,v)=>k+JSON.stringify(v||{}),Toast:{show(...a){toast=a}},scheduleSave(){saves++},renderStorageSoon(){},renderAll(){},renderCanvas(){},setTranslatedLabel(){}};
  c.P.images.push({...structuredClone(c.P.images[0]),id:'other',dataUrl:'other'});c.wrap.setPointerCapture=()=>{};
  vm.createContext(c);vm.runInContext(section('function activeImage()','function normalizeProject(')+section('function cloneLight()','function dataUrlBytes(')+section('function displayDims(','function drawBaseImage(')+section('function markerRectScreen(','function drawGuide(')+section('function hitMarker(','function positionMarkerPop(')+section('// REVIEW:BEGIN','// REVIEW:END')+section('function pointerDown(','function toggleSelectedReview(')+section('function setMode(','function syncCatDock('),c);
  const send=(kind,x,y,id=1)=>handlers[kind]({pointerId:id,clientX:x,clientY:y});
  const point=(x,y)=>c.originalToScreen(x,y);const tap=(x,y)=>{const p=point(x,y);send('pointerdown',p.x,p.y);send('pointerup',p.x,p.y)};
  const selected=()=>[...c.reviewSelectionIds()].sort();
  return{c,nodes,handlers,point,send,tap,selected,saves:()=>saves,toast:()=>toast};
}
for(const rot of [0,90,180,270])for(const [w,h]of [[1200,800],[800,1200]])test(`review tap/drag including rectangle corners preserves data at ${rot} degrees ${w}x${h}`,()=>{
  const f=fixture(rot,w,h),{c}=f,before=JSON.stringify(c.P);f.tap(.25,.3);assert.deepEqual(f.selected(),['a']);
  for(const [x,y]of [[.25,.3],[.15,.2],[.35,.4],[.7,.6]]){const p=f.point(x,y),v={...c.view};f.send('pointerdown',p.x,p.y);f.send('pointermove',p.x+30,p.y+20);f.send('pointerup',p.x+30,p.y+20);assert.ok(Math.abs(c.view.panX-v.panX-30)<1e-9);assert.ok(Math.abs(c.view.panY-v.panY-20)<1e-9)}
  f.tap(.92,.92);assert.deepEqual(f.selected(),[]);assert.equal(JSON.stringify(c.P),before);assert.equal(c.history.length,0);assert.equal(f.saves(),0);
});
test('multiple taps toggle visible markers and range adds only centers from all visible types',()=>{
  const f=fixture(),{c}=f;c.setReviewKind('multiple');f.tap(.25,.3);f.tap(.7,.6);assert.deepEqual(f.selected(),['a','b']);f.tap(.25,.3);assert.deepEqual(f.selected(),['b']);
  c.setReviewKind('range');const p=f.point(.1,.1),q=f.point(.55,.55);f.send('pointerdown',p.x,p.y);f.send('pointermove',q.x,q.y);f.send('pointerup',q.x,q.y);assert.deepEqual(f.selected(),['a','b']);
  c.clearReviewSelection();const edge=f.point(.15,.2);f.send('pointerdown',edge.x-15,edge.y-15);f.send('pointermove',edge.x+5,edge.y+5);f.send('pointerup',edge.x+5,edge.y+5);assert.deepEqual(f.selected(),[],'overlap without the center is excluded');
});
for(const rot of [90,270])test(`range uses displayed centers after rotation ${rot} and zoom`,()=>{const f=fixture(rot,800,1200);f.c.setReviewKind('range');const p=f.point(.25,.3);f.send('pointerdown',p.x-20,p.y-20);f.send('pointermove',p.x+20,p.y+20);f.send('pointerup',p.x+20,p.y+20);assert.deepEqual(f.selected(),['a'])});
for(const cancel of ['pointercancel','lostpointercapture','pinch'])test(`${cancel} abandons range and pending taps, preserves previous selection, ignores late release`,()=>{
  const f=fixture(),{c}=f;f.tap(.7,.6);c.setReviewKind('range');const before=JSON.stringify(c.P),p=f.point(.25,.3);f.send('pointerdown',p.x-30,p.y-30,1);f.send('pointermove',p.x+30,p.y+30,1);
  if(cancel==='pinch'){f.send('pointerdown',600,400,2);f.send('pointerdown',650,450,3);f.send('pointerup',600,400,2);f.send('pointerup',650,450,3)}else f.send(cancel,p.x,p.y,1);
  f.send('pointerup',p.x+30,p.y+30,1);assert.deepEqual(f.selected(),['b']);assert.equal(JSON.stringify(c.P),before);assert.equal(f.saves(),0);
});
test('bulk delete is one exact history/autosave transaction with safe toast Undo and Redo',()=>{
  const f=fixture(),{c}=f;c.setReviewKind('multiple');f.tap(.25,.3);f.tap(.7,.6);const before=plain(c.P);c.deleteReviewSelection();
  assert.deepEqual(c.P.images[0].markers.map(m=>m.id),['hidden']);assert.equal(c.P.images[0].completed,false);assert.deepEqual(plain(c.P.images[0].detectionChecks),before.images[0].detectionChecks);assert.deepEqual(plain(c.P.images[1]),before.images[1]);assert.equal(c.history.length,1);assert.equal(f.saves(),1);assert.deepEqual(f.selected(),[]);
  f.toast()[2]();assert.deepEqual(plain(c.P.images),before.images);assert.deepEqual(plain(c.P.categories),before.categories);c.redo();assert.deepEqual(c.P.images[0].markers.map(m=>m.id),['hidden']);assert.equal(c.history.length,1);
});
for(const change of ['project','photo','pixels','hidden','global','mode','undo'])test(`selection cannot survive ${change} ownership or visibility boundary`,()=>{
  const f=fixture(),{c}=f;f.tap(.25,.3);if(change==='project')c.P=structuredClone(c.P);if(change==='photo')c.activeImageId='other';if(change==='pixels')c.P.images[0].dataUrl='replacement';if(change==='hidden')c.P.categories[0].visible=false;if(change==='global')c.P.settings.markersVisible=false;if(change==='mode')c.setMode('point');if(change==='undo'){c.pushHistory();c.undo()}
  const before=JSON.stringify(c.P),n=c.history.length;c.deleteReviewSelection();assert.equal(JSON.stringify(c.P),before);assert.equal(c.history.length,n);assert.deepEqual(f.selected(),[]);
});
test('stale toast cannot undo a newer edit or another project',()=>{const f=fixture(),{c}=f;f.tap(.25,.3);c.deleteReviewSelection();const undo=f.toast()[2];c.pushHistory();c.P.images[0].note='newer';const before=JSON.stringify(c.P);undo();assert.equal(JSON.stringify(c.P),before)});
test('Edit explicitly selects the matching edit mode and preserves only the one marker',()=>{const f=fixture(),{c}=f;f.tap(.25,.3);c.editReviewMarker();assert.equal(c.mode,'rect');assert.equal(c.selectedMarkerId,'a');assert.deepEqual(f.selected(),[]);assert.equal(c.history.length,0);c.setMode('review');f.tap(.7,.6);c.editReviewMarker();assert.equal(c.mode,'point');assert.equal(c.selectedMarkerId,'b')});
test('empty, hidden, dialog and busy selections never delete data or clear redo',()=>{for(const guard of ['empty','dialog','busy','inert']){const f=fixture(),{c}=f;if(guard!=='empty')f.tap(.25,.3);if(guard==='dialog')c.document.querySelector=()=>({});if(guard==='busy')c.quickDetectionBusy=()=>true;if(guard==='inert')c.$('#workspace').inert=true;const before=JSON.stringify(c.P);c.deleteReviewSelection();assert.equal(JSON.stringify(c.P),before);assert.equal(c.future.length,1);assert.equal(f.saves(),0)}});
test('dragging away and returning to the start never selects a marker',()=>{const f=fixture(),p=f.point(.25,.3);f.send('pointerdown',p.x,p.y);f.send('pointermove',p.x+30,p.y+30);f.send('pointerup',p.x,p.y);assert.deepEqual(f.selected(),[]);assert.equal(f.saves(),0)});
for(const kind of ['single','multiple'])for(const end of ['pointercancel','lostpointercapture'])test(`${kind} ${end} preserves existing selection and abandons the pending tap`,()=>{const f=fixture(),{c}=f;f.tap(.7,.6);c.setReviewKind(kind);const p=f.point(.25,.3);f.send('pointerdown',p.x,p.y);f.send(end,p.x,p.y);f.send('pointerup',p.x,p.y);assert.deepEqual(f.selected(),['b']);assert.equal(f.saves(),0)});
test('keyboard Delete and Escape use review selection and respect focus, dialogs, hidden state and busy guards',()=>{
  for(const guard of ['none','input','textarea','select','button','contenteditable','dialog','busy','inert','hidden']){
    const f=fixture(),{c}=f;let keydown,prevented=0;c.document.addEventListener=(type,fn)=>{if(type==='keydown')keydown=fn};vm.runInContext(section('// EDITOR:KEYBOARD:BEGIN','// EDITOR:KEYBOARD:END'),c);f.tap(.25,.3);
    if(['input','textarea','select','button','contenteditable'].includes(guard)){c.document.activeElement.tagName=guard.toUpperCase();c.document.activeElement.isContentEditable=guard==='contenteditable'}
    if(guard==='dialog')c.document.querySelector=()=>({});if(guard==='busy')c.quickDetectionBusy=()=>true;if(guard==='inert')c.$('#workspace').inert=true;if(guard==='hidden')c.P.settings.markersVisible=false;
    keydown({key:'Delete',preventDefault(){prevented++}});assert.equal(c.P.images[0].markers.length,guard==='none'?2:3);assert.equal(prevented,guard==='none'?1:0);
    if(guard==='none'){f.tap(.7,.6);keydown({key:'Escape',preventDefault(){}});assert.deepEqual(f.selected(),[]);assert.equal(c.P.images[0].markers.length,2)}
  }
});
test('successful quick detection enters review even for zero or partially cancelled batches, stale work does not',()=>{
  for(const phase of ['done','cancelled','error','changed'])for(const committed of [false,true]){
    const f=fixture(),{c}=f;c.mode='point';c.quickState={run:null};const run={project:c.P,historyStarted:committed,opener:'#quickCurrent'};c.quickState.run=run;vm.runInContext(section('function finishQuickDetection(','async function startQuickDetection('),c);c.finishQuickDetection(run,phase);assert.equal(c.mode,committed&&phase!=='changed'?'review':'point');assert.equal(c.history.length,0);
  }
});
test('dialog apply enters review only when it adds markers and keeps detection metadata',()=>{
  const f=fixture(),{c}=f;c.mode='point';c.id=()=> 'applied';vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END'),c);const owner={project:c.P,imageId:'photo',dataUrl:'pixels',categoryId:'one'};
  assert.equal(c.applyAutoCandidates(owner,[{x:.8,y:.1,w:.1,h:.1,score:.9}],'one'),1);assert.equal(c.mode,'review');assert.equal(c.history.length,1);assert.equal(c.P.images[0].markers.at(-1).needsReview,false);assert.equal(c.P.images[0].markers.at(-1).autoPending,undefined);
});
test('review deletion remains available after a modal renders the same selection and closes',()=>{const f=fixture(),{c}=f;f.tap(.25,.3);let modal=true;c.document.querySelector=()=>modal?{}:null;c.renderModes();modal=false;assert.equal(c.$('#reviewDelete').disabled,false);c.deleteReviewSelection();assert.equal(c.P.images[0].markers.length,2)});
test('selection-clear translation does not replace the existing marker-review-flag label',()=>{const c={};vm.createContext(c);vm.runInContext(section('const I18N=','let lang='),c);assert.equal(vm.runInContext('I18N.en.reviewClear',c),'Clear review');assert.equal(vm.runInContext('I18N.ja.reviewClear',c),'要確認を解除');assert.equal(vm.runInContext('I18N.en.reviewClearSelection',c),'Clear selection')});
