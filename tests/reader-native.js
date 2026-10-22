(async()=>{
 const base=app.vault.adapter.getBasePath()+'/.obsidian/plugins/paper-library/';for(const name of ['reader','core'])delete require.cache[require.resolve(base+name+'.js')];
 const {createReader}=require(base+'reader.js'),Core=require(base+'core.js'),p=app.plugins.plugins['paper-library'],source=app.vault.getFiles().find(f=>f.extension==='pdf');if(!source)throw Error('No PDF for UI check');
 const root=document.createElement('div');root.style.cssText='position:fixed;inset:50px 20px 20px;z-index:9999;background:white';document.body.append(root);
 const results=[],notices=[],calls=[],first={},settings={provider:'openrouter',model:'test/text',models:{openrouter:'test/text',deepseek:'test/deep'},catalogs:{openrouter:['test/text','test/free']},modelDetails:{openrouter:[{id:'test/text',free:false},{id:'test/free',free:true}]},enabledModels:{},efforts:{},configuredProviders:['openrouter'],hasKey:true};
 const b={...p.bridge({}),listPapers:async()=>[{path:source.path,title:source.basename,size:source.stat.size}],readPdf:()=>app.vault.readBinary(source),readNotes:async()=>[],getMetadata:()=>null,libraryData:undefined,enrichMetadata:undefined,recordReading:()=>{},onPaperChange:()=>{},getSettings:()=>structuredClone(settings),getFirstRead:path=>first[path],beginFirstRead:async path=>{if(first[path])return false;first[path]={status:'pending',startedAt:Date.now()};return true;},saveFirstRead:async(path,value)=>first[path]=value,chat:async(s,m)=>{calls.push(m);return '首轮总结：动机、数据和模块结果。';},notice:m=>notices.push(m),saveSettings:async value=>Object.assign(settings,value),saveEnabledModels:async(id,values)=>settings.enabledModels[id]=values,refreshModels:async()=>settings.catalogs.openrouter};
 let r;const ok=(v,m)=>{if(!v)throw Error(m);results.push(m);},wait=async f=>{for(let i=0;i<300;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+notices.join(';'));};const click=t=>{const button=[...root.querySelectorAll('button')].find(x=>x.textContent.trim()===t);if(!button)throw Error('Missing '+t);button.click();};
 try{
 r=await createReader(root,b,window.pdfjsLib,Core);await r.openPaper(source.path);await wait(()=>first[source.path]?.status==='done');
 ok(calls.length===1,'First opening starts exactly one AI summary');ok(calls[0].at(-1).content.includes(Core.FIRST_READ_PROMPT),'Exact requested reading prompt sent');ok(calls[0][0].content.includes('[PDF 第 1 页]'),'Extracted PDF full text reaches summary');
 click('AI 对话');await wait(()=>root.querySelector('.pl-model-controls'));
 const selectors=[...root.querySelectorAll('.pl-model-controls select')];ok(selectors.length===3,'Provider model effort share one control group');const positions=selectors.map(x=>x.getBoundingClientRect());ok(positions.every(x=>Math.abs(x.top-positions[0].top)<2),'All three controls align on a single row');
 await r.openPaper(source.path);await new Promise(r=>setTimeout(r,250));ok(calls.length===1,'Reopen restores persisted summary without another request');
 click('API 设置');await wait(()=>root.querySelector('.pl-api-modal'));const search=root.querySelector('[aria-label="搜索可用模型"]');search.value='free';search.dispatchEvent(new Event('input'));ok(root.querySelectorAll('.pl-model-option').length===1,'Model manager filters supplier catalogue');
 root.querySelector('.pl-model-option input').click();click('保存设置');await wait(()=>!root.querySelector('.pl-api-modal'));ok(settings.enabledModels.openrouter.length===1&&settings.enabledModels.openrouter[0]==='test/text','Model visibility selections persist');
 return{passed:results.length,results,notices};
 }finally{r?.destroy();root.remove();}
})()

