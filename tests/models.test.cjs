const {test}=require('node:test');
const assert=require('node:assert/strict');
const Models=require('../src/models');
test('model endpoint follows configured API and rejects insecure hosts',()=>{
 assert.equal(Models.endpoint('https://openrouter.ai/api/v1/chat/completions'),'https://openrouter.ai/api/v1/models');
 assert.equal(Models.endpoint('https://api.deepseek.com/chat/completions'),'https://api.deepseek.com/models');
 assert.equal(Models.endpoint('http://localhost:8000/v1/chat/completions'),'http://localhost:8000/v1/models');
 assert.throws(()=>Models.endpoint('http://external.invalid/v1/chat/completions'));
});
test('model catalogue retains names, pricing and actual efforts, excludes image-only output',()=>{
 const actual=Models.normalize({data:[{id:'text-free',name:'Free',pricing:{prompt:'0',completion:'0'},architecture:{output_modalities:['text']},supported_parameters:['reasoning']},{id:'deepseek',effort:{supported_levels:['low','high','max']}},{id:'image',output_modalities:['image']}]});
 assert.equal(actual.length,2);assert.equal(actual[0].free,true);assert.deepEqual(actual[1].efforts,['low','high','max']);assert.equal(actual[1].free,null);
 assert.throws(()=>Models.normalize({error:'bad'}));
});
