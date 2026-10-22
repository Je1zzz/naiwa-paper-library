(async () => {
  const fs = require('node:fs'), path = require('node:path');
  const vault = app.vault.adapter.getBasePath();
  const dev = vault + '/.paper-library-dev/';
  // A caller may point this at a checkout without reloading the live plugin.
  const runtime = globalThis.paperLibraryNativeSource || path.resolve(dev, '../.obsidian/plugins/paper-library');
  const output = path.join(dev, 'side-clipboard-native-results.json');
  const plugin = app.plugins.plugins['paper-library'];
  const report = { startedAt: new Date().toISOString(), checks: [], notices: [],
    boundaries: ['Mock preference roundtrip only; live user preferences are not written',
      'Synthetic pointer events in the real Electron DOM; no physical mouse drag',
      'Clipboard file-drop paths only; no paste, upload, messages, or PDF/note creation/deletion'] };
  if (fs.existsSync(output)) {
    const previous = JSON.parse(fs.readFileSync(output, 'utf8'));
    report.priorRuns = [...(previous.priorRuns || []), { startedAt: previous.startedAt, passed: previous.passed, failed: previous.failed,
      failures: previous.checks.filter(value => !value.passed), clipboard: previous.clipboard }];
  }
  const check = (value, name, detail) => report.checks.push({ name, passed: !!value, ...(detail === undefined ? {} : { detail }) });
  const wait = async (predicate, name) => {
    for (let i = 0; i < 250; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw Error('Timeout: ' + name);
  };
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  let reader, root, style;
  try {
    try {
      report.baseline = await eval(fs.readFileSync(path.join(dev, 'reader-native.js'), 'utf8'));
      check(report.baseline.passed === 8, 'Existing eight native reader checks pass');
    } catch (error) { check(false, 'Existing eight native reader checks pass', error.message); }

    delete require.cache[require.resolve(path.join(runtime, 'reader.js'))];
    const { createReader } = require(path.join(runtime, 'reader.js'));
    const Core = require(path.join(runtime, 'core.js'));
    const activePath = app.workspace.getLeavesOfType('paper-library-reader').map(leaf => leaf.view.reader?.paperPath).find(Boolean);
    const source = activePath && app.vault.getAbstractFileByPath(activePath);
    if (!source || source.extension?.toLowerCase() !== 'pdf') throw Error('No current reader PDF; do not substitute or create one');
    report.paperPath = source.path;
    report.source = { runtime, readerModifiedAt: fs.statSync(path.join(runtime, 'reader.js')).mtime.toISOString(),
      stylesModifiedAt: fs.statSync(path.join(runtime, 'styles.css')).mtime.toISOString() };
    root = document.createElement('div'); root.id = 'paper-library-native-side-test'; root.style.cssText = 'position:fixed;left:20px;top:50px;bottom:20px;width:min(1100px,calc(100vw - 40px));z-index:9999;background:white'; document.body.append(root);
    style = document.createElement('style'); style.textContent = '@scope (#' + root.id + ') {' + fs.readFileSync(path.join(runtime, 'styles.css'), 'utf8') + '}'; document.head.append(style);
    if (style.sheet.cssRules[0]?.constructor.name !== 'CSSScopeRule') throw Error('Scoped CSS unavailable; do not change live reader styles');
    const preferences = { sideWidth: 322, sideHidden: false, headerCollapsed: false }, writes = [], copies = [];
    const settings = { provider: 'openrouter', model: 'test/text', hasKey: false, models: { openrouter: 'test/text' }, catalogs: { openrouter: ['test/text'] }, enabledModels: {}, efforts: {}, configuredProviders: [] };
    const bridge = {
      listPapers: async () => [{ path: source.path, title: source.basename, size: source.stat.size }],
      readPdf: () => app.vault.readBinary(source), readNotes: async () => [], getMetadata: () => null,
      getSettings: () => structuredClone(settings), getFirstRead: () => undefined,
      getReaderPreferences: () => structuredClone(preferences),
      saveReaderPreferences: async value => { writes.push(structuredClone(value)); Object.assign(preferences, value); },
      copyPdf: async paperPath => copies.push(paperPath), notice: text => report.notices.push(text)
    };
    const visible = element => !!element && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0 && !element.closest('.pl-hidden');
    const button = text => [...root.querySelectorAll('button')].find(node => node.textContent.trim() === text);
    const clickTab = async text => { const tab = button(text); if (!tab) throw Error('Missing tab: ' + text); tab.click(); await frame(); };
    const hide = async () => {
      const control = root.querySelector('[aria-label="隐藏批注与对话侧栏"]');
      if (!control) throw Error('Hide button missing its accessible name');
      control.click(); await wait(() => preferences.sideHidden === true, 'hidden preference'); await frame();
    };
    const restore = async () => { root.querySelector('.pl-side-restore').click(); await wait(() => preferences.sideHidden === false, 'restore preference'); await frame(); };
    const mount = async () => { reader = await createReader(root, bridge, window.pdfjsLib, Core); await frame(); };
    await mount();
    let side = root.querySelector('.pl-side'), handle = root.querySelector('.pl-side-resizer');
    check(visible(side) && handle.getAttribute('role') === 'separator' && handle.getAttribute('aria-orientation') === 'vertical', 'Sidebar starts visible with accessible vertical resizer');
    const initial = side.getBoundingClientRect().width;
    const startX = handle.getBoundingClientRect().left + 3;
    const delta = 80;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: startX }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, buttons: 1, clientX: startX - delta }));
    const during = side.getBoundingClientRect().width;
    check(Math.abs(during - (initial + delta)) < 2 && root.classList.contains('pl-resizing-side'), 'Pointer drag increases actual sidebar width by 80px', { initial, during, rootWidth: root.clientWidth, startX, aria: handle.getAttribute('aria-valuenow') });
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: startX - delta }));
    await wait(() => writes.some(value => Number.isFinite(value.sideWidth)), 'drag width save');
    const savedWidth = preferences.sideWidth;
    check(Math.abs(savedWidth - during) < 2 && !root.classList.contains('pl-resizing-side'), 'Pointerup persists width and exits drag mode', { savedWidth });
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: startX - 200 })); await frame();
    check(Math.abs(side.getBoundingClientRect().width - savedWidth) < 2, 'Pointer listeners stop resizing after pointerup');
    check(Number(handle.getAttribute('aria-valuenow')) === Math.round(savedWidth), 'Resizer aria-valuenow tracks width');

    await clickTab('批注与笔记');
    const main = root.querySelector('.pl-main'), mainBeforeHide = main.getBoundingClientRect().width;
    await hide();
    check(!visible(side) && visible(root.querySelector('.pl-side-restore')) && preferences.sideHidden, 'Accessible hide button hides annotation sidebar and exposes restore');
    const rail = root.querySelector('.pl-side-rail'), railRect = rail.getBoundingClientRect(), restoreRect = root.querySelector('.pl-side-restore').getBoundingClientRect();
    const headerRect = root.querySelector('.pl-reader-header').getBoundingClientRect(), mainRect = main.getBoundingClientRect();
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    check(railRect.width >= 28 && railRect.width <= 32 && rail.parentElement === root.querySelector('.pl-shell'), 'Hidden sidebar uses an independent 28–32px grid rail', { width: railRect.width });
    check(Math.abs((restoreRect.top + restoreRect.bottom) / 2 - (railRect.top + railRect.bottom) / 2) < 2 && root.querySelector('.pl-side-restore').getAttribute('aria-label') === '展开批注与对话', 'Restore icon is vertically centered and has the expand accessible name');
    check(!overlaps(restoreRect, headerRect) && !overlaps(railRect, mainRect) && railRect.left >= mainRect.right - 1, 'Restore rail does not overlap header or main PDF region');
    const paperNoteRect = button('文章笔记').getBoundingClientRect();
    check(!overlaps(restoreRect, paperNoteRect), 'Restore icon does not cover the article-notes button');
    check(Math.abs(mainRect.width - mainBeforeHide - (savedWidth - railRect.width)) < 2, 'Hiding releases the old panel width except for the narrow rail', { before: mainBeforeHide, hidden: mainRect.width, rail: railRect.width });
    await restore();
    check(visible(side) && !visible(root.querySelector('.pl-side-restore')) && Math.abs(side.getBoundingClientRect().width - savedWidth) < 2, 'Restore shows annotations at persisted width');
    check(Math.abs(main.getBoundingClientRect().width - mainBeforeHide) < 2 && !visible(rail), 'Restoring removes the rail and returns the previous main layout');
    await clickTab('AI 对话'); await hide();
    check(!visible(side) && !visible(root.querySelector('.pl-chat-input')) && visible(root.querySelector('.pl-side-restore')), 'Hide also removes AI conversation sidebar and composer from layout');
    reader.destroy(); reader = undefined;
    await mount(); side = root.querySelector('.pl-side'); handle = root.querySelector('.pl-side-resizer');
    check(!visible(side) && visible(root.querySelector('.pl-side-restore')) && Number(handle.getAttribute('aria-valuenow')) === Math.round(savedWidth), 'Reader remount restores hidden preference and saved width');
    await restore(); await clickTab('AI 对话');
    check(visible(side) && Math.abs(side.getBoundingClientRect().width - savedWidth) < 2, 'Remounted reader restore uses persisted width');
    await reader.openPaper(source.path);
    await wait(() => root.querySelector('canvas'), 'real PDF canvas'); await clickTab('AI 对话');
    await hide();
    check(!overlaps(root.querySelector('.pl-side-rail').getBoundingClientRect(), root.querySelector('.pl-reading-area').getBoundingClientRect()), 'With a real PDF loaded, the rail stays outside the reading area');
    await restore();
    const copyButton = button('复制 PDF');
    check(!!copyButton && ![...root.querySelectorAll('button')].some(node => /复制.*全文|全文.*复制/.test(node.textContent)), 'Copy PDF button exists and old full-text copy button is absent');
    copyButton.click(); await wait(() => copies.length === 1, 'mock copyPdf call');
    check(copies.length === 1 && copies[0] === source.path, 'Copy PDF button calls bridge.copyPdf(current paperPath) exactly once');
    check(writes.some(value => value.sideHidden === true) && writes.some(value => value.sideHidden === false), 'Hide and restore both persist through bridge preferences');

    // The only real write outside the report is the explicitly authorized file clipboard.
    const liveBridge = plugin.bridge({});
    await liveBridge.copyPdf(source.path);
    const script = "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Windows.Forms; [pscustomobject]@{files=@([System.Windows.Forms.Clipboard]::GetFileDropList())} | ConvertTo-Json -Compress";
    if (!process.env.SystemRoot) throw Error('SystemRoot is required for the Windows clipboard check');
    const exe = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const { execFile } = require('node:child_process');
    const raw = await new Promise((resolve, reject) => execFile(exe, ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000, encoding: 'utf8' }, (error, stdout) => error ? reject(error) : resolve(stdout)));
    const actual = JSON.parse(raw.trim()).files, expected = app.vault.adapter.getFullPath(source.path);
    const normalize = value => path.resolve(value).toLowerCase();
    const matches = actual.length === 1 && normalize(actual[0]) === normalize(expected);
    report.clipboard = { expected, actual, matches, method: 'Current plugin bridge.copyPdf + Windows PowerShell STA Clipboard.GetFileDropList' };
    check(matches, 'Real Windows clipboard contains exactly the current PDF file path');
  } catch (error) { check(false, 'Native verification completed without uncaught errors', error.message); }
  finally {
    try { reader?.destroy(); } catch (error) { check(false, 'Reader cleanup', error.message); }
    root?.remove(); style?.remove();
    report.passed = report.checks.filter(value => value.passed).length;
    report.failed = report.checks.filter(value => !value.passed).length;
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
  }
  return report;
})()
