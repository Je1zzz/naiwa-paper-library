// Paste into Zotero Tools > Developer > Run JavaScript; enable "Run as async function".
// Read-only parser diagnostic: no installation, profile preference, or library writes.
const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
const files = [
  'C:/path/to/old-paper-library-zotero.xpi',
  'C:/path/to/paper-library-zotero-0.1.1.xpi'
];
const results = [];
for (const path of files) {
  const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  file.initWithPath(path.replaceAll('/', '\\'));
  try {
    const candidate = await AddonManager.getInstallForFile(file);
    results.push({ path, state: candidate?.state, error: candidate?.error,
      id: candidate?.addon?.id, version: candidate?.addon?.version,
      appDisabled: candidate?.addon?.appDisabled, compatible: candidate?.addon?.isCompatible });
    // Deliberately do not call candidate.install(): parsing is sufficient here.
  } catch (error) {
    results.push({ path, error: String(error), additionalErrors: error.additionalErrors });
  }
}
const messages = Services.console.getMessageArray()
  .map(entry => entry.message || String(entry))
  .filter(message => /paper-library|applications\.zotero\.update_url not provided/.test(message));
return JSON.stringify({ zotero: Zotero.version, results, messages }, null, 2);
