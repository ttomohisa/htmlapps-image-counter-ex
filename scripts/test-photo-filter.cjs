const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||path.join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing production region ${a}`);return source.slice(i,j)}
const plain=value=>JSON.parse(JSON.stringify(value));
const marker=(id,needsReview=false)=>({id,shape:'point',categoryId:'a',x:.2,y:.3,order:1,needsReview});
const photo=(id,extra={})=>({id,name:id+'.png',dataUrl:id,width:800,height:600,note:'keep',completed:false,adjustments:{brightness:100,contrast:100,grayscale:0,rotation:0},markers:[],...extra});
const photos=()=>[photo('fresh'),photo('manual',{markers:[marker('m')]}),photo('zero',{completed:true,detectionChecks:[{categoryId:'a',detectedAt:100,reviewed:false}]}),photo('done',{completed:true}),photo('flag',{markers:[marker('f',true)]})];
function fixture(images=photos()){
  const nodes=new Map(),decodes=[],messages=[];let saves=0,keyHandler;
  const element=(tag='div')=>{const el={tagName:tag.toUpperCase(),children:[],style:{},dataset:{},hidden:false,inert:false,disabled:false,value:'',attributes:{},classList:{remove(){},toggle(){},add(){}},append(...items){this.children.push(...items)},setAttribute(k,v){this.attributes[k]=v},querySelector(sel){return this.children.find(x=>x.className===sel.slice(1))||element()},focus(){c.document.activeElement=this}};Object.defineProperty(el,'textContent',{get(){return this._text||''},set(v){this._text=String(v);this.children=[]}});return el};
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector)};
  const select=$('#photoFilter');select.tagName='SELECT';select.options=['all','undetected','working','review','complete'].map(value=>Object.assign(element('option'),{value}));
  const c={structuredClone,Date,Math,Set,Map,console,P:{title:'Filter',updatedAt:123,categories:[{id:'a',name:'A',visible:true,color:'#16624f'}],settings:{markersVisible:true},images:structuredClone(images)},activeImageId:images[0].id,activeCategoryId:'a',selectedMarkerId:'keep-selection',mode:'point',history:[],future:[{keep:'redo'}],pointers:new Map(),gesture:null,interaction:null,draftRect:null,view:{zoom:2,panX:5,panY:8},imageCache:new Map(),draftImageCache:new Map(),wrap:element(),$,document:{body:element('body'),activeElement:element('body'),createElement:element,querySelector:()=>null,addEventListener:(name,fn)=>{if(name==='keydown')keyHandler=fn}},quickDetectionBusy:()=>false,renderStorageSoon(){},renderCanvas(){},renderModes(){},resizeCanvas(){},fitView(){},resetReviewSelection(){c.selectedMarkerId=null},scheduleSave(){saves++},Toast:{show:(...args)=>messages.push(args)},Confirm:{ask:async()=>true},loadImage:dataUrl=>new Promise((resolve,reject)=>decodes.push({dataUrl,resolve,reject})),requestAnimationFrame:fn=>fn(),retireRestoreOffer(){},lang:'en'};
  vm.createContext(c);vm.runInContext([
    section('const I18N=','let lang='),section('function t(','function applyTranslatedAttributes('),
    section('function activeImage()','function normalizeProject('),section('function cloneLight()','function dataUrlBytes('),
    section('function imageReviewCount(','function drawReviewBadge('),section('function cancelMarkerInteraction(','function pointerCancel('),
    section('async function switchImage(','function displayDims('),section('function renderImages(','function renderSummary('),
    section('function renderPhotoReview()','function updateAdjustment('),section('function csvEsc(','function markersCsv('),section('function markersCsv(','function drawImageAdjusted('),
    section('// EDITOR:KEYBOARD:BEGIN','// EDITOR:KEYBOARD:END'),
    source.includes('// PHOTO:FILTER:BEGIN')?section('// PHOTO:FILTER:BEGIN','// PHOTO:FILTER:END'):'',
    source.includes('// PHOTO:FILTER:BINDINGS:BEGIN')?section('// PHOTO:FILTER:BINDINGS:BEGIN','// PHOTO:FILTER:BINDINGS:END'):'',
  ].join('\n'),c);
  c.renderAll=()=>c.renderImages();
  const ready=()=>assert.equal(typeof c.setPhotoFilter,'function','production filter action is implemented');
  const set=value=>{ready();select.value=value;select.onchange({target:select})};
  const names=()=>$('#imageStrip').children.filter(x=>x.className?.includes('thumb')).map(b=>b.children[1].children[0].textContent);
  return{c,$,nodes,set,names,select,decodes,messages,saves:()=>saves,key:key=>{let prevented=false;keyHandler({key,preventDefault(){prevented=true}});return prevented}};
}

test('status filter uses review-first priority and all-project option counts without altering data or selection',()=>{
  const f=fixture(),{c,$}=f,before=JSON.stringify(c.P),view=plain(c.view);f.set('review');
  assert.deepEqual(f.names(),['zero.png','flag.png']);assert.deepEqual(f.select.options.map(o=>o.textContent),['All (5)','Undetected (1)','In progress (1)','Needs review (2)','Complete (1)']);
  assert.equal($('#photoFilterCount').textContent,'2/5 photos');assert.equal($('#photoFilterReset').hidden,false);assert.equal($('#photoFilterOutside').hidden,false);assert.equal(c.activeImageId,'fresh');assert.equal(c.selectedMarkerId,'keep-selection');assert.deepEqual(plain(c.view),view);
  assert.equal(JSON.stringify(c.P),before);assert.equal(c.history.length,0);assert.equal(c.future.length,1);assert.equal(f.saves(),0);
  f.set('complete');assert.deepEqual(f.names(),['done.png']);f.set('working');assert.deepEqual(f.names(),['manual.png']);f.set('undetected');assert.deepEqual(f.names(),['fresh.png']);assert.equal($('#photoFilterOutside').hidden,true);
});

test('empty filter keeps the canvas owner and reset restores the full list and native focus',()=>{
  const f=fixture([photo('only')]),{c,$}=f;f.set('complete');assert.deepEqual(f.names(),[]);assert.equal($('#photoFilterEmpty').hidden,false);assert.equal(c.activeImageId,'only');assert.equal($('#prevImage').disabled,true);assert.equal($('#nextImage').disabled,true);
  c.document.activeElement=$('#photoFilterReset');$('#photoFilterReset').onclick();assert.deepEqual(f.names(),['only.png']);assert.equal(f.select.value,'all');assert.equal($('#photoFilterReset').hidden,true);assert.equal($('#photoFilterEmpty').hidden,true);assert.equal(c.document.activeElement,f.select);
});

test('filtered arrows find nearest matches before and after an excluded current photo, without wrapping',async()=>{
  const f=fixture(),{c,$}=f;c.activeImageId='done';f.set('review');assert.equal($('#prevImage').disabled,false);assert.equal($('#nextImage').disabled,false);
  c.imageCache.set('zero',{});await $('#prevImage').onclick();assert.equal(c.activeImageId,'zero');assert.equal($('#prevImage').disabled,true);
  c.imageCache.set('flag',{});await $('#nextImage').onclick();assert.equal(c.activeImageId,'flag');assert.equal($('#nextImage').disabled,true);await $('#nextImage').onclick();assert.equal(c.activeImageId,'flag');
  assert.equal(c.currentIndex(),4);assert.equal(c.totalMarkers(),2);assert.equal(c.completedCount(),2);
});

test('keyboard navigation shares filtering and retains native focused controls and modal/busy/inert guards',async()=>{
  for(const guard of ['none','INPUT','TEXTAREA','SELECT','BUTTON','editable','modal','busy','inert']){
    const f=fixture(),{c}=f;c.activeImageId='manual';f.set('review');c.imageCache.set('zero',{});
    if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(guard))c.document.activeElement.tagName=guard;
    if(guard==='editable')c.document.activeElement.isContentEditable=true;if(guard==='modal')c.document.querySelector=()=>({});if(guard==='busy')c.quickDetectionBusy=()=>true;if(guard==='inert')c.$('#workspace').inert=true;
    assert.equal(f.key('ArrowRight'),guard==='none');assert.equal(c.activeImageId,guard==='none'?'zero':'manual');
    if(guard!=='none'&&!['INPUT','TEXTAREA','SELECT','BUTTON','editable'].includes(guard)){f.set('complete');assert.equal(f.select.value,'review');await c.navigateFilteredPhoto('flag');assert.equal(c.activeImageId,'manual')}
  }
});

test('review/completion edits and Undo/Redo update matches and counts without resetting the live filter',async()=>{
  const f=fixture(),{c,$}=f;c.activeImageId='zero';f.set('review');c.markImageReviewed();assert.deepEqual(f.names(),['flag.png']);assert.equal($('#photoFilterOutside').hidden,false);assert.equal(f.select.value,'review');assert.equal(f.select.options[4].textContent,'Complete (2)');
  c.undo();assert.deepEqual(f.names(),['zero.png','flag.png']);c.redo();assert.deepEqual(f.names(),['flag.png']);
  c.P.images.push(photo('new'));c.renderImages();assert.equal(f.select.value,'review');assert.equal($('#photoFilterCount').textContent,'1/6 photos');
  c.P.images=c.P.images.filter(im=>im.id!=='manual');c.renderImages();assert.equal(f.select.value,'review');assert.equal($('#photoFilterCount').textContent,'1/5 photos');
  c.lang='ja';c.renderImages();assert.equal(f.select.value,'review');assert.deepEqual(f.select.options.map(o=>o.textContent),['すべて (5)','未検出 (2)','作業中 (0)','要確認 (1)','完了 (2)']);assert.equal($('#photoFilterCount').textContent,'1/5枚');
});

test('project replacement resets transient filtering even if image IDs are reused',()=>{
  const f=fixture(),{c,$}=f;f.set('review');c.P=structuredClone(c.P);c.renderImages();assert.equal(f.select.value,'all');assert.equal(f.names().length,5);assert.equal($('#photoFilterReset').hidden,true);assert.equal($('#photoFilterOutside').hidden,true);
  assert.equal('photoFilter' in c.P,false);assert.equal('photoFilter' in c.cloneLight(),false);assert.deepEqual(plain(c.cloneLight().images).map(im=>im.id),['fresh','manual','zero','done','flag']);
});

test('changing filter cancels pending geometry and late releases while preserving completed selection/history',()=>{
  const f=fixture(),{c}=f;c.activeImageId='manual';const im=c.activeImage();im.completed=true;const before=c.cloneLight();im.markers[0].x=.8;im.completed=false;c.interaction={type:'marker',moved:true,marker:im.markers[0],before};c.pointers.set(1,{});c.gesture={};
  f.set('complete');assert.equal(im.markers[0].x,.2);assert.equal(im.completed,true);assert.equal(c.interaction,null);assert.equal(c.pointers.size,0);assert.equal(c.gesture,null);assert.equal(c.selectedMarkerId,'keep-selection');assert.equal(c.history.length,0);assert.equal(c.future.length,1);assert.equal(f.saves(),0);assert.deepEqual(f.names(),['manual.png','done.png']);
});

test('a changed filter rejects its pending decode, including changing away and back, but leaves authoritative navigation valid',async()=>{
  const f=fixture(),{c}=f;f.set('review');const pending=c.navigateFilteredPhoto('zero');f.set('complete');f.set('review');f.decodes[0].resolve({});assert.equal(await pending,false);assert.equal(c.activeImageId,'fresh');
  const authoritative=c.switchImage('done');f.set('undetected');f.decodes[1].resolve({});assert.equal(await authoritative,true);assert.equal(c.activeImageId,'done');assert.equal(c.$('#photoFilterOutside').hidden,false);
});

test('a status change rejects a pending target; latest decode failure retains current photo and a stale failure stays quiet',async()=>{
  const f=fixture(),{c}=f;f.set('review');const changed=c.navigateFilteredPhoto('zero');c.P.images[2].detectionChecks[0].reviewed=true;c.renderImages();f.decodes[0].resolve({});assert.equal(await changed,false);assert.equal(c.activeImageId,'fresh');
  const stale=c.navigateFilteredPhoto('flag');f.set('complete');f.decodes[1].reject(new Error('bad'));assert.equal(await stale,false);assert.equal(f.messages.length,0);
  const failed=c.navigateFilteredPhoto('done');f.decodes[2].reject(new Error('bad'));assert.equal(await failed,false);assert.equal(c.activeImageId,'fresh');assert.equal(f.messages.length,1);
});

test('rapid filtered thumbnail requests commit only the newest decoded photo and reject detached stale thumbnails',async()=>{
  const f=fixture(),{c,$}=f;f.set('review');const buttons=[...$('#imageStrip').children],first=buttons[0].onclick(),last=buttons[1].onclick();f.decodes[1].resolve({});assert.equal(await last,true);f.decodes[0].resolve({});assert.equal(await first,false);assert.equal(c.activeImageId,'flag');
  f.set('complete');const count=f.decodes.length;await buttons[0].onclick();assert.equal(f.decodes.length,count);assert.equal(c.activeImageId,'flag');
});

test('pending filtered navigation cannot commit after a modal, inference, inert workspace or new project takes ownership',async()=>{
  for(const boundary of ['modal','busy','inert','project']){
    const f=fixture(),{c}=f;f.set('review');const pending=c.navigateFilteredPhoto('zero');
    if(boundary==='modal')c.document.querySelector=()=>({});if(boundary==='busy')c.quickDetectionBusy=()=>true;if(boundary==='inert')c.$('#workspace').inert=true;if(boundary==='project')c.P=structuredClone(c.P);
    f.decodes[0].resolve({});assert.equal(await pending,false,boundary);assert.equal(c.activeImageId,'fresh');assert.equal(c.imageCache.has('zero'),false);
  }
});

test('draft and viewer serialization retain every photo and omit the active view filter',async()=>{
  const f=fixture(),{c}=f;c.P.settings.draftCompression={enabled:false};c.P.settings.viewerCompression={enabled:false};f.set('review');
  vm.runInContext(section('async function makeDraft(','async function saveDraft(')+section('function safeJson(','function csvEsc(')+section('async function compressProjectForViewer(','async function saveViewer('),c);
  const draft=await c.makeDraft(),viewer=c.viewerHtml(await c.compressProjectForViewer(c.P)),exported=JSON.parse(viewer.match(/<script id="imageCounterProject"[^>]*>(.*?)<\/script>/s)[1]);
  for(const project of [draft,exported]){assert.deepEqual(plain(project.images).map(im=>im.id),['fresh','manual','zero','done','flag']);assert.equal('photoFilter' in project,false);assert.equal('photoFilter' in project.settings,false);assert.equal(project.images[2].detectionChecks[0].reviewed,false)}
  assert.equal(f.select.value,'review');assert.equal(f.saves(),0);
});

test('same-project file addition and deletion preserve the filter while retaining their ordinary current-photo behavior',async()=>{
  const f=fixture(),{c}=f;f.set('review');c.MAX_IMAGES=30;c.MAX_PROJECT_BYTES=1e9;c.projectBytes=()=>0;c.fileToRecord=async()=>photo('added');c.showWorkspace=()=>{};c.imageCache.set('added',{});
  vm.runInContext(section('async function addFiles(','async function switchImage('),c);
  const added=c.addFiles([{type:'image/png'}]);await new Promise(setImmediate);assert.equal(f.decodes[0].dataUrl,'added');f.decodes[0].resolve({});await added;
  assert.equal(c.activeImageId,'added');assert.equal(f.select.value,'review');assert.deepEqual(f.names(),['zero.png','flag.png']);assert.equal(c.$('#photoFilterCount').textContent,'2/6 photos');
  c.imageCache.set('flag',{});await c.removeActiveImage();assert.equal(c.activeImageId,'flag');assert.equal(f.select.value,'review');assert.equal(c.$('#photoFilterCount').textContent,'2/5 photos');
});

test('detect-all captures all photos even when the list is empty and zero-result detection refreshes status counts',async()=>{
  const f=fixture([photo('one'),photo('two')]),{c}=f;f.set('complete');
  Object.assign(c,{autoState:{model:{size:1},busy:false},quickState:{run:null},quickImportsBusy:()=>false,autoCurrentReference:()=>c.P.categories[0].detectionReference,Worker:class{},OffscreenCanvas:class{},createImageBitmap(){},setMode(){}});c.P.categories[0].detectionReference={examples:[{}]};c.Toast.hide=()=>{};c.$('#quickProgress').scrollIntoView=()=>{};
  vm.runInContext(section('// AUTO:CORE:BEGIN','// AUTO:CORE:END')+section('function nextOrder(','function addPoint(')+section('// QUICK:CORE:BEGIN','async function quickProcessImages(')+section('async function startQuickDetection(',"$('#quickMode').onchange="),c);
  let captured;c.quickProcessImages=async run=>{captured=run;c.quickCommitResult(run,run.targets[0],[])};await c.startQuickDetection(true);
  assert.deepEqual(Array.from(captured.targets,im=>im.id),['one','two']);assert.deepEqual(f.names(),[]);assert.equal(f.select.options[3].textContent,'Needs review (1)');assert.equal(f.select.value,'complete');
  c.quickState.run=null;c.undo();assert.equal(f.select.options[3].textContent,'Needs review (0)');assert.equal(f.select.value,'complete');c.redo();assert.equal(f.select.options[3].textContent,'Needs review (1)');
});

test('next unfinished and review-next still traverse the full project; CSV includes every photo',async()=>{
  const f=fixture(),{c}=f;f.set('complete');c.imageCache.set('manual',{});c.nextIncomplete();assert.equal(c.activeImageId,'manual');
  c.imageCache.set('zero',{});await c.reviewAndNext();assert.equal(c.activeImageId,'zero');assert.equal(f.select.value,'complete');assert.equal(c.P.images[1].completed,true);
  const csv=c.summaryCsv();for(const id of ['fresh','manual','zero','done','flag'])assert.ok(csv.includes(id+'.png'),id);assert.ok(c.markersCsv().includes('manual.png'));assert.ok(c.markersCsv().includes('flag.png'));
});

test('filter is labelled, keyboard accessible and wraps above the strip with bilingual help and scope text',()=>{
  assert.match(source,/<label[^>]+for="photoFilter"/);assert.match(source,/<select[^>]+id="photoFilter"[^>]+aria-describedby="photoFilterHint"/);
  assert.ok(source.indexOf('id="photoFilter"')<source.indexOf('id="imageStrip"'));assert.match(source,/\.photo-filter\{[^}]*flex-wrap:wrap/);assert.match(source,/\.photo-filter select\{[^}]*max-width:100%/);assert.match(source,/<[^>]+id="photoFilterCount"[^>]+aria-live="polite"/);
  const f=fixture();for(const lang of ['en','ja']){f.c.lang=lang;for(const key of ['photoFilterLabel','photoFilterAll','photoFilterReset','photoFilterOutside','photoFilterEmpty','photoFilterHint','photoFilterHelp'])assert.notEqual(f.c.t(key),key)}
  assert.ok(section('<!-- APP:HELP:BEGIN -->','<!-- APP:HELP:END -->').includes('data-i18n="photoFilterHelp"'));
});
