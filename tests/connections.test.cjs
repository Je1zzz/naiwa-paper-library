const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(__dirname,'../src');
function fixture({codex=false,config=null,zotero=true,ownKey=false}={}){
 const api={Plugin:class{},ItemView:class{},PluginSettingTab:class{}},keys=new Map(ownKey?[['paper-library-openrouter','own-test-key']]:[]),saves=[];
 const sandbox={module:{exports:{}},crypto,URL,process,setTimeout,clearTimeout,console,require:name=>{
  if(name==='obsidian')return api;
  if(name==='./codex')return {status:async()=>({installed:codex,loggedIn:codex,models:codex?[{model:'gpt-6.1-sol',efforts:['low','medium']}]:[]})};
  if(name==='node:os')return {...require(name),homedir:()=>path.resolve('test-home')};
  if(name==='node:fs')return {...fs,existsSync:()=>!!config,readFileSync:()=>{if(!config)throw Error('not installed');return JSON.stringify(config);}};
  return require(name.startsWith('node:')?name:path.join(source,name));
 }};
 vm.runInNewContext(fs.readFileSync(path.join(source,'plugin.js'),'utf8'),sandbox);
 const plugin=new sandbox.module.exports();plugin.settings={provider:ownKey?'openrouter':'deepseek',models:{deepseek:'default',openrouter:'own-model'},endpoints:ownKey?{openrouter:'https://own.example/v1/chat/completions'}:{}};
 plugin.app={secretStorage:{getSecret:id=>keys.get(id)},workspace:{getLeavesOfType:()=>[]}};
 plugin.saveData=async data=>saves.push(JSON.stringify(data));plugin.zotero=async()=>{if(!zotero)throw Error('unavailable');return [];};
 return {plugin,saves};
}
const config={defaultProvider:'openrouter',providers:{deepseek:{adapter:'openai-chat',apiKey:'external-test-key',baseUrl:'https://api.deepseek.com',defaultModel:'ds-model',models:['ds-model']},openrouter:{adapter:'openai-chat',apiKey:'external-test-key',baseUrl:'https://openrouter.ai/api/v1',defaultModel:'or-model',models:['or-model','or-second']},openai:{adapter:'openai-responses',baseUrl:'https://api.openai.com/v1'}}};
test('fresh install discovers OpenCodex providers even after Codex automatically connects',async()=>{
 const {plugin,saves}=fixture({codex:true,config});const result=await plugin.detectConnections();
 assert.equal(plugin.settings.provider,'codex');assert.deepEqual(Array.from(result.opencodex.linkedProviders),['deepseek','openrouter']);assert.equal(result.zotero.available,true);
 assert.deepEqual(Array.from(plugin.bridge().getSettings().configuredProviders),['codex','deepseek','openrouter']);assert.ok(saves.every(s=>!s.includes('external-test-key')));
});
test('OpenCodex-only install selects its supported default provider and retains user model on recheck',async()=>{
 const {plugin}=fixture({config});await plugin.detectConnections();assert.equal(plugin.settings.provider,'openrouter');assert.equal(plugin.bridge().getSettings().hasKey,true);
 plugin.settings.models.openrouter='or-second';await plugin.detectConnections();assert.equal(plugin.settings.models.openrouter,'or-second');
});
test('existing local key, endpoint, model and selection survive automatic discovery',async()=>{
 const {plugin}=fixture({config,codex:true,ownKey:true});await plugin.detectConnections();assert.equal(plugin.settings.provider,'openrouter');assert.equal(plugin.settings.models.openrouter,'own-model');assert.equal(plugin.settings.endpoints.openrouter,'https://own.example/v1/chat/completions');assert.deepEqual(Array.from(plugin.settings.openCodexLinkedProviders),['deepseek']);
});
test('no external applications is a usable disconnected state without fabricated readiness',async()=>{
 const {plugin}=fixture({zotero:false});const result=await plugin.detectConnections();assert.equal(result.zotero.available,false);assert.equal(result.opencodex.installed,false);assert.equal(result.codex.loggedIn,false);assert.equal(result.ai.available,false);
});
