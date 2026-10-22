const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pluginDir = path.resolve(__dirname, '../src');
const Core = require(path.join(pluginDir, 'core.js'));
function fixture() {
  let captured, saved, response = { status: 200, json: { choices: [{ message: { content: '模拟回答' } }] } };
  const keys = new Map();
  const api = { Plugin: class {}, ItemView: class {}, PluginSettingTab: class {},
    requestUrl: async req => { captured = req; if (response instanceof Error) throw response; return response; } };
  const sandbox = { module: { exports: {} }, require: name => name === 'obsidian' ? api : require(name.startsWith('node:') ? name : path.join(pluginDir, name)), crypto, URL, setTimeout, clearTimeout, console };
  vm.runInNewContext(fs.readFileSync(path.join(pluginDir, 'plugin.js'), 'utf8'), sandbox, { filename: 'plugin.js' });
  const plugin = new sandbox.module.exports();
  plugin.settings = { provider: 'deepseek', models: { deepseek: 'deepseek-v4-flash', openrouter: 'openrouter/auto' } };
  plugin.app = { secretStorage: { setSecret: (id, key) => keys.set(id, key), getSecret: id => keys.get(id) } };
  plugin.saveData = async data => { saved = JSON.parse(JSON.stringify(data)); };
  return { bridge: plugin.bridge(), setResponse: r => response = r, captured: () => captured, saved: () => saved, keys };
}
test('DeepSeek: correct endpoint, bearer authentication, model and Unicode context', async () => {
  const f = fixture();
  await f.bridge.saveSettings({ provider: 'deepseek', model: 'deepseek-v4-flash', key: 'unit-test-only-deepseek' });
  const messages = [{ role: 'user', content: Core.makeContext('example.pdf', 2, '中文原文') }];
  assert.equal(await f.bridge.chat(f.bridge.getSettings(), messages), '模拟回答');
  assert.equal(f.captured().url, 'https://api.deepseek.com/chat/completions');
  assert.equal(f.captured().headers.Authorization, 'Bearer unit-test-only-deepseek');
  assert.deepEqual(JSON.parse(f.captured().body), { model: 'deepseek-v4-flash', messages, stream: false, max_tokens: 16384 });
  assert.ok(!JSON.stringify(f.saved()).includes('unit-test-only')); assert.ok(!JSON.stringify(f.bridge.getSettings()).includes('unit-test-only'));
});
test('OpenRouter uses its own credential and supports a custom model', async () => {
  const f = fixture();
  await f.bridge.saveSettings({ provider: 'deepseek', model: 'deepseek-v4-flash', key: 'unit-test-only-ds' });
  await f.bridge.saveSettings({ provider: 'openrouter', model: 'provider/custom-model', key: 'unit-test-only-or' });
  await f.bridge.chat(f.bridge.getSettings(), [{ role: 'user', content: 'Hello' }]);
  assert.equal(f.captured().url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(f.captured().headers.Authorization, 'Bearer unit-test-only-or');
  assert.equal(JSON.parse(f.captured().body).model, 'provider/custom-model');
  await f.bridge.saveSettings({ provider: 'deepseek', model: 'deepseek-v4-pro', key: '' });
  assert.equal(f.bridge.getSettings().hasKey, true);
  await f.bridge.clearKey('deepseek'); assert.equal(f.bridge.getSettings().hasKey, false);
  assert.equal(f.keys.get('paper-library-openrouter'), 'unit-test-only-or');
});
test('Missing credentials fail before a network request', async () => {
  const f = fixture(); await assert.rejects(f.bridge.chat(f.bridge.getSettings(), []), /密钥/); assert.equal(f.captured(), undefined);
});
test('API errors are actionable and never echo credential-bearing responses', async () => {
  const f = fixture(); await f.bridge.saveSettings({ provider: 'deepseek', model: 'deepseek-v4-flash', key: 'unit-test-secret' });
  for (const [status, match] of [[401, /密钥/], [402, /余额/], [429, /频繁/], [500, /500/]]) {
    f.setResponse({ status, json: { error: { message: 'unit-test-secret' } } });
    await assert.rejects(f.bridge.chat(f.bridge.getSettings(), []), e => match.test(e.message) && !e.message.includes('unit-test-secret'));
  }
  f.setResponse(new Error('unit-test-secret'));
  await assert.rejects(f.bridge.chat(f.bridge.getSettings(), []), /检查网络/);
});
test('Malformed or empty successful responses are rejected', () => {
  assert.throws(() => Core.responseText(200, {}), /未返回/);
  assert.throws(() => Core.responseText(200, { error: { message: 'rejected' } }), /失败/);
  assert.match(Core.responseText(200, { choices: [{ message: { content: 'answer' }, finish_reason: 'length' }] }), /长度限制/);
});
test('Normalized selection clips page edges and preserves subpixel positions', () => {
  const [r] = Core.rectsInPage([{ left: 90, right: 200, top: 120, bottom: 140, width: 110, height: 20 }], { left: 100, top: 100, right: 600, bottom: 800, width: 500, height: 700 });
  assert.equal(r.x, 0); assert.equal(r.w, .2); assert.equal(r.y, 20 / 700);
});

test('Reasoning controls map to provider-specific request fields', () => {
  const deepseek = Core.buildRequest({ provider: 'deepseek', model: 'configured-model', reasoning: 'high' }, []);
  assert.deepEqual(deepseek.body.thinking, { type: 'enabled' }); assert.equal(deepseek.body.reasoning_effort, 'high');
  const router = Core.buildRequest({ provider: 'openrouter', model: 'configured-model', reasoning: 'low' }, []);
  assert.deepEqual(router.body.reasoning, { effort: 'low' }); assert.equal(router.body.reasoning_effort, undefined);
  assert.equal(Core.buildRequest({ provider: 'deepseek', model: 'configured-model', reasoning: 'default' }, []).body.thinking, undefined);
});

test('Custom endpoint and model selection persist without removing a saved credential', async () => {
  const f = fixture(); await f.bridge.saveSettings({ provider: 'openrouter', model: 'first', key: 'unit-test-only-key' });
  await f.bridge.saveSettings({ provider: 'openrouter', model: 'second', reasoning: 'high', endpoint: 'http://127.0.0.1:10100/v1/chat/completions' });
  const settings = f.bridge.getSettings(); assert.equal(settings.hasKey, true); assert.equal(settings.reasoning, 'high');
  await f.bridge.chat(settings, []); assert.equal(f.captured().url, 'http://127.0.0.1:10100/v1/chat/completions');
  assert.equal(JSON.parse(f.captured().body).model, 'second');
  await assert.rejects(f.bridge.saveSettings({ provider: 'openrouter', model: 'second', endpoint: 'http://example.com/chat/completions' }), /HTTPS/);
});

test('Consolidated annotation parser accepts Windows CRLF and preserves body content', () => {
  const Notebook = require(path.join(pluginDir, 'notebook.js'));
  const source = '<!-- paper-library:annotation {"id":"one","page":2} -->\r\n### Annotation\r\n\r\n<!-- paper-library:body -->\r\nNative edit $&\r\n<!-- paper-library:end -->';
  const [note] = Notebook.blocks(source, 'article.md');
  assert.equal(note.body, 'Native edit $&'); assert.equal(note.id, 'one'); assert.equal(note._block, source);
});


test('Catalogue refresh uses configured endpoint, preserves current model and stores no key',async()=>{
 const f=fixture();await f.bridge.saveSettings({provider:'openrouter',model:'existing',key:'unit-test-only-router',endpoint:'https://openrouter.ai/api/v1/chat/completions'});
 f.setResponse({status:200,json:{data:[{id:'new',name:'New',pricing:{prompt:'0',completion:'0'}}]}});
 await f.bridge.refreshModels('openrouter');assert.equal(f.captured().url,'https://openrouter.ai/api/v1/models');assert.equal(f.bridge.getSettings().model,'existing');assert.equal(f.bridge.getSettings().catalogs.openrouter[0],'new');assert.ok(!JSON.stringify(f.saved()).includes('unit-test-only-router'));
});
test('First read claim prevents duplicate requests and persists completed result',async()=>{
 const f=fixture();assert.equal(await f.bridge.beginFirstRead('a.pdf'),true);assert.equal(await f.bridge.beginFirstRead('a.pdf'),false);await f.bridge.saveFirstRead('a.pdf',{status:'done',messages:[{role:'assistant',content:'summary'}]});assert.equal(f.bridge.getFirstRead('a.pdf').messages[0].content,'summary');
});
