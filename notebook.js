const Core = require('./core');
const Format=require('./note-format');
const START = '<!-- paper-library:annotation ';
const GROUP_START = '<!-- paper-library:annotations:start -->';
const GROUP_END = '<!-- paper-library:annotations:end -->';
// Older builds escaped array delimiters outside JSON strings, making rects
// unreadable. Recover those delimiters without changing literal string values.
function annotationMeta(text){
  try{return JSON.parse(text);}catch{}
  let fixed='',quoted=false,escaped=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(!quoted&&/^\\u005[bd]$/i.test(text.slice(i,i+6))){fixed+=text.slice(i,i+6).toLowerCase()==='\\u005b'?'[':']';i+=5;continue;}
    fixed+=char;
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}else if(char==='"')quoted=true;
  }
  return JSON.parse(fixed);
}
function blocks(source, path, {allVersions=false,records={}}={}) {
  const out = [];
  const re = /<!-- paper-library:annotation (.*?) -->\r?\n([\s\S]*?)\r?\n<!-- paper-library:end -->/g;
  for (const m of source.matchAll(re)) {
    try {
      const stored = annotationMeta(m[1]),meta={...records[stored.id],...stored};
      const body = m[2].split(/\r?\n<!-- paper-library:body -->\r?\n/)[1] ?? '';
      const translated = m[2].match(/<!-- paper-library:translation -->\r?\n([\s\S]*?)\r?\n<!-- paper-library:translation:end -->/);
      const quote=[...m[2].split(/\r?\n<!-- paper-library:body -->/)[0].matchAll(/(?:^|\r?\n)>[ \t]?(.*)/g)].map(match=>match[1]).join('\n');
      let title=m[2].match(/^### (.*)$/m)?.[1];
      if(stored.paper&&title?.endsWith(' · P'+meta.page)){title=title.slice(0,-(' · P'+meta.page).length);if(!meta.title&&['便笺','划线批注','翻译与批注','AI 摘记','阅读笔记'].includes(title))title=undefined;}
      out.push({ ...meta,...(title!==undefined?{title}:{}),quote:quote||meta.quote||'', ...(translated ? { translation: translated[1] } : {}), body, path, _block: m[0] });
    } catch { /* Preserve malformed blocks for manual repair. */ }
  }
  if(allVersions)return out;
  const latest=new Map();for(const note of out){const key=note.id||Symbol(),old=latest.get(key);if(!old||String(note.updated||'')>=String(old.updated||''))latest.set(key,note);}return [...latest.values()];
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
      await plugin.app.vault.create(path, group('---\ncssclasses:\n  - paper-library-note\n---\n\n## 阅读札记\n',plugin.settings.annotationRecords||{}));
      plugin.settings.cleanNotePages||={};plugin.settings.cleanNotePages[path]=1;
    }
    plugin.settings.notePages[paper] = path;
    await plugin.saveData(plugin.settings);
  }
  return plugin.app.vault.getAbstractFileByPath(path);
}
function group(source,records) {
  const versions=blocks(source,'',{allVersions:true,records}),notes = blocks(source, '',{records});
  let prose = source;
  for (const note of versions) prose = prose.replace(note._block, '');
  const region = prose.indexOf(GROUP_START), end = prose.indexOf(GROUP_END, region);
  if (region >= 0 && end >= 0) {
    const manual = prose.slice(region + GROUP_START.length, end).replace(/^## (?:批注|便笺)\s*$/gm, '').trim();
    prose = prose.slice(0, region) + (manual ? '\n' + manual + '\n' : '') + prose.slice(end + GROUP_END.length);
  } else prose = prose.replace(/^## 批注与摘记[ \t]*\r?$/m, '');
  return prose.trimEnd() + '\n\n' + GROUP_START + '\n## 批注\n\n' + notes.filter(n => n.kind !== 'sticky').map(n => blockFor(n,records!==undefined)).join('\n\n') + '\n\n## 便笺\n\n' + notes.filter(n => n.kind === 'sticky').map(n => blockFor(n,records!==undefined)).join('\n\n') + '\n' + GROUP_END + '\n';
}
function blockFor(note,compact=false) {
  const { body, path, _source, _block, _originalBody, ...meta } = note;
  const title = (note.title||'').replace(/[\r\n]/g, ' ');
  const quote = note.quote ? '\n> ' + note.quote.replace(/\n/g, '\n> ') + '\n' : '';
  const encoded = JSON.stringify(compact?{id:note.id}:meta).replace(/</g,'\\u003c').replace(/>/g,'\\u003e');
  return `${START}${encoded} -->\n${title?'### '+title+'\n':''}${quote}\n<!-- paper-library:body -->\n${body || ''}\n<!-- paper-library:end -->`;
}
async function save(plugin, note) {
  const file = await pageFor(plugin, note.paper);
  const now = new Date().toISOString();
  const { path, _source, _block, _originalBody, ...fields } = note;
  const data = { ...fields, id: note.id || crypto.randomUUID(), created: note.created || now, updated: now };
  const records=plugin.settings.annotationRecords||={};
  if(plugin.app.vault.read)for(const existing of blocks(await plugin.app.vault.read(file),file.path,{records}))records[existing.id]=Format.record(existing);
  const previousRecords={...records},oldRecord=records[data.id];
  const {body:ignoredBody,quote:ignoredQuote,...record}=data;records[data.id]=record;await plugin.saveData?.(plugin.settings);
  const block = blockFor(data,true);
  try{
  await plugin.app.vault.process(file, source => {
    const previous = blocks(source, file.path,{records:previousRecords}).find(n => n.id === data.id);
    if (previous) {
      if ((note._block && previous._block !== note._block) || (note.updated && previous.updated !== note.updated)) throw new Error('笔记已在其他窗口修改，请刷新后重试。');
      let cleaned=source;for(const version of blocks(source,file.path,{allVersions:true,records:previousRecords}).filter(n=>n.id===data.id))cleaned=cleaned.replace(version._block,'');return group(cleaned+'\n\n'+block+'\n',records);
    }
    return group(source + '\n\n' + block + '\n',records);
  });
  }catch(error){if(oldRecord)records[data.id]=oldRecord;else delete records[data.id];await plugin.saveData?.(plugin.settings);throw error;}
  return { ...data, path: file.path, _block: block };
}
function renamePaper(source, oldPath, newPath,records) {
  for (const note of blocks(source, '',{records})) {
    if (note.paper !== oldPath) continue;
    const updated = { ...note, paper: newPath, source: `[[${newPath}#page=${note.page}]]` };
    if(records?.[note.id])records[note.id]={...records[note.id],paper:newPath};source = source.replace(note._block, () => blockFor(updated,records!==undefined));
  }
  return group(source,records);
}
module.exports = { blocks, pageFor, save, group, renamePaper,blockFor };
