const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
test('local assets build with a pin and fail closed on absent, incorrect or escaping paths',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'counter-local-assets-'));
  try{
    for(const file of ['build-standalone.ps1','scripts/verify-standalone.ps1']){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dir,file));}
    fs.mkdirSync(path.join(dir,'src'));
    fs.writeFileSync(path.join(dir,'src/index.template.html'),`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'"></head><body><script>const APP_CONFIG=__APP_CONFIG_JSON__,BUILD_MANIFEST=__BUILD_MANIFEST_JSON__,ASSETS=__EMBEDDED_ASSET_BUNDLE_JSON__;</script></body></html>`);
    fs.writeFileSync(path.join(dir,'app.config.json'),JSON.stringify({name:'Fixture',slug:'fixture',version:'1.0.0',build:{output:'dist/index.html',blockRuntimeNetwork:true}}));
    const bytes=Buffer.from('pinned local asset'),sha=crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(dir,'model.bin'),bytes);
    for(const [asset,expected] of [[{path:'model.bin',sha256:sha},null],[{path:'model.bin'},/requires a pinned SHA-256/],[{path:'model.bin',sha256:'0'.repeat(64)},/SHA-256 mismatch/],[{path:'../outside.bin',sha256:sha},/escapes the package root/]]){
      fs.writeFileSync(path.join(dir,'dependencies.json'),JSON.stringify({dependencies:[{id:'fixture',source:'local',package:'fixture',version:'1.0.0',license:'AGPL-3.0-only',homepage:'https://example.org',assets:[{key:'model',compression:'gzip',...asset}]}]}));
      const run=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(dir,'build-standalone.ps1'),'-SkipSelfExtract'],{encoding:'utf8',timeout:60000});
      assert.ifError(run.error);
      if(expected){assert.notEqual(run.status,0);assert.match(run.stdout+run.stderr,expected)}else{
        assert.equal(run.status,0,run.stdout+run.stderr);
        const manifest=JSON.parse(fs.readFileSync(path.join(dir,'dist/dependency-manifest.json')));
        assert.equal(manifest.dependencies[0].source,'local');assert.equal(manifest.dependencies[0].assets[0].sha256,sha);
      }
    }
  }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('counter-local-assets-'));fs.rmSync(dir,{recursive:true,force:true})}
});
