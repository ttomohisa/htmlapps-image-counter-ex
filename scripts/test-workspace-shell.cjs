const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||require('node:path').join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function fixture(){const nodes=new Map(),events={},calls=[];let c;function node(id){const classes=new Set();return{id,hidden:false,disabled:false,inert:false,textContent:'',attributes:{},classList:{toggle(name,on){if(on===undefined)on=!classes.has(name);if(on)classes.add(name);else classes.delete(name);return on},contains:name=>classes.has(name)},setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},getClientRects(){return this.hidden?[]:[{}]},focus(){c.document.activeElement=this},contains(n){return n===this},addEventListener(k,f){this[k]=f}}}const $=s=>{if(!nodes.has(s))nodes.set(s,node(s));return nodes.get(s)};c={lang:'en',P:{images:[{}]},mode:'point',$,activeImage:()=>({}),matchMedia:()=>({matches:false}),quickDetectionBusy:()=>false,document:{body:node('body'),activeElement:null,querySelector:()=>null},getComputedStyle:()=>({visibility:'visible'}),cancelMarkerInteraction:()=>calls.push('cancel'),pointers:new Map([[1,{}]]),gesture:{},requestAnimationFrame:f=>f(),resizeCanvas:()=>calls.push('resize'),renderCanvas(){},addEventListener:(k,f)=>events[k]=f,t:k=>k,photoFilterTarget:()=>null,navigateFilteredPhoto(){},reviewAndNext(){}};c.document.activeElement=c.document.body;vm.createContext(c);vm.runInContext(source.slice(source.indexOf('const I18N='),source.indexOf('let lang='))+source.slice(source.indexOf('function t('),source.indexOf('function applyTranslatedAttributes(')),c);const a=source.indexOf('// MOBILE:REVIEW:BEGIN'),b=source.indexOf('// MOBILE:REVIEW:END');vm.runInContext(source.slice(a,b),c);return{c,$,events,calls}}
test('inspector state belongs to accepted project, survives modes and language without serializing',()=>{const{c,$}=fixture();assert.equal(typeof c.setWorkspacePanel,'function');const before=JSON.stringify(c.P);c.renderWorkspaceShell();c.setWorkspacePanel('detection');assert.equal($('#inspectorDetection').hidden,false);c.mode='review';c.renderWorkspaceShell();assert.equal($('#inspectorDetection').hidden,false);assert.equal(JSON.stringify(c.P),before);c.P={images:[{}]};c.renderWorkspaceShell();assert.equal($('#inspectorPhotos').hidden,false)});
test('layout transitions abandon gestures before geometry changes and cannot commit later',()=>{const{c,calls,events}=fixture();c.renderWorkspaceShell();c.setWorkspacePanel('project');assert.equal(calls[0],'cancel');assert.equal(c.pointers.size,0);assert.equal(c.gesture,null);calls.length=0;events.resize();assert.equal(calls[0],'cancel')});
test('busy and modal guards reject inspector changes; close repairs only hidden focus',()=>{const{c,$}=fixture();c.renderWorkspaceShell();c.quickDetectionBusy=()=>true;c.setWorkspacePanel('project');assert.equal($('#inspectorPhotos').hidden,false);c.quickDetectionBusy=()=>false;c.setWorkspacePanel('project');const input=$('#projectTitle');c.document.activeElement=input;input.hidden=true;c.setWorkspaceOpen(false);assert.equal(c.document.activeElement,$('#mobileReviewToggle'));c.document.activeElement=$('#other');c.setWorkspaceOpen(true);assert.equal(c.document.activeElement,$('#other'))});
test('cached canvas and detection progress remain unique and outside inspector',()=>{assert.equal((source.match(/id="canvasWrap"/g)||[]).length,1);assert.ok(source.indexOf('id="quickProgress"')<source.indexOf('id="workspace"'));assert.match(source,/id="workspaceInspector"/);assert.match(source,/id="workspaceDetect"/)});

// Reuse the counting harness to exercise real pending edits and late pointer releases.
const harness=fs.readFileSync(require('node:path').join(__dirname,'test-counting-workflow.cjs'),'utf8').split('for (const rotation of')[0];
const counting={require,__dirname,process,console,structuredClone,Buffer};vm.runInNewContext(harness+'\nglobalThis.makeFixture=fixture;',counting);
for(const mode of ['point','rect','review'])for(const transition of ['panel','resize'])test(`real ${mode} gesture is abandoned by ${transition}, including late release`,()=>{
 const f=counting.makeFixture(90,mode),c=f.c,before=JSON.stringify(c.P),events={},base=c.$;
 c.lang='en';c.t=k=>k;c.matchMedia=()=>({matches:false});c.document.body={};c.document.activeElement=c.document.body;c.getComputedStyle=()=>({visibility:'visible'});c.requestAnimationFrame=fn=>fn();c.resizeCanvas=()=>{};c.addEventListener=(k,fn)=>events[k]=fn;
 c.$=sel=>{const n=base(sel);n.setAttribute=()=>{};n.getClientRects=()=>n.hidden?[]:[{}];n.addEventListener=()=>{};n.classList.toggle=()=>{};return n};
 vm.runInContext(source.slice(source.indexOf('// MOBILE:REVIEW:BEGIN'),source.indexOf('// MOBILE:REVIEW:END')),c);c.renderWorkspaceShell();if(mode==='review')vm.runInContext("reviewSelection.kind='range'",c);
 f.send('pointerdown',.2,.2);f.send('pointermove',.5,.6);if(transition==='panel')c.setWorkspacePanel('project');else events.resize();f.send('pointerup',.5,.6);
 assert.equal(JSON.stringify(c.P),before);assert.equal(c.history.length,0);assert.equal(f.saves(),0);assert.equal(c.pointers.size,0);assert.equal(c.interaction,null);assert.equal(c.gesture,null);assert.equal(JSON.stringify(c.future),'[{"redo":"keep"}]');
});


test('mobile inspector opening and breakpoint repair choose its visible tab; newer focus is preserved',()=>{const{c,$,events}=fixture();c.matchMedia=()=>({matches:true});const viewer={inert:false};$('#canvasWrap').closest=()=>viewer;for(const id of ['#mobileReviewToggle','#canvasWrap','#workspaceDetect']){$(id).getClientRects=()=>viewer.inert?[]:[{}]};c.renderWorkspaceShell();c.document.activeElement=$('#mobileReviewToggle');c.setWorkspaceOpen(true);assert.equal(c.document.activeElement,$('#inspectorTabPhotos'));c.document.activeElement=$('#workspaceDetect');events.resize();assert.equal(c.document.activeElement,$('#inspectorTabPhotos'));c.document.activeElement=$('#other');events.resize();assert.equal(c.document.activeElement,$('#other'))});
test('live correction restores mobile photo before showing nonmodal dialog',()=>{const{c,$}=fixture();c.matchMedia=()=>({matches:true});c.renderAdjust=()=>{};let previewOpen=false;$('#adjustDlg').show=()=>{previewOpen=$('#workspaceInspector').hidden};c.renderWorkspaceShell();c.setWorkspacePanel('project');assert.equal(typeof c.openWorkspaceAdjust,'function');c.openWorkspaceAdjust();assert.equal(previewOpen,true)});
test('history and photo add controls retain translated accessible names',()=>{for(const id of ['undoBtn','redoBtn','addImagesBtn'])assert.match(source,new RegExp('<button id="'+id+'"[^>]+data-i18n-aria-label='))});

test('completed filtered run returns focus to tools when its launcher becomes disabled',()=>{const{c,$}=fixture();c.matchMedia=()=>({matches:true});c.renderWorkspaceShell();c.setWorkspacePanel('photos');const opener=$('#quickFiltered');opener.disabled=true;c.document.activeElement=c.document.body;c.focusMobileReviewTarget(opener);assert.equal(c.document.activeElement,$('#inspectorTabPhotos'));c.setWorkspaceOpen(false);c.document.activeElement=c.document.body;c.focusMobileReviewTarget(opener);assert.equal(c.document.activeElement,$('#mobileReviewToggle'))});

test('native dialog closing in mobile tools returns to visible inspector without stealing another owner',()=>{const{c,$}=fixture();c.matchMedia=()=>({matches:true});const viewer={inert:false};$('#canvasWrap').closest=()=>viewer;$('#mobileReviewToggle').getClientRects=()=>viewer.inert?[]:[{}];c.renderWorkspaceShell();c.setWorkspacePanel('detection');c.document.activeElement=c.document.body;$('#autoDlg').close();assert.equal(c.document.activeElement,$('#inspectorTabDetection'));c.document.activeElement=$('#other');$('#autoDlg').close();assert.equal(c.document.activeElement,$('#other'));c.lang='ja';c.renderWorkspaceShell();assert.equal($('#workspaceInspector').attributes['aria-label'],'写真と作業の設定');c.lang='en';c.renderWorkspaceShell();assert.equal($('#inspectorTabs').attributes['aria-label'],'Workspace tools')});

for(const [language,openLabel,closeLabel] of [['ja','パネルを開く','パネルを閉じる'],['en','Open panel','Hide panel']])test(`closing the inspector returns focus to its explicit ${language} opener and reopening preserves the selected panel`,()=>{
  const{c,$}=fixture();c.lang=language;c.renderWorkspaceShell();c.setWorkspacePanel('detection');
  const before=JSON.stringify(c.P),toggle=$('#mobileReviewToggle'),label=$('#workspacePanelLabel');
  assert.equal(label.textContent,closeLabel);assert.equal(toggle.getAttribute('aria-expanded'),'true');
  assert.equal(toggle.getAttribute('aria-label'),closeLabel);assert.equal(toggle.title,closeLabel);
  c.document.activeElement=$('#inspectorClose');$('#inspectorClose').onclick();
  assert.equal($('#workspaceInspector').hidden,true);assert.equal(c.document.activeElement,toggle);
  assert.equal(label.textContent,openLabel);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(toggle.getAttribute('aria-label'),openLabel);assert.equal(toggle.title,openLabel);
  toggle.onclick();
  assert.equal($('#workspaceInspector').hidden,false);assert.equal($('#inspectorDetection').hidden,false);
  assert.equal(label.textContent,closeLabel);assert.equal(JSON.stringify(c.P),before);
});

test('Escape from a panel tab returns keyboard focus to the visible opener, while an input retains Escape ownership',()=>{
  const{c,$,events}=fixture();c.renderWorkspaceShell();c.setWorkspacePanel('project');
  const tab=$('#inspectorTabProject');tab.getClientRects=()=>$('#workspaceInspector').hidden?[]:[{}];c.document.activeElement=tab;
  let prevented=0;events.keydown({key:'Escape',defaultPrevented:false,preventDefault(){prevented++}});
  assert.equal(prevented,1);assert.equal($('#workspaceInspector').hidden,true);assert.equal(c.document.activeElement,$('#mobileReviewToggle'));
  $('#mobileReviewToggle').onclick();const input=$('#projectTitle');input.matches=()=>true;c.document.activeElement=input;
  events.keydown({key:'Escape',defaultPrevented:false,preventDefault(){prevented++}});
  assert.equal(prevented,1);assert.equal($('#workspaceInspector').hidden,false);assert.equal(c.document.activeElement,input);
});

for(const guard of ['import','busy','modal','inert'])test(`panel close and reopen reject ${guard} without changing the selected panel or project`,()=>{
  const{c,$}=fixture();c.renderWorkspaceShell();c.setWorkspacePanel('detection');const before=JSON.stringify(c.P);
  function lock(on){if(guard==='import')c.quickImportsBusy=()=>on;if(guard==='busy')c.quickDetectionBusy=()=>on;if(guard==='modal')c.document.querySelector=()=>on?{}:null;if(guard==='inert')$('#workspace').inert=on}
  lock(true);$('#inspectorClose').onclick();assert.equal($('#workspaceInspector').hidden,false);
  lock(false);$('#inspectorClose').onclick();assert.equal($('#workspaceInspector').hidden,true);
  lock(true);$('#mobileReviewToggle').onclick();assert.equal($('#workspaceInspector').hidden,true);
  lock(false);$('#mobileReviewToggle').onclick();assert.equal($('#workspaceInspector').hidden,false);
  assert.equal($('#inspectorDetection').hidden,false);assert.equal(JSON.stringify(c.P),before);
});

test('the prominent action follows counting versus review mode without changing inspector state or saved work',()=>{
  const{c,$}=fixture();c.renderWorkspaceShell();c.setWorkspacePanel('project');const before=JSON.stringify(c.P);
  for(const mode of ['point','review','rect','pan','review']){
    c.mode=mode;c.renderWorkspaceShell();
    assert.equal($('#workspaceDetect').classList.contains('primary'),mode!=='review',mode+' detection priority');
    assert.equal($('#reviewNext').classList.contains('primary'),mode==='review',mode+' review priority');
    assert.equal($('#inspectorProject').hidden,false);assert.equal(JSON.stringify(c.P),before);
  }
});

test('the panel opener remains a named native button in the photo header and the redundant example launcher is removed',()=>{
  const head=source.slice(source.indexOf('<div class="viewer-head">'),source.indexOf('<div class="workspace-toolbar">'));
  assert.match(head,/<button id="mobileReviewToggle"[^>]*type="button"[^>]*aria-controls="workspaceInspector"/);
  assert.match(head,/id="workspacePanelLabel"/);
  assert.doesNotMatch(source,/id="workspaceSetup"|\$\('#workspaceSetup'\)/);
});

test('mobile return action follows the visible tools across modes, breakpoints and accepted work',()=>{
  const{c,$,events}=fixture();let mobile=false;c.matchMedia=()=>({matches:mobile});
  c.activeImage=()=>c.P?.images[0]||null;c.P.images[0].name='First photo.jpg';
  const original=JSON.stringify(c.P);c.renderWorkspaceShell();
  const action=$('#mobReturnPhoto'),bar=$('#mobileBar');
  assert.equal(action.hidden,true);assert.equal(bar.classList.contains('tools-open'),false);
  mobile=true;events.resize();
  assert.equal(action.hidden,false);assert.equal(bar.classList.contains('tools-open'),true);
  c.setWorkspaceOpen(false);assert.equal(action.hidden,true);assert.equal(bar.classList.contains('tools-open'),false);
  c.setWorkspacePanel('project');
  for(const mode of ['point','review','rect','pan']){c.mode=mode;c.renderWorkspaceShell();assert.equal(action.hidden,false);assert.equal(bar.classList.contains('tools-open'),true)}
  assert.equal(JSON.stringify(c.P),original);
  c.lang='ja';c.renderWorkspaceShell();assert.equal($('#mobReturnPhotoLabel').textContent,c.t('workspaceReturnPhoto'));assert.equal(action.getAttribute('aria-label'),c.t('workspaceReturnPhoto'));
  c.lang='en';c.renderWorkspaceShell();assert.equal($('#mobReturnPhotoLabel').textContent,c.t('workspaceReturnPhoto'));assert.equal(action.title,c.t('workspaceReturnPhoto'));
  c.P={images:[{name:'Next work.png'}]};c.renderWorkspaceShell();assert.equal(action.hidden,true);assert.equal(bar.classList.contains('tools-open'),false);
  c.setWorkspacePanel('photos');mobile=false;events.resize();assert.equal(action.hidden,true);assert.equal(bar.classList.contains('tools-open'),false);assert.equal($('#workspaceInspector').hidden,false);
});

test('project photo context tracks navigation and missing photos without touching work',()=>{
  const{c,$}=fixture();let current=0;c.P.images=[{name:'<photo & one>.png'},{name:'Two.jpg'}];c.activeImage=()=>c.P?.images[current]||null;
  const before=JSON.stringify(c.P);c.renderWorkspaceShell();c.setWorkspacePanel('project');
  assert.equal($('#inspectorPhotoName').textContent,'<photo & one>.png');assert.equal($('#inspectorPhotoName').title,'<photo & one>.png');
  current=1;c.renderWorkspaceShell();assert.equal($('#inspectorPhotoName').textContent,'Two.jpg');assert.equal($('#inspectorPhotoName').title,'Two.jpg');
  current=2;c.renderWorkspaceShell();assert.equal($('#inspectorPhotoName').textContent,'');assert.equal($('#inspectorPhotoName').title,'');assert.equal(JSON.stringify(c.P),before);
});

for(const guard of ['import','busy','modal','inert'])test(`mobile return action respects ${guard} and safely restores photo focus when released`,()=>{
  const{c,$,calls}=fixture();c.matchMedia=()=>({matches:true});c.renderWorkspaceShell();c.setWorkspacePanel('project');
  const action=$('#mobReturnPhoto'),before=JSON.stringify(c.P);assert.equal(typeof action.onclick,'function');
  function lock(on){if(guard==='import')c.quickImportsBusy=()=>on;if(guard==='busy')c.quickDetectionBusy=()=>on;if(guard==='modal')c.document.querySelector=()=>on?{}:null;if(guard==='inert')$('#workspace').inert=on}
  c.document.activeElement=action;calls.length=0;lock(true);action.onclick();
  assert.equal($('#workspaceInspector').hidden,false);assert.equal($('#inspectorProject').hidden,false);assert.equal(c.document.activeElement,action);assert.deepEqual(calls,[]);
  lock(false);action.onclick();
  assert.equal($('#workspaceInspector').hidden,true);assert.equal(action.hidden,true);assert.equal(c.document.activeElement,$('#mobileReviewToggle'));assert.equal(JSON.stringify(c.P),before);
});

test('mobile return ignores hidden desktop calls and does not steal newer focus in its queued frame',()=>{
  const{c,$}=fixture();c.renderWorkspaceShell();assert.equal(typeof $('#mobReturnPhoto').onclick,'function');
  $('#mobReturnPhoto').onclick();assert.equal($('#workspaceInspector').hidden,false);
  c.matchMedia=()=>({matches:true});c.renderWorkspaceShell();c.setWorkspacePanel('project');
  const frames=[];c.requestAnimationFrame=fn=>frames.push(fn);c.document.activeElement=$('#mobReturnPhoto');$('#mobReturnPhoto').onclick();
  assert.equal($('#workspaceInspector').hidden,true);c.document.activeElement=$('#other');frames.forEach(fn=>fn());assert.equal(c.document.activeElement,$('#other'));
});
