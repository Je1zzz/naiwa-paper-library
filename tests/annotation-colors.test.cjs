const {test}=require('node:test'),assert=require('node:assert/strict'),N=require('../src/notebook');
test('coloured quote survives repeated annotation saves without leaking callout syntax into PDF quote',()=>{
 for(const color of ['yellow','red','green','blue','purple','pink','orange','gray']){
 const note={id:color,kind:'highlight',color,quote:'Original\nSecond line',body:'My comment'};
 const source=N.blockFor(note);assert.ok(source.includes('> [!paper-'+color+']'));
 const read=N.blocks(source,'test.md')[0];assert.equal(read.quote,note.quote);assert.equal(read.body,note.body);
 assert.equal(N.blockFor(read).includes('> [!paper-'+color+']'),true);
 }
});
