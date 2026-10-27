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

test('missing reference identifies the selected category and explains setup beside both detection surfaces',()=>{
  const {c,$,category}=fixture();category.name='Small steel tubes';delete category.detectionReference;c.quickSync();
  blocked($,['#workspaceDetect','#quickCurrent','#quickAll','#quickFiltered']);visibleReason($);
  assert.equal($('#workspaceDetectionHint').textContent,c.t('quickNeedReferenceShort',{type:category.name}));
  assert.equal($('#quickReferenceHint').textContent,c.t('quickNeedReference',{type:category.name}));
  assert.ok($('#workspaceDetectionHint').textContent.includes(category.name));
  assert.ok($('#quickReferenceHint').textContent.includes(category.name));
});

test('switching categories and unpinning or repinning refreshes availability without modifying work',()=>{
  const {c,$,category}=fixture(),reference=category.detectionReference;
  c.P.categories.push({id:'b',name:'Washers'});c.activeCategoryId='b';c.quickSync();
  blocked($,['#workspaceDetect','#quickCurrent','#quickAll']);assert.ok($('#quickReferenceHint').textContent.includes('Washers'));
  c.activeCategoryId=category.id;c.quickSync();assert.equal($('#workspaceDetect').disabled,false);
  delete category.detectionReference;c.quickSync();assert.equal($('#workspaceDetect').disabled,true);
  category.detectionReference=reference;const before=JSON.stringify(c.P);c.quickSync();
  assert.equal($('#workspaceDetect').disabled,false);assert.equal($('#workspaceDetectionHint').hidden,true);
  assert.equal(JSON.stringify(c.P),before);assert.equal(c.history.length,0);
  assert.ok($('#quickReferenceHint').textContent.includes(c.t('quickReference',{type:category.name,count:reference.examples.length})));
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
