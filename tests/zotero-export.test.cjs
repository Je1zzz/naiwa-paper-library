const {test}=require('node:test'),assert=require('node:assert/strict'),{savePdf,sourceURL}=require('../src/zotero-export');
function fixture(){
 const bytes=Buffer.from('%PDF-test fixture'),requests=[],saves=[];
 const plugin={settings:{},app:{vault:{getAbstractFileByPath:path=>({path,extension:'pdf',basename:'中文 文献'}),readBinary:async()=>bytes,getName:()=>'测试 vault'}},saveData:async data=>saves.push(JSON.parse(JSON.stringify(data)))};
 const target={editable:true,libraryEditable:true,filesEditable:true,name:'测试分类'};
 const send=async(endpoint,body,headers)=>{requests.push({endpoint,body,headers});return endpoint==='getSelectedCollection'?target:{canRecognize:true};};
 return {plugin,bytes,requests,saves,send,target};
}
test('official Connector receives exact PDF bytes and ASCII-safe metadata with a working Obsidian backlink',async()=>{
 const f=fixture(),record=await savePdf(f.plugin,'文献/中文.pdf',{send:f.send});assert.equal(record.status,'saved');
 const req=f.requests[1];assert.equal(req.endpoint,'saveStandaloneAttachment');assert.deepEqual(req.body,f.bytes);assert.ok(/^[\x20-\x7E]*$/.test(req.headers['X-Metadata']));const metadata=JSON.parse(req.headers['X-Metadata']);assert.equal(metadata.title,'中文 文献');assert.equal(new URL(metadata.url).searchParams.get('paper'),'文献/中文.pdf');assert.ok(f.saves.some(s=>Object.values(s.zoteroExports)[0]?.status==='uploading'));
});
test('identical content, renamed paths and concurrent requests create one Zotero attachment',async()=>{
 const f=fixture();await Promise.all([savePdf(f.plugin,'a.pdf',{send:f.send}),savePdf(f.plugin,'b.pdf',{send:f.send})]);await savePdf(f.plugin,'c.pdf',{send:f.send});assert.equal(f.requests.filter(r=>r.endpoint==='saveStandaloneAttachment').length,1);
});
test('read-only target fails before upload and remains retryable',async()=>{
 const f=fixture();f.target.filesEditable=false;await assert.rejects(savePdf(f.plugin,'a.pdf',{send:f.send}),/可写/);assert.equal(f.requests.length,1);assert.equal(f.plugin.settings.zoteroExportResults['a.pdf'].status,'failed');
});
test('known pre-upload connection failure can retry while unknown upload outcomes block duplicate writes',async()=>{
 const f=fixture(),broken=async endpoint=>{if(endpoint==='getSelectedCollection')return f.target;throw Error('timeout');};
 await assert.rejects(savePdf(f.plugin,'a.pdf',{send:broken}),/timeout/);assert.equal(f.plugin.settings.zoteroExportResults['a.pdf'].status,'uncertain');
 await assert.rejects(savePdf(f.plugin,'a.pdf',{send:f.send}),/确认/);assert.equal(f.requests.length,0);
 await savePdf(f.plugin,'a.pdf',{send:f.send,retryUncertain:true});assert.equal(f.plugin.settings.zoteroExportResults['a.pdf'].status,'saved');
});
test('refused connection before upload is retryable without fabricating a successful save',async()=>{
 const f=fixture();await assert.rejects(savePdf(f.plugin,'a.pdf',{send:async()=>{throw Error('offline');}}),/offline/);assert.equal(f.plugin.settings.zoteroExportResults['a.pdf'].status,'failed');await savePdf(f.plugin,'a.pdf',{send:f.send});assert.equal(f.plugin.settings.zoteroExportResults['a.pdf'].status,'saved');
});
test('source URL encodes vault, paper and filename without leaking an OS path',()=>{
 const url=sourceURL('My Vault','文献/a & b.pdf');assert.equal(new URL(url).searchParams.get('vault'),'My Vault');assert.equal(new URL(url).searchParams.get('paper'),'文献/a & b.pdf');assert.ok(!url.includes('file:'));
});
