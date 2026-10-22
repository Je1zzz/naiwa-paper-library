'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inflateRawSync } = require('node:zlib');
const { buildXpi, validateManifest, runtimeFiles } = require('../tools/build-zotero.cjs');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../zotero-addon/manifest.json'), 'utf8'));

test('rejects missing Zotero loader fields, including the original missing update_url', () => {
  for (const field of ['id', 'update_url', 'strict_min_version', 'strict_max_version']) {
    const broken = structuredClone(manifest);
    delete broken.applications.zotero[field];
    assert.throws(() => validateManifest(broken), new RegExp(`applications.zotero.${field}`));
  }
});

test('rejects Firefox-only manifests and MV3', () => {
  const firefox = structuredClone(manifest);
  firefox.applications = { gecko: firefox.applications.zotero };
  assert.throws(() => validateManifest(firefox), /applications.zotero.id/);
  assert.throws(() => validateManifest({ ...manifest, manifest_version: 3 }), /manifest_version/);
});

test('requires a valid update URL and a bounded tested minor version', () => {
  for (const url of ['', 'not a URL', 'file:///updates.json', 'https://user:secret@raw.githubusercontent.com/updates.json', 'https://paper-library.invalid/zotero/updates.json']) {
    const broken = structuredClone(manifest);
    broken.applications.zotero.update_url = url;
    assert.throws(() => validateManifest(broken));
  }
  const broad = structuredClone(manifest);
  broad.applications.zotero.strict_max_version = '10.*';
  assert.throws(() => validateManifest(broad), /tested minor/);
  assert.equal(validateManifest(manifest), manifest);
});

test('uses the project raw URL and a legal empty update manifest for the same addon id', () => {
  assert.equal(manifest.applications.zotero.update_url,
    'https://raw.githubusercontent.com/Je1zzz/naiwa-paper-library/main/zotero-addon/updates.json');
  assert.equal(manifest.applications.zotero.strict_min_version, '7.0');
  assert.equal(manifest.applications.zotero.strict_max_version, '10.0.*');
  const updates = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../zotero-addon/updates.json'), 'utf8'));
  assert.deepEqual(updates, { addons: { [manifest.applications.zotero.id]: { updates: [] } } });
  assert.equal(runtimeFiles.includes('updates.json'), false, 'Update feed is hosted separately from the XPI');
});

test('produces deterministic XPI with exact root paths and byte-identical UTF-8 source', () => {
  const { bytes } = buildXpi();
  assert.deepEqual(bytes, buildXpi().bytes);
  const names = [];
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18);
    const nameSize = bytes.readUInt16LE(offset + 26);
    const extraSize = bytes.readUInt16LE(offset + 28);
    const name = bytes.toString('utf8', offset + 30, offset + 30 + nameSize);
    const start = offset + 30 + nameSize + extraSize;
    const data = inflateRawSync(bytes.subarray(start, start + size));
    assert.deepEqual(data, fs.readFileSync(path.resolve(__dirname, '../zotero-addon', name)));
    names.push(name);
    offset = start + size;
  }
  assert.deepEqual(names, runtimeFiles);
  assert.equal(JSON.parse(manifestString(bytes)).name, manifest.name);
});

function manifestString(bytes) {
  const start = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
  return inflateRawSync(bytes.subarray(start, start + bytes.readUInt32LE(18))).toString('utf8');
}

test('optional live diagnostic reads parser results and console without installing', async () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../zotero-addon/diagnose-install.js'), 'utf8');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction('ChromeUtils', 'Cc', 'Ci', 'Services', 'Zotero', script);
  const reads = [];
  const addonManager = { async getInstallForFile(file) {
    reads.push(file.path);
    if (reads.length === 1) return { state: 4, error: -3 };
    return { state: 3, error: 0, addon: { id: manifest.applications.zotero.id,
      version: manifest.version, appDisabled: false, isCompatible: true },
      install() { assert.fail('Diagnostic must never install'); } };
  } };
  const output = JSON.parse(await run(
    { importESModule() { return { AddonManager: addonManager }; } },
    { '@mozilla.org/file/local;1': { createInstance() { return { initWithPath(value) { this.path = value; } }; } } },
    { nsIFile: {} },
    { console: { getMessageArray() { return [
      { message: 'Reading manifest: applications.zotero.update_url not provided' },
      { message: 'unrelated message' }
    ]; } } },
    { version: '10.0.6' }
  ));
  assert.equal(reads.length, 2);
  assert.equal(output.results[0].error, -3);
  assert.equal(output.results[1].compatible, true);
  assert.equal(output.messages.length, 1);
});
