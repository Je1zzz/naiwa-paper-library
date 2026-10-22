# Paper Library · Zotero → Obsidian companion

Zotero Desktop bootstrap extension for **Zotero 7–10.0**, including
10.0.6. Right-click selected library rows and choose **导入到 Obsidian · Paper Library**.
This companion hands identifiers to Obsidian; the Paper Library Obsidian plugin
performs the actual metadata/PDF import. No npm dependencies, network calls,
Zotero database writes, profile discovery, or installation scripts are included.

## Installation

Download [paper-library-zotero.xpi](https://github.com/Je1zzz/naiwa-paper-library/raw/refs/heads/main/zotero-addon/paper-library-zotero.xpi), then use Zotero Tools → Plugins → gear → Install Plugin From File.

## Build from source

Build a local test XPI from the repository root (Node.js 20+, no dependencies):

```powershell
node tools/build-zotero.cjs --out ./dist/paper-library-zotero-0.1.1.xpi
node --test tests/zotero-build.test.cjs
```

The builder refuses to overwrite an existing output. It validates the manifest,
checks runtime JavaScript syntax, and creates a deterministic ZIP containing only
these files with **manifest.json at the archive root**:

```text
manifest.json
bootstrap.js
chrome/content/companion.js
```

Tests, diagnostics, and this README are excluded from the runtime archive.
The resulting ZIP-format archive must have an `.xpi` extension. There is no
`install.rdf`, overlay, `chrome.manifest`, generated bundle, or signing/publishing
step. Resources load relative to the bootstrap `rootURI`, which also works inside
an XPI, so runtime chrome registration is unnecessary.

After a separate build, the user can install the XPI in Zotero via **Tools →
Plugins** (some versions call this Add-ons), the gear menu → **Install Plugin From
File…**, and select the XPI. Enable it if prompted. Bootstrap supports enable,
disable, and removal without a restart. **Installing and enabling that XPI activates
the right-click command; having this source directory alone does not.** Building
an XPI does not install anything, restart Zotero, or modify the user's profile.

Real-profile installation remains unperformed. The supported install path here is
the running Zotero Plugins UI; no safe, verified headless installation into a live
profile has been established. Do not copy files into the live profile or rewrite
its extension registry as a substitute. UI activation and end-to-end import still
need real testing after the separately built XPI is installed by the user.

Obsidian Desktop must be installed and registered for `obsidian://`, the target
vault must exist, and Paper Library must handle the `paper-library` URI command
and `zotero-import` action. For the receiver's local API reads, Zotero must be
running with its local API enabled. On an explicit Import with eligible targets,
the companion checks that `httpServer.enabled` is true and the HTTP server exposes
a running port, then enables `httpServer.localAPI.enabled` through
`Zotero.Prefs.set` if needed. The fully qualified preference is
`extensions.zotero.httpServer.localAPI.enabled`. Zotero 10.0.6 reads this flag on
each request, so changing it requires **no restart when the HTTP server is already
running**. A missing/unsupported flag or failed write blocks handoff with an alert.
Startup, menu display, settings cancellation, and unsupported selections never
enable it. This persists the user's Import-triggered API choice; disabling the
addon does not turn it off. No live `prefs.js` is read or rewritten.

If `httpServer.enabled` is false, the companion changes neither flag and does not
launch Obsidian: open **Zotero Settings → Advanced → Local API → Enable and Restart**,
allow Zotero's own UI to restart it, then select Import again. This corresponds to
the official `enableServerForLocalAPI()` action. If the HTTP flag is already true
but the server has no running port, check its port/settings and restart manually
if needed. The companion never calls quit/restart or starts a server itself.
The port check is an in-process readiness check, not a successful API GET or
end-to-end import verification.

The Zotero helper independently confirmed Zotero 10.0.6 and local API v3 running
on 2026-10-22. The companion requires no Codex/OpenCodex login and does not alter
either configuration.

## Configure the vault

In Zotero, choose **Tools → Paper Library：设置 Obsidian 目标仓库…** and enter the
Obsidian **vault name**, not a filesystem path. Default: `paper_library`.
Saving takes effect for the next import. Cancel leaves the preference unchanged;
blank/control-character values are rejected. Unicode and reserved URL characters
are encoded. No source editing is needed.

On vault-dialog confirmation the extension saves its own string preference,
`extensions.paper-library-obsidian.vault`, through `Zotero.Prefs`. Startup does not
write a default preference. Disable/uninstall keeps the saved value. No preference
was written to the actual Zotero profile during development.

## Selection behavior

- Regular bibliography item: pass its item key and **omit attachmentKey**, even
  with one or many PDFs. The receiver chooses the PDF or displays its picker.
- Stored or linked PDF attachment with a regular parent: pass the parent's key
  plus the selected PDF's attachment key. No PDF file is opened by this addon.
- Standalone stored or linked PDF without a parent: pass its own attachment key
  as **both `itemKey` and `attachmentKey`**. The receiver handles this standalone
  case, including group scope when applicable.
- Multi-selection: launch one URI per distinct resolved target in selection
  order. Exact duplicates collapse. If a parent and its PDFs are selected,
  explicit PDFs replace the generic parent request; distinct selected PDFs are
  retained. The receiver must serialize/queue multiple incoming imports.
- Notes, annotations, non-PDF attachments, deleted items, invalid/cross-library
  parents, and feed libraries are
  skipped. Mixed selections still send eligible rows, with a skipped/error summary.
  The import menu is hidden when no supported row is selected.
- Missing OS protocol handler/other launch errors produce an alert; remaining
  selected targets are still attempted. A successful launch means **handoff**,
  not confirmation of completed Obsidian import. No import is attempted on startup.

## Integration URI contract

Personal library (unchanged base contract):

```text
obsidian://paper-library?vault=<encodedVault>&action=zotero-import&itemKey=<parentKey>&attachmentKey=<selectedPDFKey>&libraryId=<localLibraryID>
```

`attachmentKey` is entirely omitted for bibliographic selection, never an empty
parameter. All query values are percent-encoded exactly once. `itemKey` identifies
the regular bibliographic parent, or the attachment itself for a standalone PDF
(in which case it equals `attachmentKey`). It never identifies a note or annotation.
`libraryId` is the positive integer **local Zotero libraryID**; its spelling is
intentionally different from Zotero's JavaScript property `libraryID`.

Group library adds explicit scope:

```text
obsidian://paper-library?vault=paper_library&action=zotero-import&itemKey=PARENT12&attachmentKey=PDFKEY12&libraryId=4&libraryType=group&groupId=987654
```

Here `4` is an illustrative local libraryID and `987654` is an illustrative
actual Zotero group ID, resolved with `Zotero.Groups.getGroupIDFromLibraryID(4)`.
They are **not interchangeable**. Identical keys in different libraries remain
separate targets. If library type or group mapping cannot be resolved, no URI
for that item is sent; the addon never falls back to personal scope.

Required receiver routing for Zotero local API v3:

| URI scope | Local API item root |
| --- | --- |
| No `libraryType`/`groupId` (personal) | `/api/users/0/items/<itemKey>` |
| `libraryType=group&groupId=G` | `/api/groups/G/items/<itemKey>` |

Use that same root for selected attachment metadata/file access and parent
children lookup. Validate the attachment's parent within that scope. `users/0`
is the local personal-library alias, not `users/<localLibraryID>`. Similarly,
**never substitute local libraryId into `/groups/…`**.

**`groupId` selects group scope; `libraryType=group` is supplemental metadata.**
The main handler is reported to support optional `groupId` and standalone PDF
keys. Do not infer a web group ID from `libraryId`. Receivers without group support
must reject group requests rather than fall back to `users/0`. This source task
did not inspect, edit, or independently validate the installed Obsidian plugin.

## Verification

Run locally from this directory using Node.js 18+:

```powershell
node --check bootstrap.js
node --check chrome/content/companion.js
node --test companion.test.cjs
```

The single targeted test file exercises real production source in a Node VM with
Zotero/DOM stubs: personal/group URI scope, encoding, bibliographic vs selected
PDF behavior, multi-selection/deduplication, rejected inputs, persisted vault
settings/cancel, MenuManager callbacks, Zotero 7 fallback, window cleanup,
disable during async work, launch errors, bootstrap load/rollback/re-enable,
standalone PDFs in both scopes, Import-only API enablement, no-write paths, and
HTTP-disabled/unsupported/API-write-failure blocking.
These are contract/lifecycle tests, **not live Zotero or Obsidian tests**.

Executed on 2026-10-22 with Node.js v24.19.0: both production syntax checks passed;
**21 tests passed, 0 failed**. All five deliverable files are under this directory.

Manual checks still required after a separate XPI build/user installation:

1. In Zotero 10.0.6 (and supported older versions), check the exact context label
   and Tools setting; change the vault, then disable/re-enable and verify it persists.
2. Send a parent with multiple PDFs: verify the Obsidian picker. Send a selected
   PDF: verify that exact PDF and the correct parent import.
3. Send multiple parents/PDFs and verify the receiver queues every URI, including
   when Obsidian is initially closed. OS dispatch has no import acknowledgement.
4. With receiver group scope support confirmed, send a group item/PDF and verify
   `/api/groups/<groupId>/…` access, never `/api/users/0/…`.
5. Disable/remove the addon: verify both menus disappear; re-enable/new main
   window: verify menus appear once. Test missing Obsidian handler if practical.
6. On a test profile with the HTTP server running but local API disabled, explicitly
   import: verify the API becomes available without restart. With the HTTP server
   disabled, verify the exact Enable and Restart instruction and no URI dispatch.
7. Send standalone PDFs from personal and group libraries: verify both URI keys
   identify the attachment itself and the receiver imports the correct file.

## Official interface evidence

Reviewed 2026-10-22. The implementation uses the official MenuManager whenever
available (Zotero 8–10); only Zotero 7 without it uses appended XUL menuitems plus
`popupshowing` and bootstrap window hooks. MenuManager labels are assigned using
its documented-in-source `context.menuElem` and the element's `label` property;
visibility/enabled state use `context.setVisible`/`setEnabled`. This preserves the
requested Chinese labels in every Zotero locale without locale resources.

- [Zotero 7 developer guide: manifests, bootstrap lifecycle, rootURI loading](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [Zotero 8 developer guide: official custom menus and removal](https://www.zotero.org/support/dev/zotero_8_for_developers#custom_menu_items)
- [Official bootstrap sample](https://github.com/zotero/make-it-red/blob/main/src-2.0/bootstrap.js)
- [Zotero 10.0.6 MenuManager source](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/xpcom/pluginAPI/menuManager.js)
- [Zotero 10.0.6 library/group identifiers](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/xpcom/data/library.js)
- [Zotero 10.0.6 group mapping](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/xpcom/data/groups.js)
- [Zotero 7 menu IDs/order](https://github.com/zotero/zotero/blob/7.0/chrome/content/zotero/zoteroPane.xhtml)
- [Zotero 7 menu construction](https://github.com/zotero/zotero/blob/7.0/chrome/content/zotero/zoteroPane.js)
- [Zotero 10.0.6 launchURL implementation](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/xpcom/zotero.js)
- [Zotero 10.0.6 local API user/group routing](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/xpcom/server/server_localAPI.js)
- [Zotero 10.0.6 running server port and startup](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/xpcom/server/server.js)
- [Zotero 10.0.6 local API checkbox preference](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/preferences/preferences_advanced.xhtml)
- [Zotero 10.0.6 Enable and Restart action](https://github.com/zotero/zotero/blob/10.0.6/chrome/content/zotero/preferences/preferences_advanced.js)

Compatibility range in the manifest: `7.0` through `10.0.*`. The upper bound follows
the developer guide's tested-minor-version format; this does not establish live
runtime testing across the full range.

## Installation failure fixed in 0.1.1

The old manifest omitted `applications.zotero.update_url`. Zotero 10.0.6's installed
`C:/path/to/Zotero/omni.ja` → `modules/Extension.sys.mjs:1879` explicitly records
`applications.zotero.update_url not provided` as a manifest error. The official
[10.0.6 platform build patch](https://github.com/zotero/zotero/blob/10.0.6/app/scripts/fetch_xulrunner#L229-L247)
enforces `id`, `update_url`, and `strict_max_version`. This gate applies even when
the plugin is distributed only as a local XPI. `author` is optional in the installed
schema; changing to Manifest V3 or Firefox's `applications.gecko` is not a fix.

The four existing XPIs under `artifacts/v1.0.0` and `artifacts/v1.0.0-final` have
valid CRCs and already put the manifest at the ZIP root. They reproduce the missing
update URL error, not a nested-directory failure. `10.*` includes 10.0.6 and was
not the cause of rejection; the narrower `10.0.*` bound is a compatibility correction.

The update URL is
`https://raw.githubusercontent.com/Je1zzz/naiwa-paper-library/main/zotero-addon/updates.json`.
The source `updates.json` contains a legal empty feed:

```json
{"addons":{"paper-library-obsidian@paper-library.local":{"updates":[]}}}
```

An empty array advertises no updates. No Release has been published.
This feed is hosted separately and is not bundled inside the XPI. The builder
checks its addon id and array shape before packaging, and rejects `.invalid`
placeholder hosts. The update feed is tracked in this repository. Local manifest validation does not establish live application installation.

The declared minimum is Zotero 7.0. Its
[official platform patch](https://github.com/zotero/zotero/blob/7.0/app/scripts/fetch_xulrunner)
already enforces `applications.zotero.update_url`, in addition to `id` and
`strict_max_version`. The installed 10.0.6 patch retains these checks. The upper
bound remains `10.0.*`; actual installation and runtime behavior remain untested.

Independent read-only verification with Python's ZIP reader and a replay of the
manifest gate extracted from the installed application:

```powershell
python tests/zotero-xpi-check.py --node node --omni C:/path/to/Zotero/omni.ja --xpi ./dist/paper-library-zotero-0.1.1.xpi --old-xpi ./old-paper-library-zotero.xpi
```

This is an installed-source gate replay, not an actual Zotero installation or a
live application log. No persisted application log was available in the active
profile, and the stock local API exposes no error-console reader. No profile
files were changed to enable logging or install the plugin.

For optional live parser/error-console evidence without installing the extension,
run `diagnose-install.js` in Zotero's **Tools → Developer → Run JavaScript** with
**Run as async function** checked. It reads the two XPIs through Zotero's real
AddonManager, returns parser results and relevant error-console messages, and
never calls `install()`, enables the extension, restarts, or accesses library items.
