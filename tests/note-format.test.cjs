const {test}=require('node:test'),assert=require('node:assert/strict'),N=require('../src/notebook'),F=require('../src/note-format');
test('human Markdown contains quote and comment, omits coordinates, translation, page links and generated headings',()=>{
 const note={id:'test',kind:'highlight',paper:'a.pdf',page:7,color:'red',rects:[{x:.1,y:.2,w:.3,h:.1}],translation:'automatic translation',body:'My own comment',quote:'Original text\nSecond line'};
 const source=N.group(N.blockFor(note),{test:F.record(note)});
 assert.ok(source.includes('> Original text\n> Second line'));assert.ok(source.includes('My own comment'));
 for(const text of ['rects','a.pdf','automatic translation','P7','返回第','划线批注'])assert.ok(!source.includes(text),text);
 const [read]=N.blocks(source,'note.md',{records:{test:F.record(note)}});assert.deepEqual(read.rects,note.rects);assert.equal(read.translation,note.translation);assert.equal(read.body,note.body);assert.equal(read.quote,note.quote);
});
test('sticky custom title and Markdown body survive reading and regrouping',()=>{
 const note={id:'sticky',kind:'sticky',title:'My title',body:'**My note**\n\n- One',paper:'a.pdf'},records={sticky:F.record(note)},source=N.group('Free notes above\n'+N.blockFor(note),records),again=N.group(source,records);
 assert.equal(source,again);assert.ok(source.startsWith('Free notes above'));const [read]=N.blocks(source,'',{records});assert.equal(read.title,'My title');assert.equal(read.body,note.body);
});
test('clean scaffold leaves user prose and annotation contents intact',()=>{
 const annotation='<!-- paper-library:annotations:start -->\n> quote\n# a\n在这里自由记录想法。\n';
 const cleaned=F.cleanProse('# a\n[打开文献](obsidian://paper-library?paper=a)\n## 阅读札记\n\nMy ideas\n'+annotation,'a.pdf');assert.ok(cleaned.includes('My ideas'));assert.ok(cleaned.endsWith(annotation));assert.ok(!cleaned.includes('[打开文献]'));
});
test('metadata keys cover generated fields while leaving custom properties alone',()=>{
 const keys=F.ownedKeys({firstAuthor:'Name',authorWarnings:[]});assert.ok(keys.has('first-author'));assert.ok(keys.has('authorWarnings'));assert.ok(!keys.has('my-custom-property'));assert.ok(!keys.has('tags'));
});
