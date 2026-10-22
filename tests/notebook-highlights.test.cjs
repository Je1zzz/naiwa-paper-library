const {test}=require('node:test'),assert=require('node:assert/strict'),N=require('../notebook');
function legacy(note){return '<!-- paper-library:annotation '+JSON.stringify(note).replace(/\[/g,'\\u005b').replace(/\]/g,'\\u005d')+' -->\n### Highlight\n\n<!-- paper-library:body -->\ncomment\n<!-- paper-library:end -->';}
const base={id:'one',paper:'paper.pdf',kind:'highlight',page:1,rects:[{x:.1,y:.2,w:.3,h:.01}],quote:'A paper [with brackets]',color:'red',updated:'2026-10-22T01:00:00Z'};
test('legacy escaped rect arrays recover while bracket characters inside strings remain intact',()=>{
 const [note]=N.blocks(legacy(base),'note.md');assert.deepEqual(note.rects,base.rects);assert.equal(note.quote,base.quote);
});
test('legacy duplicate versions show newest colour and grouping preserves manual notes',()=>{
 const source='User notes\n'+legacy(base)+'\n'+legacy({...base,color:'blue',updated:'2026-10-22T02:00:00Z'});assert.equal(N.blocks(source,'')[0].color,'blue');assert.equal(N.blocks(source,'').length,1);assert.equal(N.blocks(source,'',{allVersions:true}).length,2);const grouped=N.group(source);assert.ok(grouped.startsWith('User notes'));assert.equal((grouped.match(/<!-- paper-library:annotation /g)||[]).length,1);
});
test('saving highlight keeps geometry outside readable Markdown and updates one annotation',async()=>{
 let source='User prose\n'+legacy(base)+'\n'+legacy({...base,color:'blue',updated:'2026-10-22T02:00:00Z'});const file={path:'note.md'},plugin={settings:{notePages:{'paper.pdf':'note.md'}},app:{vault:{getAbstractFileByPath:()=>file,process:async(_,fn)=>source=fn(source)}}};
 const note=N.blocks(source,file.path)[0];await N.save(plugin,{...note,color:'green',body:'my annotation'});const parsed=N.blocks(source,file.path,{records:plugin.settings.annotationRecords});assert.equal(parsed.length,1);assert.equal(parsed[0].color,'green');assert.deepEqual(parsed[0].rects,base.rects);assert.equal(parsed[0].body,'my annotation');const json=source.match(/<!-- paper-library:annotation (.*?) -->/)[1];assert.deepEqual(JSON.parse(json),{id:'one'});assert.deepEqual(plugin.settings.annotationRecords.one.rects,base.rects);assert.ok(source.includes('User prose'));
});
