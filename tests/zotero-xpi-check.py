"""Read-only independent ZIP audit and replay of the installed Zotero manifest gate.

Usage: python tests/zotero-xpi-check.py --node NODE --omni OMNI --xpi XPI [--old-xpi OLD]
This does not start Zotero, install anything, read items, or change a profile.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--node', required=True)
parser.add_argument('--omni', required=True)
parser.add_argument('--xpi', required=True)
parser.add_argument('--old-xpi')
args = parser.parse_args()

with zipfile.ZipFile(args.omni) as archive:
    source = archive.read('modules/Extension.sys.mjs').decode('utf-8')
# Replay the actual installed source checks, not a reimplementation of required fields.
gate = re.search(r'if \(this.type == "extension"\) \{\s+if \(!manifest\.applications\?\.zotero\?\.id\).*?(?=\s+manifest\.browser_specific_settings = undefined;)', source, re.S)
assert gate, 'Installed Zotero manifest gate changed; inspect before adapting this test'
gate_source = gate.group(0) + '\n}'
runner = """
const vm = require('node:vm');
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const errors = [];
const scope = { manifest: input.manifest, type: 'extension', manifestError: value => errors.push(value) };
vm.runInNewContext(input.gate, scope);
console.log(JSON.stringify(errors));
"""

def audit(filename, fixed):
    with zipfile.ZipFile(filename) as archive:
        assert archive.testzip() is None, 'ZIP CRC failure'
        names = archive.namelist()
        assert len(names) == len(set(names)), 'Duplicate ZIP entries'
        assert 'manifest.json' in names and 'bootstrap.js' in names, 'Missing root files'
        manifest = json.loads(archive.read('manifest.json').decode('utf-8'))
        if fixed:
            assert names == ['manifest.json', 'bootstrap.js', 'chrome/content/companion.js']
            root = Path(__file__).resolve().parents[1] / 'zotero-addon'
            for name in names:
                assert archive.read(name) == (root / name).read_bytes(), name
            assert manifest['applications']['zotero']['strict_min_version'] == '7.0'
            assert manifest['applications']['zotero']['strict_max_version'] == '10.0.*'
            assert manifest['applications']['zotero']['update_url'] == 'https://raw.githubusercontent.com/Je1zzz/naiwa-paper-library/main/zotero-addon/updates.json'
            updates = json.loads((root / 'updates.json').read_text(encoding='utf-8'))
            assert updates == {'addons': {manifest['applications']['zotero']['id']: {'updates': []}}}
    result = subprocess.run([args.node, '-e', runner], input=json.dumps({'manifest': manifest, 'gate': gate_source}), text=True, capture_output=True, check=True)
    errors = json.loads(result.stdout)
    if fixed:
        assert errors == [], errors
    else:
        assert 'applications.zotero.update_url not provided' in errors, errors
    return {'xpi': str(Path(filename).resolve()), 'entries': names, 'crc': 'PASS', 'installed_source_gate_errors': errors}

results = [audit(args.xpi, True)]
if args.old_xpi:
    results.append(audit(args.old_xpi, False))
print(json.dumps({'verification': 'Installed-source gate replay; not a live installation or application log', 'omni': args.omni, 'gate_line': source[:gate.start()].count('\n') + 1, 'results': results}, indent=2, ensure_ascii=False))
