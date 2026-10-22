const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const { canonicalReleaseHtml } = require('./release-equivalence.cjs');

test('release embeds the validated model and offline license, without the source checkpoint',()=>{
  const html=read('dist/index.html'),bundle=JSON.parse(html.match(/,ASSETS=(\{[^\r\n]+\});/)[1]);
  const assets=bundle.dependencies['yoloe-26n'].assets;
  assert.deepEqual(Object.keys(assets).sort(),['license','model']);
  const model=zlib.gunzipSync(Buffer.from(assets.model.base64,'base64'));
  assert.equal(model.length,6756087);
  assert.equal(crypto.createHash('sha256').update(model).digest('hex'),'d33ebb16c8cb03ef4b5e1888e759b96b4e0366769287f003798c3c1c75db41ba');
  const license=zlib.gunzipSync(Buffer.from(assets.license.base64,'base64')).toString('utf8');
  assert.ok(license.includes(read('LICENSE').trim()));assert.ok(license.includes(read('LICENSE-MIT').trim()));
  assert.match(html,/<a href="https:\/\/github.com\/ttomohisa\/htmlapps-image-counter-ex"[^>]+data-i18n="appSource"/);
});

test('checked-in root release matches the fresh readable build', () => {
  assert.ok(canonicalReleaseHtml(read('image-counter.html')) === canonicalReleaseHtml(read('dist/index.html')),
    'image-counter.html is stale; run ./build-standalone.ps1 and commit the regenerated alias');
});

test('self-extract payload restores the exact fresh readable bytes', () => {
  const match = read('dist/index.self-extract.html').match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
  assert.ok(match, 'self-extract payload must exist');
  assert.deepEqual(zlib.gunzipSync(Buffer.from(match[1], 'base64')), fs.readFileSync(path.join(root, 'dist/index.html')));
});

test('release normalization cannot hide stale runtime, config or assets', () => {
  const html = read('dist/index.html');
  const baseline = canonicalReleaseHtml(html);
  const timestampOnly = html.replace(/"generatedAtUtc":"[^"]+"/, '"generatedAtUtc":"2000-01-01T00:00:00Z"');
  assert.equal(canonicalReleaseHtml(timestampOnly), baseline);
  for (const [before, after] of [['cameraGeneration', 'staleCameraGeneration'], ['"slug":"image-counter"', '"slug":"stale-counter"'], ['ASSETS={', 'ASSETS={"stale":true,']]) {
    assert.ok(html.includes(before), `negative fixture marker must exist: ${before}`);
    assert.notEqual(canonicalReleaseHtml(html.replace(before, after)), baseline);
  }
});

function releaseFixture({content='same local runtime bytes '.repeat(20),level=9}={}){
  const bytes=Buffer.from(content),stored=zlib.gzipSync(bytes,{level});
  const manifest={schemaVersion:2,generatedAtUtc:'2026-10-22T00:00:00Z',dependencies:[{
    id:'runtime',package:'example-runtime',version:'1.0.0',assets:[{
      key:'main',path:'runtime.js',mime:'text/javascript',compression:'gzip',bytes:bytes.length,
      storedBytes:stored.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')
    }]
  }]};
  const assets={schemaVersion:2,dependencies:{runtime:{package:'example-runtime',version:'1.0.0',assets:{main:{
    mime:'text/javascript',compression:'gzip',originalBytes:bytes.length,storedBytes:stored.length,base64:stored.toString('base64')
  }}}}};
  return{manifest,assets,html:()=>`<script>const APP_CONFIG={"slug":"fixture"},BUILD_MANIFEST=${JSON.stringify(manifest)},ASSETS=${JSON.stringify(assets)};\nrunApplication();</script>`};
}
test('different valid gzip representations of the same asset are equivalent',()=>{
  const first=releaseFixture({level:0}),second=releaseFixture({level:9});
  second.manifest.generatedAtUtc='2026-10-23T01:02:03Z';
  assert.notEqual(first.assets.dependencies.runtime.assets.main.base64,second.assets.dependencies.runtime.assets.main.base64);
  assert.equal(canonicalReleaseHtml(first.html()),canonicalReleaseHtml(second.html()));
});
test('changed decoded bytes remain stale even with consistent lengths and hashes',()=>{
  const first=releaseFixture(),second=releaseFixture({content:'changed local runtime bytes '.repeat(20)});
  assert.notEqual(canonicalReleaseHtml(first.html()),canonicalReleaseHtml(second.html()));
});
for(const [name,alter] of [
  ['corrupted gzip',f=>{const a=f.assets.dependencies.runtime.assets.main,b=Buffer.from(a.base64,'base64');b[b.length-8]^=1;a.base64=b.toString('base64')}],
  ['incorrect hash',f=>f.manifest.dependencies[0].assets[0].sha256='0'.repeat(64)],
  ['incorrect bundle stored length',f=>f.assets.dependencies.runtime.assets.main.storedBytes++],
  ['incorrect manifest stored length',f=>f.manifest.dependencies[0].assets[0].storedBytes++],
  ['incorrect decoded length',f=>{f.assets.dependencies.runtime.assets.main.originalBytes++;f.manifest.dependencies[0].assets[0].bytes++}],
  ['mismatched original length',f=>f.assets.dependencies.runtime.assets.main.originalBytes++],
  ['mismatched package version',f=>f.assets.dependencies.runtime.version='2.0.0'],
  ['missing bundle dependency',f=>delete f.assets.dependencies.runtime],
  ['mismatched compression',f=>f.assets.dependencies.runtime.assets.main.compression='none'],
  ['mismatched MIME',f=>f.assets.dependencies.runtime.assets.main.mime='application/wasm'],
  ['missing bundle asset',f=>delete f.assets.dependencies.runtime.assets.main],
  ['duplicate manifest asset',f=>f.manifest.dependencies[0].assets.push({...f.manifest.dependencies[0].assets[0]})],
  ['invalid base64',f=>f.assets.dependencies.runtime.assets.main.base64+='!']
])test(`release comparison rejects ${name}`,()=>{
  const fixture=releaseFixture();alter(fixture);assert.throws(()=>canonicalReleaseHtml(fixture.html()));
});
test('release comparison retains unknown properties and meaningful metadata',()=>{
  const baseline=canonicalReleaseHtml(releaseFixture().html());
  for(const alter of [
    f=>f.manifest.auditTag='changed',f=>f.manifest.dependencies[0].license='changed',
    f=>f.manifest.dependencies[0].assets[0].path='other.js',f=>f.assets.extra='changed',
    f=>f.assets.dependencies.runtime.extra='changed',f=>f.assets.dependencies.runtime.assets.main.extra='changed'
  ]){const fixture=releaseFixture();alter(fixture);assert.notEqual(canonicalReleaseHtml(fixture.html()),baseline)}
  const fixture=releaseFixture();
  assert.notEqual(canonicalReleaseHtml(fixture.html().replace('runApplication();','oldApplication();')),baseline);
  assert.notEqual(canonicalReleaseHtml(fixture.html().replace('"slug":"fixture"','"slug":"other"')),baseline);
});
test('uncompressed assets retain compression metadata and receive the same integrity checks',()=>{
  const fixture=releaseFixture(),asset=fixture.assets.dependencies.runtime.assets.main,entry=fixture.manifest.dependencies[0].assets[0],
    bytes=zlib.gunzipSync(Buffer.from(asset.base64,'base64'));
  asset.base64=bytes.toString('base64');asset.compression=entry.compression='none';asset.storedBytes=entry.storedBytes=bytes.length;
  assert.notEqual(canonicalReleaseHtml(fixture.html()),canonicalReleaseHtml(releaseFixture().html()),'Compression changes must remain visible');
  bytes[0]^=1;asset.base64=bytes.toString('base64');
  assert.throws(()=>canonicalReleaseHtml(fixture.html()),/SHA-256/);
});
