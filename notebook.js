const Core = require('./core');
const START = '<!-- paper-library:annotation ';
const GROUP_START = '<!-- paper-library:annotations:start -->';
const GROUP_END = '<!-- paper-library:annotations:end -->';
function blocks(source, path) {
  const out = [];
  const re = /<!-- paper-library:annotation (.*?) -->\r?\n([\s\S]*?)\r?\n<!-- paper-library:end -->/g;
  for (const m of source.matchAll(re)) {
    try {
      const meta = JSON.parse(m[1]);
      const body = m[2].split(/\r?\n<!-- paper-library:body -->\r?\n/)[1] ?? '';
      const translated = m[2].match(/<!-- paper-library:translation -->\r?\n([\s\S]*?)\r?\n<!-- paper-library:translation:end -->/);
      out.push({ ...meta, ...(translated ? { translation: translated[1] } : {}), body, path, _block: m[0] });
    } catch { /* Preserve malformed blocks for manual repair. */ }
  }
  return out;
}
async function pageFor(plugin, paper) {
  plugin.settings.notePages ||= {};
  let path = plugin.settings.notePages[paper];
  if (!path) {
    const stem = `阅读笔记/${Core.safeName(paper.split('/').pop().replace(/\.pdf$/i, ''))}`;
    path = stem + '.md'; let n = 2;
    while (plugin.app.vault.getAbstractFileByPath(path)) {
      const source = await plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath(path));
      if (source.includes(`paper: ${JSON.stringify(paper)}`)) break;
      path = `${stem} (${n++}).md`;
    }
    await plugin.ensureFolder('阅读笔记');
    if (!plugin.app.vault.getAbstractFileByPath(path)) {
      const url = `obsidian://paper-library?vault=${encodeURIComponent(plugin.app.vault.getName())}&paper=${encodeURIComponent(paper)}`;
      await plugin.app.vault.create(path, group(`---\ntype: paper-reading\npaper: ${JSON.stringify(paper)}\n---\n\n# ${paper.split('/').pop().replace(/\.pdf$/i, '')}\n\n[打开文献](${url}) · [[${paper}]]\n\n## 阅读札记\n\n在这里自由记录想法。\n`));
    }
    plugin.settings.notePages[paper] = path;
    await plugin.saveData(plugin.settings);
  }
  return plugin.app.vault.getAbstractFileByPath(path);
}
function group(source) {
  const notes = blocks(source, '');
  let prose = source;
  for (const note of notes) prose = prose.replace(note._block, '');
  const region = prose.indexOf(GROUP_START), end = prose.indexOf(GROUP_END, region);
  if (region >= 0 && end >= 0) {
    const manual = prose.slice(region + GROUP_START.length, end).replace(/^## (?:批注|便笺)\s*$/gm, '').trim();
    prose = prose.slice(0, region) + (manual ? '\n' + manual + '\n' : '') + prose.slice(end + GROUP_END.length);
  } else prose = prose.replace(/^## 批注与摘记[ \t]*\r?$/m, '');
  return prose.trimEnd() + '\n\n' + GROUP_START + '\n## 批注\n\n' + notes.filter(n => n.kind !== 'sticky').map(n => n._block).join('\n\n') + '\n\n## 便笺\n\n' + notes.filter(n => n.kind === 'sticky').map(n => n._block).join('\n\n') + '\n' + GROUP_END + '\n';
}
function blockFor(note) {
  const { body, path, _source, _block, _originalBody, ...meta } = note;
  const title = (note.title || ({ sticky: '便笺', highlight: '划线批注', translation: '翻译与批注', ai: 'AI 摘记' }[note.kind]) || '阅读笔记').replace(/[\r\n]/g, ' ');
  const quote = note.quote ? '\n> ' + note.quote.replace(/\n/g, '\n> ') + '\n' : '';
  const translated = note.translation ? `\n**译文**\n\n<!-- paper-library:translation -->\n${note.translation}\n<!-- paper-library:translation:end -->\n` : '';
  const encoded = JSON.stringify(meta).replace(/\[/g,'\\u005b').replace(/\]/g,'\\u005d').replace(/</g,'\\u003c').replace(/>/g,'\\u003e');
  return `${START}${encoded} -->\n### ${title} · P${note.page}\n\n[[${note.paper}#page=${note.page}|返回第 ${note.page} 页]]${quote}${translated}\n<!-- paper-library:body -->\n${body || ''}\n<!-- paper-library:end -->`;
}
async function save(plugin, note) {
  const file = await pageFor(plugin, note.paper);
  const now = new Date().toISOString();
  const { path, _source, _block, _originalBody, ...fields } = note;
  const data = { ...fields, id: note.id || crypto.randomUUID(), created: note.created || now, updated: now };
  const block = blockFor(data);
  await plugin.app.vault.process(file, source => {
    const previous = blocks(source, file.path).find(n => n.id === data.id);
    if (previous) {
      if ((note._block && previous._block !== note._block) || (note.updated && previous.updated !== note.updated)) throw new Error('笔记已在其他窗口修改，请刷新后重试。');
      return group(source.replace(previous._block, () => block));
    }
    return group(source + '\n\n' + block + '\n');
  });
  return { ...data, path: file.path, _block: block };
}
function renamePaper(source, oldPath, newPath) {
  for (const note of blocks(source, '')) {
    if (note.paper !== oldPath) continue;
    const updated = { ...note, paper: newPath, source: `[[${newPath}#page=${note.page}]]` };
    source = source.replace(note._block, () => blockFor(updated));
  }
  return group(source);
}
module.exports = { blocks, pageFor, save, group, renamePaper };
