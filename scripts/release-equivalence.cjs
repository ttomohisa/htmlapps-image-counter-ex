const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');

// .NET Framework and modern .NET may emit different gzip streams for identical
// input. Validate the actual payload before canonicalizing its storage encoding.
function canonicalReleaseHtml(html) {
  const matches = [...html.matchAll(/,BUILD_MANIFEST=(\{[^\r\n]+?\}),ASSETS=(\{[^\r\n]+\});/g)];
  assert.equal(matches.length, 1, 'one generated build manifest and asset bundle must exist');
  const [match] = matches, manifest = JSON.parse(match[1]), bundle = JSON.parse(match[2]);
  assert.equal(typeof manifest.generatedAtUtc, 'string');
  assert.ok(!Number.isNaN(Date.parse(manifest.generatedAtUtc)), 'build timestamp must be valid');
  const object = (value, label) => assert.ok(value && typeof value === 'object' && !Array.isArray(value), label);
  const size = (value, label) => assert.ok(Number.isSafeInteger(value) && value >= 0, label);
  function matchingKeys(entries, key, values, label) {
    assert.ok(Array.isArray(entries), `${label} manifest must be an array`);
    object(values, `${label} bundle must be an object`);
    const keys = entries.map(entry => {
      object(entry, `${label} entry must be an object`);
      assert.equal(typeof entry[key], 'string', `${label} identity must be a string`);
      assert.ok(entry[key].length, `${label} identity must not be empty`);
      return entry[key];
    });
    assert.equal(new Set(keys).size, keys.length, `${label} identities must be unique`);
    assert.deepEqual(keys.sort(), Object.keys(values).sort(), `${label} identities must match`);
  }
  matchingKeys(manifest.dependencies, 'id', bundle.dependencies, 'dependencies');
  for (const dependency of manifest.dependencies) {
    const embedded = bundle.dependencies[dependency.id];
    object(embedded, `${dependency.id} must be an object`);
    for (const key of ['package', 'version']) {
      assert.equal(typeof dependency[key], 'string');
      assert.equal(embedded[key], dependency[key], `${dependency.id} ${key} must match`);
    }
    matchingKeys(dependency.assets, 'key', embedded.assets, `${dependency.id} assets`);
    for (const asset of dependency.assets) {
      const value = embedded.assets[asset.key], label = `${dependency.id}/${asset.key}`;
      object(value, `${label} must be an object`);
      assert.equal(typeof asset.mime, 'string');
      assert.equal(value.mime, asset.mime, `${label} MIME must match`);
      assert.ok(['none', 'gzip'].includes(value.compression), `${label} compression must be supported`);
      assert.equal(asset.compression, value.compression, `${label} compression must match`);
      for (const [count, name] of [[value.originalBytes, 'originalBytes'], [value.storedBytes, 'storedBytes'], [asset.bytes, 'manifest bytes'], [asset.storedBytes, 'manifest storedBytes']]) size(count, `${label} ${name} must be a nonnegative integer`);
      assert.equal(value.originalBytes, asset.bytes, `${label} original length must match`);
      assert.equal(typeof value.base64, 'string');
      const stored = Buffer.from(value.base64, 'base64');
      assert.equal(stored.toString('base64'), value.base64, `${label} base64 must be canonical and valid`);
      assert.equal(stored.length, value.storedBytes, `${label} bundle stored length must match payload`);
      assert.equal(stored.length, asset.storedBytes, `${label} manifest stored length must match payload`);
      const decoded = value.compression === 'gzip' ? gunzipSync(stored, { maxOutputLength: Math.max(1, value.originalBytes) }) : stored;
      assert.equal(decoded.length, value.originalBytes, `${label} decoded length must match`);
      assert.equal(createHash('sha256').update(decoded).digest('hex'), asset.sha256, `${label} decoded SHA-256 must match`);
      if (value.compression === 'gzip') {
        value.base64 = decoded.toString('base64');
        value.storedBytes = decoded.length;
        asset.storedBytes = decoded.length;
      }
    }
  }
  // Keep all other fields, including unknown metadata, and all surrounding HTML.
  manifest.generatedAtUtc = '<build-time>';
  return html.slice(0, match.index) + `,BUILD_MANIFEST=${JSON.stringify(manifest)},ASSETS=${JSON.stringify(bundle)};` + html.slice(match.index + match[0].length);
}

module.exports = { canonicalReleaseHtml };
