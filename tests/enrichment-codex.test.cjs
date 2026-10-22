'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),vm=require('node:vm'),fs=require('node:fs');
function mockCodex(events){
  const calls=[],timers=[],module={exports:{}};
  const spawn=(command,args)=>{calls.push(args);const child=new EventEmitter();child.kill=()=>{};child.stdout=new EventEmitter();child.stdout.setEncoding=()=>{};child.stderr=new EventEmitter();child.stderr.setEncoding=()=>{};child.stdin=new EventEmitter();child.stdin.end=()=>queueMicrotask(()=>{child.stdout.emit('data',args[0]==='login'?'Logged in using ChatGPT':events.map(e=>JSON.stringify(e)).join('\n'));child.emit('close',0);});return child;};
  vm.runInNewContext(fs.readFileSync(require.resolve('../codex'),'utf8'),{require:name=>name==='node:child_process'?{spawn}:name==='node:fs'?{readFileSync:()=>'{"command":"mock-codex"}',mkdirSync:()=>{}}:require(name),module,process:{env:{}},setTimeout:(fn,ms)=>{timers.push(ms);return 0;},clearTimeout:()=>{}});
  return {api:module.exports,calls,timers};
}
test('Codex handles final JSONL event without newline; chat timeout is 600s',async()=>{
  const {api,calls,timers}=mockCodex([{type:'item.completed',item:{type:'agent_message',text:'answer'}}]);assert.equal(await api.chat({model:'gpt-6.1-sol'},[{role:'user',content:'hi'}]),'answer');assert.ok(timers.includes(600000));assert.ok(calls[1].includes('web_search="disabled"'));
});
test('Codex research enables live web, keeps 180s and accepts web_search events',async()=>{
  const {api,calls,timers}=mockCodex([{type:'item.started',item:{type:'web_search'}},{type:'item.completed',item:{type:'agent_message',text:'{}'}}]);assert.equal(await api.research({model:'gpt-6.1-sol'},'public metadata'),'{}');assert.ok(calls[1].includes('web_search="live"'));assert.ok(timers.includes(180000));
});
test('Codex research still blocks shell at completed event',async()=>{
  const {api}=mockCodex([{type:'item.completed',item:{type:'command_execution'}}]);await assert.rejects(api.research({model:'gpt-6.1-sol'},'query'),/未允许的工具/);
});
