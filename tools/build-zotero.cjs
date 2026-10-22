'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { Script } = require('node:vm');

const runtimeFiles = ['manifest.json', 'bootstrap.js', 'chrome/content/companion.js'];

function validateManifest(manifest) {
  if (manifest.manifest_version !== 2) throw Error('Zotero bootstrap plugins require manifest_version 2');
  for (const field of ['name', 'version']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) throw Error(`Missing ${field}`);
  }
  const app = manifest.applications?.zotero;
  for (const field of ['id', 'update_url', 'strict_min_version', 'strict_max_version']) {
    if (typeof app?.[field] !== 'string' || !app[field].trim()) throw Error(`Missing applications.zotero.${field}`);
  }
  if (!/^[a-z0-9._-]+@[a-z0-9._-]+$/i.test(app.id)) throw Error('Invalid Zotero extension id');
  const update = new URL(app.update_url);
  if (update.protocol !== 'https:' || update.username || update.password) throw Error('update_url must be an HTTPS URL without credentials');
  if (update.hostname.endsWith('.invalid')) throw Error('update_url must not use a .invalid placeholder');
  if (!/^\d+(?:\.\d+)+$/.test(app.strict_min_version)) throw Error('Invalid strict_min_version');
  if (!/^\d+\.\d+\.\*$/.test(app.strict_max_version)) throw Error('strict_max_version must use the tested minor version (x.x.*)');
  return manifest;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A deterministic, standard ZIP with UTF-8 names and a fixed DOS date (1980-01-01).
// An explicit runtime allowlist prevents a parent directory or test files entering the XPI.
function buildXpi(sourceDir = path.resolve(__dirname, '../zotero-addon')) {
  const manifest = validateManifest(JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8')));
  const updates = JSON.parse(fs.readFileSync(path.join(sourceDir, 'updates.json'), 'utf8'));
  if (!Array.isArray(updates.addons?.[manifest.applications.zotero.id]?.updates)) {
    throw Error('updates.json must contain an updates array for the manifest addon id');
  }
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const name of runtimeFiles) {
    const filename = Buffer.from(name, 'utf8');
    const data = fs.readFileSync(path.join(sourceDir, name));
    if (name.endsWith('.js')) new Script(data.toString('utf8'), { filename: name });
    const compressed = deflateRawSync(data, { level: 9 });
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    local.copy(central, 6, 4, 30);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, filename, compressed);
    centralParts.push(central, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(runtimeFiles.length, 8);
  end.writeUInt16LE(runtimeFiles.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return { manifest, bytes: Buffer.concat([...localParts, directory, end]) };
}

if (require.main === module) {
  if (process.argv.length !== 4 || process.argv[2] !== '--out' || !process.argv[3].endsWith('.xpi')) {
    console.error('Usage: node tools/build-zotero.cjs --out <local-test-file.xpi>');
    process.exitCode = 1;
  } else {
    const output = path.resolve(process.argv[3]);
    const { bytes, manifest } = buildXpi();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, bytes, { flag: 'wx' });
    console.log(JSON.stringify({ output, version: manifest.version, bytes: bytes.length, files: runtimeFiles }, null, 2));
  }
}

module.exports = { buildXpi, validateManifest, runtimeFiles };
