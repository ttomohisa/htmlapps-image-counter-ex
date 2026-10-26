const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||path.join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing production section ${a}`);return source.slice(i,j)}
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
  const nodes=new Map(),events={},calls={save:0,focus:[],navigation:[],review:0},category={id:'a',name:'A',detectionReference:{dataUrl:'ref',examples:[{x:.1,y:.1,w:.1,h:.1}]}},images=['one','two','three'].map(id=>({id,name:id,dataUrl:id,width:100,height:100,markers:[],detectionChecks:[],completed:false,adjustments:{rotation:0}}));let c;
  function element(id){return{id,hidden:false,disabled:false,inert:false,open:false,value:'',textContent:'',style:{},dataset:{},attributes:{},children:[],classList:{values:new Set(),toggle(k,v){if(v)this.values.add(k);else this.values.delete(k)},contains(k){return this.values.has(k)}},setAttribute(k,v){this.attributes[k]=String(v)},getAttribute(k){return this.attributes[k]},focus(){c.document.activeElement=this;calls.focus.push(id)},scrollIntoView(){},append(n){this.children.push(n)},contains(node){return this===node},getClientRects(){return this.hidden?[]:[this.getBoundingClientRect()]},getBoundingClientRect(){return{top:10,bottom:50,left:10,right:100,width:90,height:40}},addEventListener(k,fn){this[k]=fn},closest(){return null}}}
  const $=sel=>{if(!nodes.has(sel))nodes.set(sel,element(sel.slice(1)));return nodes.get(sel)};
  c={console,structuredClone,Date,Math,Set,Map,Number,Array,Error,P:{images,categories:[category],settings:{}},activeImageId:'one',activeCategoryId:'a',mode:'point',history:[],future:[],selectedMarkerId:null,lastMarkerId:null,lastMarkerAt:0,pointers:new Map(),gesture:null,quickState:{run:null,report:null},autoState:{model:{size:1},busy:false},$,document:{body:element('body'),documentElement:{clientWidth:390,clientHeight:844},activeElement:element('body'),querySelector:()=>null,createElement:()=>element('li')},getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:'visible'}),matchMedia:()=>({matches:true}),addEventListener:(k,fn)=>events[k]=fn,requestAnimationFrame:fn=>fn(),Worker:class{},OffscreenCanvas:class{},createImageBitmap(){},id:(()=>{let n=0;return()=>String(++n)})(),scheduleSave(){calls.save++},renderStorageSoon(){},renderCanvas(){},cancelMarkerInteraction(){},resetReviewSelection(){},Toast:{show(){},hide(){}},lang:'en'};
  c.activeImage=()=>c.P.images.find(im=>im.id===c.activeImageId);c.activeCategory=()=>category;c.autoCurrentReference=()=>category.detectionReference;c.matchingPhotos=()=>c.P.images.filter(im=>!im.detectionChecks?.some(check=>!check.reviewed));c.setMode=m=>c.mode=m;
  c.photoFilterTarget=direction=>direction<0?images[0]:images[2];c.navigateFilteredPhoto=async id=>{calls.navigation.push(id);c.activeImageId=id};c.reviewAndNext=async()=>{calls.review++;};
  vm.createContext(c);vm.runInContext(section('const I18N=','let lang=')+section('function t(','function applyTranslatedAttributes(')+section('// AUTO:CORE:BEGIN','// AUTO:CORE:END')+section('function cloneLight()','function dataUrlBytes(')+section('function nextOrder(','function addPoint(')+section('// QUICK:CORE:BEGIN','// QUICK:CORE:END')+section('function quickDetectionBusy()','// QUICK:UI:END'),c);
  c.renderAll=()=>{c.renderQuickDetection();if(c.renderMobileReview)c.renderMobileReview()};
  if(source.includes('// MOBILE:REVIEW:BEGIN'))vm.runInContext(section('// MOBILE:REVIEW:BEGIN','// MOBILE:REVIEW:END'),c);
  return{c,$,nodes,images,category,calls,events};
}

test('filtered run snapshots only matching photos and retains them as detection updates status',async()=>{
  const {c,images}=fixture();images[1].detectionChecks=[{categoryId:'a',reviewed:false,detectedAt:1}];const visited=[];
  c.quickInferImage=async(run,im)=>{visited.push(im.id);return{candidates:[],truncated:0}};
  await c.startQuickDetection('filtered');assert.deepEqual(visited,['one','three']);assert.deepEqual(Array.from(c.quickState.report.targets,im=>im.id),['one','three']);assert.equal(c.quickState.report.opener,'#quickFiltered');assert.equal(c.quickState.report.rows.length,2);assert.equal(c.history.length,1);assert.equal(c.matchingPhotos().length,0);
  c.undo();assert.equal(c.P.images[0].detectionChecks.length,0);assert.equal(c.P.images[2].detectionChecks.length,0);assert.equal(c.P.images[1].detectionChecks[0].reviewed,false);
  c.redo();assert.equal(c.P.images[0].detectionChecks[0].reviewed,false);assert.equal(c.P.images[2].detectionChecks[0].reviewed,false);
});

test('filtered selection may exclude current photo without changing targets or the source ownership set',async()=>{
  const {c,images}=fixture();c.activeImageId='two';images[1].detectionChecks=[{categoryId:'a',reviewed:false}];let captured;c.quickProcessImages=async run=>captured=run;
  await c.startQuickDetection('filtered');assert.deepEqual(Array.from(captured.targets,im=>im.id),['one','three']);assert.deepEqual(Array.from(captured.sources,s=>s.image.id),['one','two','three']);assert.equal(c.activeImageId,'two');
});

test('empty filtered list cannot start work or invalidate history',async()=>{
  const {c,images}=fixture();images.forEach(im=>im.detectionChecks=[{categoryId:'a',reviewed:false}]);let runs=0;c.quickProcessImages=async()=>runs++;c.future.push({keep:true});
  await c.startQuickDetection('filtered');assert.equal(runs,0);assert.equal(c.quickState.run,null);assert.equal(c.history.length,0);assert.equal(c.future.length,1);
});

test('current and all actions keep their original target scopes regardless of the filter',async()=>{
  for(const scope of [false,true]){const{c}=fixture();c.matchingPhotos=()=>[];c.activeImageId='two';let captured;c.quickProcessImages=async run=>captured=run;await c.startQuickDetection(scope);assert.deepEqual(Array.from(captured.targets,im=>im.id),scope?['one','two','three']:['two']);assert.equal(captured.opener,scope?'#quickAll':'#quickCurrent')}
});

test('filtered control shows list count and requires references, photos, and idle ownership',()=>{
  const{c,$,images,category}=fixture();c.renderQuickDetection();assert.match($('#quickFiltered').textContent,/3/);assert.equal($('#quickFiltered').disabled,false);
  images[0].detectionChecks=[{categoryId:'a',reviewed:false}];c.renderQuickDetection();assert.match($('#quickFiltered').textContent,/2/);
  c.matchingPhotos=()=>[];c.renderQuickDetection();assert.equal($('#quickFiltered').disabled,true);c.matchingPhotos=()=>images;category.detectionReference=null;c.renderQuickDetection();assert.equal($('#quickFiltered').disabled,true);
});

test('stopping a filtered run preserves earlier commits and one Undo restores them',async()=>{
  const{c,images}=fixture();images[1].detectionChecks=[{categoryId:'a',reviewed:false}];let resolveSecond,secondStarted;const started=new Promise(resolve=>secondStarted=resolve);
  c.quickInferImage=async(run,im)=>{if(im.id==='one')return{candidates:[{x:.1,y:.1,w:.2,h:.2,score:.8}],truncated:0};secondStarted();return new Promise(resolve=>resolveSecond=resolve)};
  const pending=c.startQuickDetection('filtered');await started;c.finishQuickDetection(c.quickState.run,'cancelled');resolveSecond({candidates:[{x:.5,y:.5,w:.2,h:.2,score:.8}],truncated:0});await pending;
  assert.equal(images[0].markers.length,1);assert.equal(images[2].markers.length,0);assert.equal(c.history.length,1);c.undo();assert.equal(c.P.images[0].markers.length,0);assert.equal(c.P.images[0].detectionChecks.length,0);
});

test('mobile Review disclosure is transient, project-owned and preserved across ordinary renders',()=>{
  const{c,$}=fixture();assert.equal(typeof c.renderMobileReview,'function','mobile review presentation exists');const before=plain(c.P);c.mode='review';c.renderMobileReview();assert.equal($('#mobileReviewToggle').getAttribute('aria-expanded'),'false');
  $('#mobileReviewToggle').onclick();assert.equal($('#mobileReviewToggle').getAttribute('aria-expanded'),'true');c.renderMobileReview();c.lang='ja';c.renderMobileReview();assert.equal($('#mobileReviewToggle').getAttribute('aria-expanded'),'true');
  c.mode='rect';c.renderMobileReview();c.mode='review';c.renderMobileReview();assert.equal($('#mobileReviewToggle').getAttribute('aria-expanded'),'true');
  c.P=structuredClone(c.P);c.renderMobileReview();assert.equal($('#mobileReviewToggle').getAttribute('aria-expanded'),'false');assert.deepEqual(plain(c.P),before);assert.equal(c.history.length,0);
});

test('compact mobile previous/next uses filtered navigation and review completion delegates existing action',async()=>{
  const{c,$,calls}=fixture();assert.equal(typeof c.renderMobileReview,'function');c.mode='review';c.renderMobileReview();await $('#mobPrev').onclick();await $('#mobNext').onclick();await $('#mobReviewNext').onclick({currentTarget:$('#mobReviewNext')});assert.deepEqual(calls.navigation,['one','three']);assert.equal(calls.review,1);
});

test('mobile arrows integrate with the real object-returning photo filter and skip excluded photos',async()=>{
  const{c,$,calls}=fixture();c.currentIndex=()=>c.P.images.findIndex(im=>im.id===c.activeImageId);c.photoStatus=im=>im.id==='two'?'complete':'review';c.renderImages=()=>{};c.switchImage=async iid=>{calls.navigation.push(iid);c.activeImageId=iid;return true};
  vm.runInContext(section('// PHOTO:FILTER:BEGIN','// PHOTO:FILTER:END'),c);c.setPhotoFilter('review');c.mode='review';c.renderMobileReview();
  await $('#mobNext').onclick();assert.deepEqual(calls.navigation,['three']);assert.equal(c.activeImageId,'three');await $('#mobNext').onclick();assert.equal(calls.navigation.length,1);await $('#mobPrev').onclick();assert.deepEqual(calls.navigation,['three','one']);
});

test('mobile disclosure never accepts actions during a modal or running detection',()=>{
  for(const boundary of ['modal','busy','inert']){const{c,$}=fixture();assert.equal(typeof c.renderMobileReview,'function');c.mode='review';c.renderMobileReview();if(boundary==='modal')c.document.querySelector=()=>({});if(boundary==='busy')c.quickState.run={};if(boundary==='inert')$('#workspace').inert=true;$('#mobileReviewToggle').onclick();assert.equal($('#mobileReviewToggle').getAttribute('aria-expanded'),'false',boundary)}
});

test('resize repairs a newly hidden settings focus but preserves visible controls and modal ownership',()=>{
  for(const boundary of ['hidden','visible','modal']){const{c,$,events}=fixture();c.mode='review';c.renderMobileReview();const opener=$('#autoOpen');opener.hidden=boundary!=='visible';c.document.activeElement=opener;if(boundary==='modal')c.document.querySelector=()=>({});events.resize();assert.equal(c.document.activeElement,boundary==='hidden'?$('#mobileReviewToggle'):opener)}
  const{c,$,events}=fixture();c.mode='review';c.renderMobileReview();c.document.activeElement=$('#mobileReviewToggle');c.matchMedia=()=>({matches:false});events.resize();assert.equal(c.document.activeElement,$('#mobileReviewToggle'));
});

test('finishing detection focuses a visible mobile action instead of a collapsed opener, without stealing newer focus',async()=>{
  for(const newer of [false,true]){const{c,$}=fixture();let run;c.quickProcessImages=async r=>run=r;await c.startQuickDetection(false);run.historyStarted=true;$('#quickCurrent').hidden=true;const other=$('#other');c.document.activeElement=newer?other:$('#quickProgress');c.finishQuickDetection(run,'done');assert.equal(c.mode,'review');assert.equal(c.document.activeElement,newer?other:$('#mobileReviewToggle'))}
});

test('mobile completion uses the same transaction and returns focus to its own button after photo decoding',async()=>{
  const{c,$,images}=fixture();c.mode='review';c.currentIndex=()=>c.P.images.findIndex(im=>im.id===c.activeImageId);c.imageReviewCount=im=>im?.markers.filter(m=>m.needsReview).length||0;c.imageHasPendingReview=im=>!!im?.detectionChecks?.some(x=>!x.reviewed);c.photoStatus=im=>im?.completed?'complete':'undetected';
  vm.runInContext(section('function renderPhotoReview()','async function toggleComplete()'),c);let release;c.switchImage=async id=>{await new Promise(resolve=>release=resolve);c.activeImageId=id;c.document.activeElement=c.document.body};c.document.activeElement=$('#mobReviewNext');
  const pending=c.reviewAndNext({currentTarget:$('#mobReviewNext')});assert.equal(images[0].completed,true);assert.equal(c.history.length,1);release();await pending;assert.equal(c.activeImageId,'two');assert.equal(c.document.activeElement,$('#mobReviewNext'));c.undo();assert.equal(c.P.images[0].completed,false);
});

test('dismissing a completed report returns to a visible mobile control when its original launcher is folded',async()=>{
  const{c,$}=fixture();let run;c.quickProcessImages=async r=>run=r;await c.startQuickDetection('filtered');run.historyStarted=true;c.finishQuickDetection(run,'done');$('#quickFiltered').hidden=true;c.document.activeElement=$('#quickDismiss');$('#quickDismiss').onclick();assert.equal(c.quickState.report,null);assert.equal($('#quickProgress').hidden,true);assert.equal(c.document.activeElement,$('#mobileReviewToggle'));
});
