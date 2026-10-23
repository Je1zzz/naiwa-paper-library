const http=require('node:http'),{createHash,randomUUID}=require('node:crypto');
// Official desktop Connector API; never use Electron's upstream proxy or read the DB.
function connector(endpoint,body={},headers={}){
  const bytes=Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
  return new Promise((resolve,reject)=>{
    const request=http.request({hostname:'127.0.0.1',port:23119,path:'/connector/'+endpoint,method:'POST',headers:{'Content-Type':'application/json','X-Zotero-Connector-API-Version':'3','Content-Length':bytes.length,...headers}},response=>{
      let text='';response.setEncoding('utf8');response.on('data',part=>text+=part);response.on('error',reject);
      response.on('end',()=>{if(response.statusCode<200||response.statusCode>=300){const error=Error('Zotero Connector 返回 '+response.statusCode);error.safeToRetry=[400,403,404,415].includes(response.statusCode);return reject(error);}try{resolve(text?JSON.parse(text):{});}catch{reject(Error('Zotero 返回格式不正确，请先检查是否已经保存。'));}});
    });
    request.setTimeout(60000,()=>request.destroy(Error('Zotero 保存超时，请先检查是否已经保存。')));
    request.on('error',error=>{error.safeToRetry=error.code==='ECONNREFUSED';reject(error);});request.end(bytes);
  });
}
function sourceURL(vault,paper){return 'obsidian://paper-library/'+encodeURIComponent(paper.split('/').at(-1))+'?vault='+encodeURIComponent(vault)+'&paper='+encodeURIComponent(paper);}
async function savePdf(plugin,paper,{send=connector,retryUncertain=false}={}){
 const file=plugin.app.vault.getAbstractFileByPath(paper);if(!file||file.extension.toLowerCase()!=='pdf')throw Error('请选择有效的 PDF。');
 const bytes=Buffer.from(await plugin.app.vault.readBinary(file)),hash=createHash('sha256').update(bytes).digest('hex');
 plugin.zoteroExportJobs||=new Map();if(plugin.zoteroExportJobs.has(hash))return plugin.zoteroExportJobs.get(hash);
 const task=(async()=>{
  plugin.settings.zoteroExports||={};plugin.settings.zoteroExportResults||={};let record=plugin.settings.zoteroExports[hash],started=false;
  if(record?.status==='saved'){plugin.settings.zoteroExportResults[paper]={hash,status:'saved'};await plugin.saveData(plugin.settings);return record;}
  if(record&&['uploading','uncertain'].includes(record.status)&&!retryUncertain)throw Error('上次 Zotero 保存结果待确认。请先在 Zotero 检查；确认未保存后，才能重新尝试。');
  try{
   const target=await send('getSelectedCollection',{switchToReadableLibrary:false});
   if(!target.editable||!target.libraryEditable||!target.filesEditable)throw Error('请先在 Zotero 选中可写且允许保存附件的文库或分类。');
   record={status:'uploading',sessionID:randomUUID(),url:sourceURL(plugin.app.vault.getName(),paper),paper,target:target.name||target.libraryName||'',startedAt:new Date().toISOString()};
   plugin.settings.zoteroExports[hash]=record;plugin.settings.zoteroExportResults[paper]={hash,status:'uploading'};await plugin.saveData(plugin.settings);
   started=true;
   const metadata=JSON.stringify({sessionID:record.sessionID,url:record.url,title:file.basename}).replace(/[^\x20-\x7E]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
   const result=await send('saveStandaloneAttachment',bytes,{'Content-Type':'application/pdf','X-Metadata':metadata});
   record.status='saved';record.canRecognize=Boolean(result.canRecognize);record.savedAt=new Date().toISOString();
   plugin.settings.zoteroExportResults[paper]={hash,status:'saved'};await plugin.saveData(plugin.settings);return record;
  }catch(error){
   const status=started&&!error.safeToRetry?'uncertain':'failed';
   if(record&&record.status!=='saved'){record.status=status;record.message=error.message;}
   plugin.settings.zoteroExportResults[paper]={hash,status,message:error.message};await plugin.saveData(plugin.settings);throw error;
  }
 })();plugin.zoteroExportJobs.set(hash,task);try{return await task;}finally{plugin.zoteroExportJobs.delete(hash);}
}
module.exports={connector,sourceURL,savePdf};
