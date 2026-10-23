const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(__dirname,'../src');
function fixture(){
 const bytes=Buffer.from('%PDF-1.4\nsynthetic fixture'),files=new Map(),notices=[],exports=[];let fail=false;
 class TFile{constructor(name,data){this.path=name;this.basename=name.split('/').at(-1).replace(/\.pdf$/,'');this.extension='pdf';this.bytes=data;}}
 const api={Plugin:class{},ItemView:class{},PluginSettingTab:class{},TFile,Notice:class{constructor(message){notices.push(message);}}};
 const sandbox={module:{exports:{}},crypto,Buffer,URL,TextDecoder,process,setTimeout,clearTimeout,console,require:name=>{
  if(name==='obsidian')return api;
  if(name==='./zotero-export')return {savePdf:async(_p,paper)=>{exports.push(paper);if(fail)throw Error('offline');}};
  if(name==='node:fs')return {...fs,readFileSync:()=>bytes};
  return require(name.startsWith('node:')?name:path.join(source,name));
 }};
 vm.runInNewContext(fs.readFileSync(path.join(source,'plugin.js'),'utf8'),sandbox);
 const plugin=new sandbox.module.exports();plugin.settings={};plugin.webImportJobs=new Map();plugin.saveData=async()=>{};plugin.ensureFolder=async()=>{};plugin.categoryPath=p=>p;
 plugin.app={vault:{getAbstractFileByPath:p=>files.get(p),createBinary:async(p,b)=>{files.set(p,new TFile(p,Buffer.from(b)));},readBinary:async f=>f.bytes},secretStorage:{getSecret:()=>null}};
 plugin.zotero=async()=>require('node:url').pathToFileURL(path.resolve('fixture.pdf')).href;plugin.linkZotero=async()=>({});
 const original=plugin.bridge.bind(plugin);plugin.bridge=view=>({...original(view),saveMetadata:async()=>{}});
 const attachment={key:'ABCDEFGH',library:{id:1},data:{title:'fixture',itemType:'attachment',contentType:'application/pdf'}};
 return {plugin,bytes,files,notices,exports,attachment,fail:()=>fail=true};
}
test('local import exports only when opted in',async()=>{
 const f=fixture();await f.plugin.bridge({}).importPdf('a.pdf',f.bytes);assert.equal(f.exports.length,0);f.plugin.settings.alsoSaveToZotero=true;await f.plugin.bridge({}).importPdf('b.pdf',f.bytes);assert.deepEqual(f.exports,['文献/b.pdf']);
});
test('Zotero failure keeps the local PDF and explains the partial success',async()=>{
 const f=fixture();f.plugin.settings.alsoSaveToZotero=true;f.fail();const paper=await f.plugin.bridge({}).importPdf('a.pdf',f.bytes);assert.ok(f.files.has(paper));assert.match(f.notices[0],/PDF 已保存在 Obsidian/);
});
test('import from Zotero never exports back and records content identity',async()=>{
 const f=fixture();f.plugin.settings.alsoSaveToZotero=true;await f.plugin.bridge({}).importZotero(f.attachment);assert.equal(f.exports.length,0);assert.equal(Object.values(f.plugin.settings.zoteroExports)[0].source,'zotero');
});
test('returning a previously exported PDF reuses the original local paper without duplication',async()=>{
 const f=fixture(),paper=await f.plugin.bridge({}).importPdf('original.pdf',f.bytes),hash=crypto.createHash('sha256').update(f.bytes).digest('hex');f.plugin.settings.zoteroExports={[hash]:{status:'saved',paper}};
 assert.equal(await f.plugin.bridge({}).importZotero(f.attachment),paper);assert.equal(f.files.size,1);
});
test('website PDF import uses the same opt-in export path',async()=>{
 const f=fixture();f.plugin.settings.alsoSaveToZotero=true;const url='https://example.com/paper.pdf',paper=await f.plugin.importWeb({url,title:'web',directBytes:f.bytes},url,'文献');assert.ok(f.files.has(paper));assert.deepEqual(f.exports,[paper]);
});
