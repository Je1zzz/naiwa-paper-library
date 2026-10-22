// Run in Obsidian's developer eval with an article note open in Live Preview.
(async()=>{
 const p=app.plugins.plugins['paper-library'];
 const leaf=app.workspace.getLeavesOfType('markdown').find(l=>Object.values(p.settings.notePages||{}).includes(l.view.file?.path));
 if(!leaf)throw Error('Open an article note first');
 const state=leaf.getViewState(),before=leaf.view.editor.getValue(),file=leaf.view.file,results=[];
 const ok=(v,m)=>{if(!v)throw Error(m);results.push(m);};
 const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 try{
  await leaf.setViewState({...state,state:{...state.state,mode:'source',source:false}});await frame();
  ok(before.includes('<!-- paper-library:'),'Synchronization anchors remain in the document');
  ok(!leaf.view.contentEl.querySelector('.cm-content').textContent.includes('paper-library:'),'Live Preview hides internal anchors');
  ok(leaf.view.contentEl.querySelector('.cm-content').textContent.includes('批注'),'Human annotation heading remains visible');
  await leaf.setViewState({...state,state:{...state.state,mode:'source',source:true}});await frame();
  ok(leaf.view.contentEl.querySelector('.cm-content').textContent.includes('paper-library:'),'Source mode can inspect internal anchors');
  ok(leaf.view.editor.getValue()===before&&await app.vault.read(file)===before,'Switching modes leaves saved and editor Markdown unchanged');
 }finally{await leaf.setViewState(state);await frame();}
 return {passed:results.length,results};
})()
