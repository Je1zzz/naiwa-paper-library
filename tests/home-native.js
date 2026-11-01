// Run through Obsidian eval; uses synthetic library data and never changes user papers.
(async()=>{
 const base='D:/obsidian_house/github/naiwa-paper-library/',fs=require('node:fs');
 for(const name of ['home','web-import','import-category'])delete require.cache[require.resolve(base+'src/'+name+'.js')];
 const {createHome}=require(base+'src/home.js'),style=document.createElement('style');style.textContent=fs.readFileSync(base+'plugin/styles.css','utf8');document.head.append(style);
 const root=document.createElement('div');root.className='paper-library-host';root.style.cssText='position:fixed;inset:0;z-index:9999;';document.body.append(root);
 const results=[],notices=[],calls=[],paper={path:'文献/fixture.pdf',folder:'文献',title:'Synthetic paper',year:2026,status:'unread',labels:[]};let papers=[paper],connected=false;
 const bridge={sceneryUrl:()=>app.plugins.plugins['paper-library'].bridge({}).sceneryUrl(),brandUrl:()=>app.plugins.plugins['paper-library'].bridge({}).brandUrl(),notice:x=>notices.push(x),libraryData:async()=>({papers,folders:['文献','文献/已有分类'],activity:{},links:[]}),
  createCategory:async name=>{calls.push(['category',name]);return '文献/'+name;},importPdf:async(name,bytes,folder)=>calls.push(['pdf',name,folder]),
  openPaper:async path=>calls.push(['open',path]),deletePaper:async path=>{calls.push(['delete',path]);papers=[];},
  inspectWeb:async()=>({title:'Web fixture',pdfs:[{url:'https://example.com/p.pdf',label:'PDF'}]}),importWeb:async(_p,_u,folder)=>calls.push(['web',folder]),webBookmarklet:()=>'',openHome:async()=>{},
  searchZotero:async()=>[{key:'P',data:{title:'Zotero fixture',itemType:'journalArticle'}}],listZoteroPdfs:async()=>[{key:'A',data:{title:'Attachment'}}],importZotero:async(_p,_a,folder)=>calls.push(['zotero',folder]),
  getImportSettings:()=>({results:{},alsoSaveToZotero:false}),saveImportSettings:async()=>{},detectConnections:async()=>{},getZoteroSaveTarget:async()=>{if(!connected)throw Error('offline');return {name:'测试分类',editable:true,filesEditable:true};}};
 const ok=(v,m)=>{if(!v)throw Error(m);results.push(m);},tick=()=>new Promise(r=>setTimeout(r,30));
 const click=async(text,parent=root)=>{const b=[...parent.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('Missing button '+text);b.click();await tick();};
 const newCategory=name=>{const select=root.querySelector('[aria-label="导入分类"]');select.value='__new__';select.dispatchEvent(new Event('change'));root.querySelector('[aria-label="新分类名称"]').value=name;};
 const close=async()=>{await click('×',root.querySelector('.pl-modal'));};let home;
 try{
  home=await createHome(root,bridge);await tick();const shell=root.querySelector('.pl-home-shell');ok(shell.clientWidth>root.clientWidth*.9,'Library uses over 90% of the desktop width');ok(root.querySelectorAll('th').length===7&&!root.textContent.includes('期刊标签'),'Journal metric column removed');ok(root.querySelectorAll('.pl-home-actions button').length===1,'Single import entry');
  await click('导入 ▾');ok([...root.querySelectorAll('[role="menuitem"]')].map(x=>x.textContent).join('|')==='PDF 导入|网页导入|Zotero 导入|导入设置','Four import menu choices');
  await click('PDF 导入');newCategory('新分类');const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4 synthetic'],'test.pdf',{type:'application/pdf'}));root.querySelector('input[type=file]').files=transfer.files;await click('导入',root.querySelector('.pl-modal'));ok(calls.some(c=>c[0]==='pdf'&&c[2]==='文献/新分类'),'Local PDF can create and use a category');
  await click('导入 ▾');await click('网页导入');root.querySelector('[aria-label="网页或 PDF 链接"]').value='https://example.com/p.pdf';await click('解析链接');newCategory('网页分类');await click('导入选中的 PDF');ok(calls.some(c=>c[0]==='web'&&c[1]==='文献/网页分类'),'Web import can create and use a category');
  await click('导入 ▾');await click('Zotero 导入');newCategory('Zotero分类');await click('搜索');await click('Zotero fixture');await click('导入选中的 PDF');ok(calls.some(c=>c[0]==='zotero'&&c[1]==='文献/Zotero分类'),'Zotero import can create and use a category');
  await click('导入 ▾');await click('导入设置');await tick();ok(!root.querySelector('.pl-zotero-guide').hidden,'Disconnected Zotero shows connection steps');connected=true;await click('重新检测 Zotero');ok(root.querySelector('.pl-zotero-guide').hidden&&root.textContent.includes('当前 Zotero 位置：'),'Zotero recheck replaces guide with save target');await close();
  const row=root.querySelector('tbody tr');row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:150,clientY:210}));ok([...root.querySelectorAll('[role=menuitem]')].map(x=>x.textContent).join('|')==='打开|删除','Right click has open and delete');await click('打开');ok(calls.some(c=>c[0]==='open'),'Context open works');
  row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));await click('删除');await click('取消');ok(!calls.some(c=>c[0]==='delete'),'Cancel leaves paper intact');
  row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));await click('删除');await click('删除',root.querySelector('.pl-modal'));ok(calls.some(c=>c[0]==='delete')&&!root.querySelector('tbody tr'),'Delete refreshes the library');
  root.style.width='600px';await tick();ok(root.querySelector('.pl-home-shell').clientWidth<=600&&root.querySelector('.pl-home-table').scrollWidth>root.querySelector('.pl-home-table').clientWidth,'Narrow layouts scroll only the paper table');ok(!notices.some(x=>/Error|undefined/.test(x)),'No UI errors');
  return{passed:results.length,results};
 }finally{home?.destroy();root.remove();style.remove();}
})()
