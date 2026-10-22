const {test}=require('node:test'),assert=require('node:assert/strict');
const {EditorState,StateField,StateEffect}=require('@codemirror/state');
const {EditorView,Decoration}=require('@codemirror/view');
const {markerRanges,createNoteMarkers}=require('../src/note-markers');
const changeMode=StateEffect.define();
function setup(path='notes/paper.md',live=true){
 const editorInfoField=StateField.define({create:()=>({file:{path}}),update:v=>v});
 const editorLivePreviewField=StateField.define({create:()=>live,update:(v,tr)=>tr.effects.find(e=>e.is(changeMode))?.value??v});
 const extensions=createNoteMarkers({StateField,EditorView,Decoration,editorInfoField,editorLivePreviewField,isNote:p=>p==='notes/paper.md'});
 const doc='My own notes\n<!-- paper-library:annotations:start -->\n## 批注\n<!-- paper-library:annotation {"id":"a"} -->\n> Original text\n<!-- paper-library:body -->\nMy comment\n<!-- paper-library:end -->\n## 便笺\n<!-- paper-library:annotations:end -->';
 return {state:EditorState.create({doc,extensions:[editorInfoField,editorLivePreviewField,extensions]}),field:extensions[0],doc};
}
test('Live Preview hides anchors while preserving the stored Markdown and editable quote/body',()=>{
 const {state,field,doc}=setup(),hidden=state.field(field);assert.equal(hidden.size,5);assert.equal(state.doc.toString(),doc);
 let rendered='',last=0;hidden.between(0,doc.length,(from,to)=>{rendered+=doc.slice(last,from);last=to;});rendered+=doc.slice(last);
 assert.ok(!rendered.includes('paper-library:'));assert.ok(rendered.includes('> Original text\nMy comment'));assert.ok(rendered.includes('## 便笺'));
 const from=doc.indexOf('My comment'),next=state.update({changes:{from,to:from+10,insert:'Edited note'}}).state;
 assert.ok(next.doc.toString().includes('Edited note'));assert.equal(next.field(field).size,5);
 assert.equal(next.update({effects:changeMode.of(false)}).state.field(field).size,0);
});
test('source mode and unrelated notes retain all comment text',()=>{
 for(const item of [setup('notes/other.md'),setup('notes/paper.md',false)])assert.equal(item.state.field(item.field).size,0);
});
test('ordinary comments and fenced marker examples are never hidden',()=>{
 const text='<!-- my own comment -->\n```md\n<!-- paper-library:body -->\n```\n~~~\n<!-- paper-library:end -->\n~~~';
 const {state}=setup();assert.deepEqual(markerRanges(state.update({changes:{from:0,to:state.doc.length,insert:text}}).state.doc),[]);
});
