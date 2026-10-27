const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let source=fs.readFileSync(process.env.IMAGE_COUNTER_HTML||path.join(__dirname,'../src/index.template.html'),'utf8');
if(source.includes('id="self-extract-payload"'))source=require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1],'base64')).toString('utf8');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,`Runtime section: ${a}`);return source.slice(start,end)}
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAKAAQAAAAAktvSOAAAASElEQVR4nO3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8GcqAAAFcBkuRAAAAAElFTkSuQmCC';
const svg='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640"/></svg>').toString('base64');
const bytes=url=>Buffer.from(url.split(',')[1]||'','base64').length;
const file=(dataUrl=svg,type='image/svg+xml',name='audio_to_midi_icon.svg')=>({dataUrl,type,name,size:bytes(dataUrl),lastModified:1720000000000});
function setup(){
  const messages=[],writes=[],canvases=[];let seq=0;
  const c={MAX_IMAGES:30,MAX_FILE_BYTES:35*1024*1024,MAX_PROJECT_BYTES:220*1024*1024,MAX_EXPORT_PX:20_000_000,COLORS:['#d15c52'],Date,Math,Set,Map,Blob,atob,structuredClone,lang:'en',id:()=>`id-${++seq}`,t:x=>x,
    FileReader:class{readAsDataURL(f){this.result=f.dataUrl;queueMicrotask(()=>this.onload())}},
    loadImage:async()=>({naturalWidth:640,naturalHeight:640}),imageCapturedMeta:async f=>({capturedAt:f.lastModified,capturedAtSource:'file'}),
    document:{createElement(tag){assert.equal(tag,'canvas');const canvas={width:0,height:0,draws:[],getContext(){return{drawImage:(...args)=>canvas.draws.push(args)}},toDataURL:type=>{assert.equal(type,'image/png');return png}};canvases.push(canvas);return canvas}},
    imageCache:new Map(),history:[],future:[],P:null,activeImageId:null,activeCategoryId:null,
    Toast:{show:m=>messages.push(m)},quickSync(){},showWorkspace(){writes.push('workspace')},switchImage:async()=>true,touch(){writes.push('save')}
  };
  vm.createContext(c);vm.runInContext(section('function defaultSettings()','let P=')+section('function normalizeProject(','function cloneLight()')+section('function dataUrlBytes(','let storageRenderTimer=')+section('async function fileToRecord(','async function switchImage(')+section('function imageReviewCount(','function drawReviewBadge(')+section('function safeName()','async function compressProjectForViewer(')+section('function viewerHtml(','async function saveViewer(')+section('function parseViewerProject(','async function importViewerFile('),c);
  return{c,messages,writes,canvases};
}
function project(c,images){return{app:'image-counter',schemaVersion:4,title:'Import roundtrip',categories:[{id:'cat',name:'Count',color:'#d15c52',visible:true}],settings:c.defaultSettings(),images}}
function actualBytes(p){return JSON.stringify({...p,images:p.images.map(im=>({...im,dataUrl:''}))}).length*2+p.images.reduce((n,im)=>n+bytes(im.dataUrl),0)}

test('selected SVG becomes a safe PNG and survives real project, reference and viewer validation without compression',async()=>{
  const {c,canvases}=setup(),input=file(),record=await c.fileToRecord(input);
  assert.equal(record.dataUrl,png);assert.equal(record.mime,'image/png');assert.equal(record.sourceMime,input.type);assert.equal(record.name,input.name);assert.equal(record.sourceByteSize,input.size);assert.equal(record.byteSize,bytes(png));assert.equal(record.capturedAt,input.lastModified);assert.equal(record.capturedAtSource,'file');
  assert.equal(canvases.length,1);assert.equal(canvases[0].width,640);assert.equal(canvases[0].height,640);assert.equal(canvases[0].draws.length,1);
  const p=project(c,[record]);p.settings.draftCompression.enabled=false;p.settings.viewerCompression.enabled=false;
  p.categories[0].detectionReference={version:1,sourceName:input.name,dataUrl:png,examples:[{x:.1,y:.1,w:.1,h:.1}]};
  const normalized=c.normalizeProject(p);const restored=c.normalizeProject(c.parseViewerProject(c.viewerHtml(normalized)),{viewer:true});
  assert.equal(restored.images[0].dataUrl,png);assert.equal(restored.categories[0].detectionReference.sourceName,input.name);
});
for(const [type,dataUrl] of [['image/png',png],['image/jpeg','data:image/jpeg;base64,/9j/2Q==']])test(`selected ${type} retains original bytes without canvas conversion`,async()=>{
  const {c,canvases}=setup(),input=file(dataUrl,type,'original');const record=await c.fileToRecord(input);
  assert.equal(record.dataUrl,dataUrl);assert.equal(record.mime,type);assert.equal(record.byteSize,bytes(dataUrl));assert.equal(record.sourceByteSize,input.size);assert.equal(canvases.length,0);assert.doesNotThrow(()=>c.validateProject(project(c,[record])));
});
test('a browser-decoded noncanonical raster MIME is normalized instead of poisoning later saves',async()=>{
  const {c}=setup(),record=await c.fileToRecord(file('data:image/pjpeg;base64,/9j/2Q==','image/pjpeg','legacy.jpg'));
  assert.equal(record.mime,'image/png');assert.equal(record.sourceMime,'image/pjpeg');assert.doesNotThrow(()=>c.validateProject(project(c,[record])));
});
for(const [width,height] of [[0,640],[640,0],[NaN,640],[Infinity,640],[1.5,640],[Number.MAX_SAFE_INTEGER,2]])test(`invalid decoded dimensions ${width} x ${height} fail before admission`,async()=>{
  const {c,canvases}=setup();c.loadImage=async()=>({naturalWidth:width,naturalHeight:height});await assert.rejects(c.fileToRecord(file()));assert.equal(canvases.length,0);
});
for(const [width,height] of [[5000,5000],[16385,1]])test(`SVG rasterization ${width} x ${height} is bounded before allocating canvas`,async()=>{
  const {c,canvases}=setup();c.loadImage=async()=>({naturalWidth:width,naturalHeight:height});await assert.rejects(c.fileToRecord(file()));assert.equal(canvases.length,0);
});
for(const failure of ['empty canvas','missing context','encoding error','oversized PNG'])test(`failed SVG conversion ${failure} cannot produce a project record`,async()=>{
  const {c}=setup();c.document.createElement=()=>({getContext:()=>failure==='missing context'?null:{drawImage(){}},toDataURL(){if(failure==='encoding error')throw Error('canvas');if(failure==='oversized PNG')return 'data:image/png;base64,'+Buffer.concat([Buffer.from(png.split(',')[1],'base64'),Buffer.alloc(200)]).toString('base64');return 'data:,'}});
  if(failure==='oversized PNG')c.MAX_FILE_BYTES=180;
  await assert.rejects(c.fileToRecord(file()));
});
test('oversized source is refused before reading or decoding',async()=>{
  const {c}=setup();c.FileReader=class{constructor(){throw Error('must not read')}};await assert.rejects(c.fileToRecord({...file(),size:c.MAX_FILE_BYTES+1}),/fileTooLarge/);
});
test('SVG addition creates a project valid for saving, while rejected conversion leaves work untouched',async()=>{
  const {c,writes}=setup();await c.addFiles([file()],{newProjectIfEmpty:true});assert.equal(c.P.images.length,1);assert.doesNotThrow(()=>c.validateProject(c.P));
  const before=JSON.stringify(c.P),writeCount=writes.length;c.document.createElement=()=>({getContext:()=>null});await c.addFiles([file()]);assert.equal(JSON.stringify(c.P),before);assert.equal(writes.length,writeCount);assert.equal(c.addFiles.pending,0);
});
test('aggregate import checks actual full metadata before adding instead of admitting work that cannot resume',async()=>{
  const {c,messages,writes}=setup();const initial=await c.fileToRecord(file(png,'image/png','first.png'));c.P=project(c,[initial]);
  c.MAX_PROJECT_BYTES=actualBytes(c.P)+bytes(png)+2;const before=JSON.stringify(c.P);await c.addFiles([file(png,'image/png','second.png')]);
  assert.equal(JSON.stringify(c.P),before);assert.equal(messages.at(-1),'projectTooLarge');assert.equal(writes.length,0);assert.equal(c.addFiles.pending,0);
});
test('late conversion from an old workspace cannot add a photo or report success in replacement work',async()=>{
  const {c,writes,messages}=setup();let resolve;c.loadImage=()=>new Promise(ok=>resolve=ok);c.P=project(c,[]);const old=c.P,adding=c.addFiles([file()]);await new Promise(ok=>setImmediate(ok));c.P=project(c,[]);c.P.title='Replacement';const before=JSON.stringify(c.P);resolve({naturalWidth:640,naturalHeight:640});await adding;
  assert.equal(JSON.stringify(c.P),before);assert.equal(old.images.length,0);assert.equal(writes.length,0);assert.equal(messages.length,0);assert.equal(c.addFiles.pending,0);
});
test('raw SVG payloads in imported work remain rejected by the real validator',()=>{
  const {c}=setup();assert.throws(()=>c.normalizeProject(project(c,[{id:'svg',name:'raw.svg',dataUrl:svg,mime:'image/svg+xml',width:640,height:640,markers:[]}]),{viewer:true}),/invalidImage/);
});
const uniquePng=n=>'data:image/png;base64,'+Buffer.concat([Buffer.from(png.split(',')[1],'base64'),Buffer.from([n])]).toString('base64');
const importRecord=n=>({id:'photo-'+n,name:'photo-'+n+'.png',dataUrl:uniquePng(n),width:640,height:640,markers:[]});
test('one addition batch validates each exact raster payload once while retaining complete project validation',async()=>{
  const {c}=setup(),calls=new Map(),validate=c.embeddedRasterBytes;c.embeddedRasterBytes=url=>{calls.set(url,(calls.get(url)||0)+1);return validate(url)};
  c.P=project(c,[importRecord(0)]);c.fileToRecord=async f=>importRecord(f.index);
  await c.addFiles([1,2,3].map(index=>({index,type:'image/png'})));
  assert.equal(c.P.images.length,4);for(const im of c.P.images)assert.equal(calls.get(im.dataUrl),1,'do not scan old base64 again for each new photo');
});
test('photos sharing the same raster payload each own one validation entry without a long-string cache key',async()=>{
  const {c}=setup();let calls=0;const validate=c.embeddedRasterBytes;c.embeddedRasterBytes=url=>{calls++;return validate(url)};
  c.P=project(c,[{...importRecord(0),dataUrl:png}]);c.fileToRecord=async f=>({...importRecord(f.index),dataUrl:png});
  await c.addFiles([1,2,3].map(index=>({index,type:'image/png'})));
  assert.equal(c.P.images.length,4);assert.equal(calls,4);
});
test('raster validation reuse is local to one photo-add request; public project validation always rechecks',async()=>{
  const {c}=setup(),calls=new Map(),validate=c.embeddedRasterBytes;c.embeddedRasterBytes=url=>{calls.set(url,(calls.get(url)||0)+1);return validate(url)};
  c.P=project(c,[importRecord(0)]);c.fileToRecord=async f=>importRecord(f.index);
  await c.addFiles([{index:1,type:'image/png'}]);await c.addFiles([{index:2,type:'image/png'}]);
  assert.equal(calls.get(uniquePng(0)),2);assert.equal(calls.get(uniquePng(1)),2);assert.equal(calls.get(uniquePng(2)),1);
  const before=calls.get(uniquePng(0));c.validateProject(c.P);c.validateProject(c.P);assert.equal(calls.get(uniquePng(0)),before+2);
});
test('a changed image payload during the same import cannot reuse validation for its former data',async()=>{
  const {c,messages}=setup();c.P=project(c,[importRecord(0)]);c.fileToRecord=async f=>{if(f.index===2)c.P.images[0].dataUrl='data:image/png;base64,!!!!';return importRecord(f.index)};
  await c.addFiles([1,2].map(index=>({index,type:'image/png'})));
  assert.deepEqual(Array.from(c.P.images,im=>im.id),['photo-0','photo-1']);assert.equal(c.P.images.some(im=>im.id==='photo-2'),false);assert.ok(messages.includes('decodeFail'));
});
for(const field of ['marker','reference'])test(`cached raster bytes do not bypass changed ${field} validation during addition`,async()=>{
  const {c}=setup();c.P=project(c,[importRecord(0)]);c.fileToRecord=async f=>{
    if(f.index===2){if(field==='marker')c.P.images[0].markers=[{id:'bad',shape:'point',categoryId:'cat',x:2,y:.5}];else c.P.categories[0].detectionReference={version:1,sourceName:'bad',dataUrl:svg,examples:[{x:.1,y:.1,w:.1,h:.1}]}}
    return importRecord(f.index);
  };
  await c.addFiles([1,2].map(index=>({index,type:'image/png'})));assert.deepEqual(Array.from(c.P.images,im=>im.id),['photo-0','photo-1']);
});
