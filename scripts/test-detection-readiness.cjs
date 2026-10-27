const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Reuse the scoped workflow fixture: it loads the real quick detection and
// workspace code, including translations, from each source/release variant.
const harness=fs.readFileSync(path.join(__dirname,'test-scoped-review.cjs'),'utf8').split("test('filtered run snapshots")[0];
const context={require,__dirname,process,console,structuredClone,Buffer};
vm.runInNewContext(harness+'\nglobalThis.makeFixture=fixture;',context);
function fixture(){
  const f=context.makeFixture(),{c}=f;
  c.activeCategory=()=>c.P?.categories.find(category=>category.id===c.activeCategoryId)||null;
  c.autoCurrentReference=()=>c.activeCategory()?.detectionReference||null;
  c.addFiles=function(){};c.addFiles.pending=0;
  c.autoBuiltinModel=c.autoState.model;
  c.openAutoDetection=()=>{f.calls.setup=(f.calls.setup||0)+1};
  c.quickProcessImages=async run=>{f.calls.detection=(f.calls.detection||[]).concat(run)};
  for(const selector of ['#workspaceDetect','#autoOpen','#quickCurrent','#quickAll','#quickFiltered'])f.$(selector).click=function(){if(!this.disabled)return this.onclick?.()};
  c.renderAll();return f;
}
function blocked($,selectors){
  for(const selector of selectors){assert.equal($(selector).disabled,true,selector+' must be disabled');assert.ok($(selector).title?.trim(),selector+' must explain why it is unavailable');}
}
function visibleReason($){
  assert.equal($('#workspaceDetectionHint').hidden,false);
  assert.ok($('#workspaceDetectionHint').textContent.trim(),'photo view needs a visible explanation');
  assert.ok($('#quickReferenceHint').textContent.trim(),'inspector needs a visible explanation');
}

test('photo import start synchronizes toolbar detection without waiting for a full workspace render',()=>{
  const {c,$}=fixture();assert.equal($('#workspaceDetect').disabled,false);
  c.addFiles.pending=1;c.quickSync();
  blocked($,['#workspaceDetect','#quickCurrent','#quickAll','#quickFiltered']);visibleReason($);
  assert.equal($('#workspaceDetectionHint').textContent,c.t('quickWaitingPhotos'));
});

test('photo import completion releases a toolbar disabled during the import',()=>{
  const {c,$}=fixture();c.addFiles.pending=1;c.renderAll();assert.equal($('#workspaceDetect').disabled,true);
  c.addFiles.pending=0;c.quickSync();
  for(const selector of ['#workspaceDetect','#quickCurrent','#quickAll','#quickFiltered'])assert.equal($(selector).disabled,false,selector);
  assert.equal($('#workspaceDetectionHint').hidden,true);
});

test('photo import completion releases the panel opener without a resize or unrelated full render',()=>{
  const {c,$}=fixture();c.setWorkspaceOpen(false);c.addFiles.pending=1;c.renderAll();
  assert.equal($('#mobileReviewToggle').disabled,true);assert.equal($('#workspaceInspector').hidden,true);
  c.addFiles.pending=0;c.quickSync();
  assert.equal($('#mobileReviewToggle').disabled,false,'the import finally refresh must release panel navigation too');
  $('#mobileReviewToggle').onclick();assert.equal($('#workspaceInspector').hidden,false);
});

test('missing reference offers actionable setup for the selected category instead of a disabled detection dead end',()=>{
  const {c,$,category}=fixture();category.name='Small steel tubes';delete category.detectionReference;c.quickSync();
  blocked($,['#quickAll','#quickFiltered']);
  for(const selector of ['#workspaceDetect','#quickCurrent']){assert.equal($(selector).disabled,false,selector);assert.equal($(selector).textContent,c.t('quickSetup'));}
  assert.equal($('#autoOpen').disabled,false);assert.equal($('#autoOpen').textContent,c.t('quickAddExamples'));
  assert.ok($('#quickReferenceHint').textContent.includes(category.name));
});

test('switching categories and changing references refreshes the action labels without modifying work',()=>{
  const {c,$,category}=fixture(),reference=category.detectionReference;
  c.P.categories.push({id:'b',name:'Washers'});c.activeCategoryId='b';c.quickSync();
  blocked($,['#quickAll']);assert.ok($('#quickReferenceHint').textContent.includes('Washers'));
  assert.equal($('#workspaceDetect').disabled,false);assert.equal($('#workspaceDetect').textContent,c.t('quickSetup'));
  c.activeCategoryId=category.id;c.quickSync();assert.equal($('#workspaceDetect').textContent,c.t('quickCurrent'));
  delete category.detectionReference;c.quickSync();assert.equal($('#workspaceDetect').textContent,c.t('quickSetup'));
  category.detectionReference=reference;const before=JSON.stringify(c.P);c.quickSync();
  assert.equal($('#workspaceDetect').disabled,false);assert.equal($('#workspaceDetectionHint').hidden,true);
  assert.equal($('#autoOpen').textContent,c.t('quickEditExamples'));
  assert.equal(JSON.stringify(c.P),before);assert.equal(c.history.length,0);
  assert.ok($('#quickReferenceHint').textContent.includes(c.t('quickReference',{type:category.name,count:reference.examples.length})));
});

for(const selector of ['#workspaceDetect','#quickCurrent'])test(`${selector} opens the example editor when unregistered and directly detects after registration`,async()=>{
  const {c,$,category,calls}=fixture(),reference=category.detectionReference;delete category.detectionReference;c.renderAll();
  await $(selector).click();assert.equal(calls.setup,1);assert.equal(calls.detection,undefined);assert.equal(c.history.length,0);
  category.detectionReference=reference;c.renderAll();await $(selector).click();
  assert.equal(calls.setup,1);assert.equal(calls.detection.length,1);assert.equal(calls.detection[0].category,category);
  assert.deepEqual(Array.from(calls.detection[0].targets,image=>image.id),['one']);
});

for(const reason of ['import','busy','no-photo'])test(`unregistered setup remains unavailable during ${reason}`,()=>{
  const {c,$,category}=fixture();delete category.detectionReference;
  if(reason==='import')c.addFiles.pending=1;
  if(reason==='busy')c.quickState.run={category,targets:c.P.images,rows:[],index:0,added:0};
  if(reason==='no-photo'){c.P.images=[];c.activeImageId=null;}
  c.renderAll();blocked($,['#workspaceDetect','#quickCurrent','#quickAll','#quickFiltered']);
  assert.equal($('#autoOpen').disabled,true);assert.equal($('#autoThreshold').disabled,reason!=='no-photo');
});

test('all-photo and filtered detection never turn missing references into a partial run',async()=>{
  const {c,category,calls}=fixture();delete category.detectionReference;
  await c.startQuickDetection(true);await c.startQuickDetection('filtered');
  assert.equal(calls.detection,undefined);assert.equal(calls.setup,undefined);assert.equal(c.history.length,0);
});

test('detection uses the built-in CPU model automatically while honoring the visible sensitivity choice',async()=>{
  const {c,$,calls}=fixture();$('#autoBackend').value='webgpu';$('#autoPrecision').value='fp16';$('#autoThreshold').value='0.25';
  await c.startQuickDetection(false);const run=calls.detection[0];
  assert.equal(run.model,c.autoBuiltinModel);assert.equal(run.backend,'wasm');assert.equal(run.precision,'fp32');assert.equal(run.threshold,.25);
});

test('empty filtered results explain only the list restriction while current and all remain ready',()=>{
  const {c,$}=fixture();c.matchingPhotos=()=>[];c.quickSync();
  blocked($,['#quickFiltered']);
  for(const selector of ['#workspaceDetect','#quickCurrent','#quickAll'])assert.equal($(selector).disabled,false,selector);
  assert.equal($('#workspaceDetectionHint').hidden,true);
});

test('running detection explains unavailable actions consistently in photo view and inspector',async()=>{
  const {c,$}=fixture();c.quickProcessImages=async()=>{};await c.startQuickDetection(false);
  blocked($,['#workspaceDetect','#quickCurrent','#quickAll','#quickFiltered']);visibleReason($);
  assert.notEqual($('#workspaceDetectionHint').textContent,c.t('quickNeedReferenceShort',{type:c.activeCategory().name}));
  assert.equal($('#workspace').inert,true);
});

test('no photos disables all detection actions with a visible reason',()=>{
  const {c,$}=fixture();c.P.images=[];c.activeImageId=null;c.quickSync();
  blocked($,['#workspaceDetect','#quickCurrent','#quickAll','#quickFiltered']);visibleReason($);
});
