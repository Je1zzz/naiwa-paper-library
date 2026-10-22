/* Zotero bootstrapped extension; no profile access or installation side effects. */
var paperLibraryScope;
var paperLibraryAddon;

function install() {}

async function startup({ id, rootURI }) {
  paperLibraryScope = {};
  Services.scriptloader.loadSubScript(
    rootURI + "chrome/content/companion.js", paperLibraryScope, "UTF-8"
  );
  paperLibraryAddon = paperLibraryScope.createPaperLibraryAddon({ Zotero, Services });
  try {
    paperLibraryAddon.start(id);
  } catch (error) {
    shutdown();
    throw error;
  }
}

function onMainWindowLoad({ window }) {
  paperLibraryAddon?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  paperLibraryAddon?.removeFromWindow(window);
}

function shutdown() {
  paperLibraryAddon?.stop();
  paperLibraryAddon = undefined;
  paperLibraryScope = undefined;
}

// Keep the user's target-vault preference when the extension is uninstalled.
function uninstall() {}
