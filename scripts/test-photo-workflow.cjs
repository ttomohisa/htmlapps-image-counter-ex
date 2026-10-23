const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||path.join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`Missing ${a}`);return source.slice(i,j)}
const copy=value=>JSON.parse(JSON.stringify(value));
const marker=(id,categoryId='a',extra={})=>({id,shape:'rect',categoryId,x:.1,y:.2,w:.15,h:.2,order:1,needsReview:true,autoPending:true,...extra});
const check=(categoryId='a',reviewed=false)=>({categoryId,detectedAt:1720000000000,reviewed});
const photo=(id,extra={})=>({id,name:id+'.png',dataUrl:id,width:1200,height:800,note:'keep',completed:false,adjustments:{brightness:100,contrast:100,grayscale:0,rotation:0},markers:[],...extra});
function setup(images=[photo('one')]){
  const nodes=new Map(),saved=[],messages=[],navigated=[];
  const element=()=>({children:[],hidden:false,disabled:false,style:{},dataset:{},textContent:'',classList:{toggle(){}},append(...items){this.children.push(...items)},setAttribute(){}});
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector)};
  const c={structuredClone,Date,Math,P:{title:'Workflow',updatedAt:123,categories:[{id:'a',name:'A',color:'#d15c52',visible:true},{id:'b',name:'B',color:'#16624f',visible:false}],settings:{},images:structuredClone(images)},activeImageId:images[0].id,activeCategoryId:'a',selectedMarkerId:null,history:[],future:[],busy:false,$,document:{createElement:element},Toast:{show:(...args)=>messages.push(args)},Confirm:{ask:async()=>true},t:(key,values={})=>key+Object.entries(values).map(([name,value])=>` ${name}=${value}`).join(''),setTranslatedLabel(){},renderStorageSoon(){},renderAll(){},scheduleSave:()=>saved.push(copy(c.P)),quickDetectionBusy:()=>c.busy,switchImage:id=>{navigated.push(id);c.activeImageId=id}};
  vm.createContext(c);vm.runInContext([
    section('function activeImage()','function normalizeProject('),
    section('function cloneLight()','function dataUrlBytes('),
    section('function imageReviewCount(','function drawReviewBadge('),
    section('function toggleSelectedReview()','function setMode('),
    section('function renderPhotoReview()','async function removeActiveImage('),
    section('function openTypes(','// Only repair native close focus'),
    section("$('#markerCat').onchange=","$('#projectTitle').oninput="),
  ].join('\n'),c);
  return{c,nodes,saved,messages,navigated};
}

test('photo status distinguishes untouched, manual, pending zero-result and completed photos with review taking priority',()=>{
  const {c}=setup();assert.equal(typeof c.photoStatus,'function','photo status must be derived from saved photo data');
  for(const [im,want,count] of [
    [photo('untouched'),'undetected',0],
    [photo('manual',{markers:[marker('manual','a',{needsReview:false,autoPending:undefined})]}),'working',0],
    [photo('zero',{detectionChecks:[check()]}),'review',0],
    [photo('reviewed-zero',{detectionChecks:[check('a',true)]}),'working',0],
    [photo('done',{completed:true}),'complete',0],
    [photo('inconsistent-done',{completed:true,detectionChecks:[check()]}),'review',0],
    [photo('flagged',{completed:true,markers:[marker('hidden','b'),marker('visible')]}),'review',2],
  ]){assert.equal(c.photoStatus(im),want,im.id);assert.equal(c.imageReviewCount(im),count,im.id)}
});

test('reviewing a photo clears flags and replacement provenance across types in one reversible save',()=>{
  const {c,saved}=setup([photo('one',{markers:[marker('one-a'),marker('one-b','b')],detectionChecks:[check(),check('b')]}),photo('two',{markers:[marker('two-a')]})]);
  const before=copy(c.P.images);c.markImageReviewed();
  assert.deepEqual(copy(c.P.images[0].markers).map(m=>[m.needsReview,m.autoPending]),[[false,undefined],[false,undefined]]);
  assert.deepEqual(copy(c.P.images[0].detectionChecks).map(x=>x.reviewed),[true,true]);
  assert.equal(c.P.images[0].completed,false);assert.deepEqual(copy(c.P.images[1]),before[1]);
  assert.equal(c.history.length,1);assert.equal(saved.length,1);
  const reviewed=copy(c.P.images);c.undo();assert.deepEqual(copy(c.P.images),before);c.redo();assert.deepEqual(copy(c.P.images),reviewed);
});

test('zero-result review remains actionable and ordinary completion waits for it',async()=>{
  const {c,nodes,saved,messages}=setup([photo('one',{detectionChecks:[check()]})]);
  c.renderPhotoReview();assert.equal(nodes.get('#photoReviewBar').hidden,false);assert.equal(nodes.get('#reviewPhoto').disabled,false);
  await c.toggleComplete();assert.equal(c.P.images[0].completed,false);assert.equal(c.history.length,0);assert.equal(saved.length,0);assert.ok(messages.length);
  c.markImageReviewed();assert.equal(c.P.images[0].detectionChecks[0].reviewed,true);assert.equal(c.history.length,1);
  await c.toggleComplete();assert.equal(c.P.images[0].completed,true);
});

test('review-and-next completes once, skips completed photos, wraps, and Undo restores pending checks',async()=>{
  const {c,saved,navigated}=setup([photo('one'),photo('two',{completed:true}),photo('three',{markers:[marker('review')],detectionChecks:[check()]})]);
  c.activeImageId='three';const before=copy(c.P.images);
  assert.equal(typeof c.reviewAndNext,'function','review-and-next must be available');await c.reviewAndNext();
  assert.equal(c.P.images[2].completed,true);assert.equal(c.P.images[2].markers[0].needsReview,false);assert.equal(c.P.images[2].markers[0].autoPending,undefined);
  assert.equal(c.P.images[2].detectionChecks[0].reviewed,true);assert.deepEqual(navigated,['one']);assert.equal(c.activeImageId,'one');
  assert.deepEqual(copy(c.P.images.slice(0,2)),before.slice(0,2));assert.equal(c.history.length,1);assert.equal(saved.length,1);
  const reviewed=copy(c.P.images);c.undo();assert.deepEqual(copy(c.P.images),before);c.redo();assert.deepEqual(copy(c.P.images),reviewed);
});

test('review-and-next on the final pending zero-result photo stays put and announces completion',async()=>{
  const {c,navigated,messages}=setup([photo('one',{completed:true}),photo('two',{detectionChecks:[check()]})]);c.activeImageId='two';
  assert.equal(typeof c.reviewAndNext,'function');await c.reviewAndNext();
  assert.equal(c.P.images[1].completed,true);assert.equal(c.P.images[1].detectionChecks[0].reviewed,true);assert.deepEqual(navigated,[]);assert.equal(c.activeImageId,'two');
  assert.ok(messages.some(args=>args[0].includes('noIncomplete')),'last-photo action must announce that all photos are complete');
  assert.equal(c.history.length,1);await c.reviewAndNext();assert.equal(c.history.length,1,'repeated completed action must not add history');
});

test('review actions during inference and already-reviewed no-op actions preserve history and redo',async()=>{
  const {c,saved,navigated}=setup([photo('one',{markers:[marker('review')],detectionChecks:[check()]})]);
  c.busy=true;c.future.push({sentinel:'redo'});const before=JSON.stringify(c.P);
  c.markImageReviewed();assert.equal(typeof c.reviewAndNext,'function');await c.reviewAndNext();
  assert.equal(JSON.stringify(c.P),before);assert.equal(c.history.length,0);assert.equal(c.future.length,1);assert.equal(saved.length,0);assert.deepEqual(navigated,[]);
  c.busy=false;c.P.images[0].markers=[];c.P.images[0].detectionChecks=[check('a',true)];c.markImageReviewed();
  assert.equal(c.history.length,0);assert.equal(c.future.length,1);assert.equal(saved.length,0);
});

test('manually clearing then reflagging an automatic result never re-enables replacement',()=>{
  const {c}=setup([photo('one',{markers:[marker('review')]})]);c.selectedMarkerId='review';
  c.toggleSelectedReview();assert.equal(c.P.images[0].markers[0].needsReview,false);assert.equal(c.P.images[0].markers[0].autoPending,undefined);
  c.toggleSelectedReview();assert.equal(c.P.images[0].markers[0].needsReview,true);assert.equal(c.P.images[0].markers[0].autoPending,undefined);
  c.undo();c.undo();assert.equal(c.P.images[0].markers[0].autoPending,true);
});

for(const movedFocus of [false,true])test(`review-and-next restores keyboard focus after decoding without stealing newer focus (${movedFocus})`,async()=>{
  const {c,nodes}=setup([photo('one'),photo('two')]);c.renderPhotoReview();
  const button=nodes.get('#reviewNext'),other={id:'new-owner'};let focused=0;
  c.document.body={id:'body'};c.document.activeElement=button;button.focus=()=>{focused++;c.document.activeElement=button};
  c.renderAll=()=>{c.renderPhotoReview();if(button.disabled)c.document.activeElement=c.document.body};
  c.switchImage=async id=>{await Promise.resolve();c.activeImageId=id;c.renderAll();if(movedFocus)c.document.activeElement=other;return true};
  await c.reviewAndNext();assert.equal(focused,movedFocus?0:1);assert.equal(c.document.activeElement,movedFocus?other:button);
});

test('manual type changes protect automatic results and remain reversible',()=>{
  const {c,nodes,saved}=setup([photo('one',{markers:[marker('review')]})]);c.selectedMarkerId='review';
  nodes.get('#markerCat').onchange({target:{value:'b'}});
  assert.equal(c.P.images[0].markers[0].categoryId,'b');assert.equal(c.P.images[0].markers[0].autoPending,undefined);assert.equal(c.P.images[0].markers[0].needsReview,true);
  assert.equal(c.history.length,1);assert.equal(saved.length,1);c.undo();assert.equal(c.P.images[0].markers[0].categoryId,'a');assert.equal(c.P.images[0].markers[0].autoPending,true);
});

test('deleting a type removes orphan detection checks and protects reassigned automatic results',async()=>{
  const {c,nodes}=setup([photo('one',{markers:[marker('review')],detectionChecks:[check(),check('b',true)]})]);
  const before=copy(c.P.images);c.renderCatDialog();await nodes.get('#catList').children[0].children[3].onclick();
  assert.deepEqual(copy(c.P.images[0].detectionChecks),[check('b',true)]);
  assert.equal(c.P.images[0].markers[0].categoryId,'b');assert.equal(c.P.images[0].markers[0].autoPending,undefined);
  assert.equal(c.history.length,1);c.undo();assert.deepEqual(copy(c.P.images),before);assert.equal(c.P.categories.length,2);
});
