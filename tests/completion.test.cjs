const {test}=require('node:test'),assert=require('node:assert/strict');
const {complete}=require('../completion');
const response=(content,finish_reason='stop')=>({status:200,json:{choices:[{message:{content},finish_reason}]}});
const settings={provider:'openrouter',model:'test',maxOutputTokens:16384};
test('length truncation continues with accumulated answer and preserves output budget',async()=>{
 const requests=[],responses=[response('part one','length'),response('part two')];
 const text=await complete(settings,[{role:'user',content:'read paper'}],async req=>{requests.push(JSON.parse(JSON.stringify(req)));return responses.shift();});
 assert.equal(text,'part one\n\npart two');assert.equal(requests.length,2);assert.equal(requests[0].body.max_tokens,16384);assert.equal(requests[1].body.messages.at(-2).content,'part one');
});
test('continuation is bounded and preserves text when a later request fails',async()=>{
 let count=0;const text=await complete(settings,[],async()=>{count++;return response('part','length');});assert.equal(count,4);assert.match(text,/继续回答/);
 count=0;const partial=await complete(settings,[],async()=>{if(++count===1)return response('retained','length');throw Error('network');});assert.match(partial,/retained/);assert.match(partial,/已保留/);
});
test('reasoning-only length exhaustion has an actionable error',async()=>{
 await assert.rejects(complete(settings,[],async()=>response('','length')),/提高回答上限或降低推理强度/);
});
