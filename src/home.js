const WebImport=require('./web-import');
const Appearance=require('./appearance');
async function createHome(root, bridge) {
  const doc = root.ownerDocument;
  const metricLabel=t=>(t.type==='CCF'?'CCF-'+t.value:t.type==='CAS'?'中科院 '+t.value:t.type+' '+t.value)+' · '+t.year;
  root.classList.add('pl', 'pl-home');
  let data, query = '', folder = '', label = '', tab = 'library', sort = 'recent', closed = false;
  const el = (tag, cls, text, parent) => { const n=doc.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text;parent?.append(n);return n; };
  const button = (label,parent,action,cls='') => {const b=el('button','pl-btn '+cls,label,parent);b.type='button';b.onclick=()=>Promise.resolve().then(action).catch(e=>bridge.notice(e.message));return b;};
  const shell=el('div','pl-home-shell',undefined,root),nav=el('header','pl-home-nav',undefined,shell);
  const identity=el('div','pl-home-identity',undefined,nav),logo=el('img','pl-home-frog',undefined,identity);logo.src=bridge.brandUrl();logo.alt='阅读图标';
  el('strong','','Paper Library',identity);
  const navigation=el('nav','pl-home-navigation',undefined,nav);navigation.setAttribute('aria-label','首页导航');
  const main=el('main','pl-home-main',undefined,shell),header=el('header','pl-home-header',undefined,main),words=el('div','',undefined,header),title=el('h1','','文献',words),subtitle=el('p','pl-muted','',words),actions=el('div','pl-home-actions',undefined,header);
  const fileInput=el('input','pl-hidden',undefined,root);fileInput.type='file';fileInput.multiple=true;fileInput.accept='.pdf,application/pdf';
  const importButton=button('导入 PDF',actions,()=>fileInput.click());
  button('Zotero 导入',actions,zoteroDialog);if(bridge.inspectWeb)button('网页导入',actions,()=>WebImport.dialog(root,bridge));button('新建分类',actions,folderDialog);if(bridge.getAppearance)button('外观',actions,()=>Appearance.dialog(root,bridge));
  const content=el('section','pl-home-content',undefined,main);
  fileInput.onchange=async()=>{importButton.disabled=true;try{for(const file of fileInput.files)await bridge.importPdf(file.name,await file.arrayBuffer(),folder||'文献');await refresh();}catch(e){bridge.notice(e.message);}finally{fileInput.value='';importButton.disabled=false;}};
  function optionSelect(label,options,value,parent,change){const s=el('select','pl-select',undefined,parent);s.setAttribute('aria-label',label);for(const [key,text]of Object.entries(options)){const o=el('option','',text,s);o.value=key;}s.value=value;s.onchange=()=>Promise.resolve(change(s.value)).catch(e=>bridge.notice(e.message));return s;}
  async function refresh(){data=await bridge.libraryData();if(!closed)render();}
  function render(){
    navigation.replaceChildren();
    for(const [id,name]of [['library','文献'],['labels','Label'],['folders','文件夹'],['board','阅读'],['graph','Graph']])button(name,navigation,()=>{tab=id;if(id==='library'){folder='';label='';}render();},tab===id?'is-active':'');
    title.textContent=tab==='library'?(label?'Label · '+label:folder?'文件夹 · '+folder.replace(/^文献\/?/,''):'文献'):tab==='labels'?'Label':tab==='folders'?'文件夹':tab==='board'?'阅读记录':'Graph';
    subtitle.textContent=tab==='library'?`${data.papers.length} 篇文献 · ${data.papers.filter(p=>(p.statusValues||[p.status]).includes('done')).length} 篇已读` :tab==='labels'?'选择标签，查看对应的文献。':tab==='folders'?'按文件夹整理文献。':tab==='board'?'实际访问记录与手动阅读状态。':'文件夹归属与真实笔记链接。';
    content.replaceChildren();if(tab==='library')renderLibrary();else if(tab==='labels')renderLabels();else if(tab==='folders')renderFolders();else if(tab==='board')renderBoard();else renderGraph();
  }
  function renderLabels(){
    const counts=new Map();for(const paper of data.papers)for(const tag of new Set(paper.labels||[]))counts.set(tag,(counts.get(tag)||0)+1);
    const cloud=el('div','pl-home-label-cloud',undefined,content);
    for(const [tag,count]of [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))){const chip=button(`${tag}  ${count}`,cloud,()=>{label=tag;folder='';tab='library';render();},'pl-label-filter');chip.style.backgroundColor=data.labelColors?.[tag]||'#edf2e8';{const c=chip.style.backgroundColor.match(/\d+/g);chip.style.color=c&&Number(c[0])*.299+Number(c[1])*.587+Number(c[2])*.114<145?'#fff':'#28382d';}}
    if(!counts.size)el('p','pl-home-empty','还没有 Label。在阅读器的 Label 栏添加；Zotero 标签也会作为初始 Label 导入。',content);
  }
  function renderFolders(){
    const cloud=el('div','pl-home-label-cloud',undefined,content);
    for(const path of data.folders){const count=data.papers.filter(p=>p.folder===path||p.folder.startsWith(path+'/')).length;button(`${path.replace(/^文献\/?/,'')||'文献'}  ${count}`,cloud,()=>{folder=path;label='';tab='library';render();});}
  }
  function renderLibrary(){
    const tools=el('div','pl-home-tools',undefined,content),search=el('input','pl-input',undefined,tools);search.placeholder='搜索标题、作者、Label…';search.setAttribute('aria-label','搜索文献库');search.value=query;
    search.oninput=()=>{query=search.value;renderRows(list);};
    optionSelect('文献排序',{recent:'最近阅读',title:'标题',year:'年份',rating:'Rating',added:'最近导入'},sort,tools,value=>{sort=value;renderRows(list);});
    if(label||folder)button('清除筛选',tools,()=>{label='';folder='';render();});
    const integration=bridge.getIntegrations?.();if(integration){const status=el('div','pl-connection-status',undefined,content);el('span','',integration.checkedAt?[(integration.zotero?.available?'Zotero 已连接':'Zotero 未连接'),(integration.ai?.available?'AI 已连接 · '+integration.ai.provider:'AI 待连接'),integration.opencodex?.linkedProviders?.length?'OpenCodex 已关联 '+integration.opencodex.linkedProviders.length+' 个供应商':integration.opencodex?.installed?'OpenCodex 配置已检测':null].filter(Boolean).join(' · '):'正在检测本机连接…',status);button('重新检测',status,async()=>{await bridge.detectConnections();await refresh();});}
    const list=el('div','pl-home-table',undefined,content);renderRows(list);
  }
  function renderRows(list){
    list.replaceChildren();
    const found=data.papers.filter(p=>(!folder||p.folder===folder||p.folder.startsWith(folder+'/'))&&(!label||(p.labels||[]).includes(label))&&[p.title,p.authors,p.firstAuthor,p.correspondingAuthor,p.folder,...(p.labels||[])].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()));
    found.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='year'?Number(b.year||0)-Number(a.year||0):sort==='rating'?(a.ratingValues||[]).map(id=>data.ratingOptions?.find(o=>o.id===id)?.name||'').join(' ').localeCompare((b.ratingValues||[]).map(id=>data.ratingOptions?.find(o=>o.id===id)?.name||'').join(' ')):sort==='added'?b.added-a.added:String(b.lastOpened||'').localeCompare(String(a.lastOpened||'')));
    const table=el('table','pl-paper-table',undefined,list),head=el('thead','',undefined,table),heading=el('tr','',undefined,head);
    for(const name of ['阅读状态','通讯作者 / 第一单位','年份','标题','期刊 / 会议','期刊标签','Rating','Label'])el('th','',name,heading);
    const rows=el('tbody','',undefined,table);
    for(const paper of found){
      const row=el('tr','pl-home-paper',undefined,rows),markerCell=el('td','pl-table-marker',undefined,row);
      for(const id of paper.statusValues||[paper.status]){const option=data.statusOptions?.find(o=>o.id===id);if(!option)continue;const chip=button(option.name,markerCell,()=>bridge.openPaper(paper.path,'status'),'pl-paper-label');chip.style.backgroundColor=option.color||'#edf2e8';chip.setAttribute('aria-label','阅读状态：'+option.name);}
      if(!markerCell.children.length)button('—',markerCell,()=>bridge.openPaper(paper.path,'status'),'pl-text-btn');
      const authors=el('td','pl-table-authors',undefined,row);el('span','pl-corresponding-author',paper.correspondingAuthor||'—',authors);el('small','pl-corresponding-affiliation',paper.correspondingAffiliationZh||'—',authors);authors.title='通讯作者：'+(paper.correspondingAuthor||'待提取')+'\n第一通讯单位：'+(paper.correspondingAffiliationZh||'待提取');
      el('td','pl-table-year',String(paper.year||'—'),row);
      const titleCell=el('td','pl-table-title',undefined,row),open=button(paper.title,titleCell,()=>bridge.openPaper(paper.path),'pl-home-paper-title');open.title=paper.title;
      const venue=el('td','pl-table-venue',paper.venue||'—',row);venue.title=paper.venue||'';
      const metricCell=el('td','pl-table-metrics',undefined,row);for(const tag of paper.venueMetrics||[]){const chip=el('a','pl-venue-tag is-'+tag.type.toLowerCase(),metricLabel(tag),metricCell);chip.href=tag.url;chip.target='_blank';chip.rel='noopener noreferrer';chip.title=[tag.category,tag.quote,'来源：'+tag.url].filter(Boolean).join('\n');}
      if(paper.venue&&bridge.searchVenueMetrics){const lookup=button(paper.venueLookup?.status==='unavailable'?'暂未查到 · 重试':paper.venueMetrics?.length?'↻':'AI 检索',metricCell,async()=>{lookup.disabled=true;lookup.textContent='检索中…';try{await bridge.searchVenueMetrics(paper.path,true);await refresh();}finally{if(lookup.isConnected){lookup.disabled=false;lookup.textContent='AI 检索';}}},'pl-metric-lookup');lookup.setAttribute('aria-label','检索期刊评级：'+paper.venue);}
      const ratingCell=el('td','pl-table-rating',undefined,row);for(const id of paper.ratingValues||[]){const option=data.ratingOptions?.find(o=>o.id===id);if(option){const chip=button(option.name,ratingCell,()=>bridge.openPaper(paper.path,'rating'),'pl-paper-label');chip.style.backgroundColor=option.color||'#edf2e8';const c=chip.style.backgroundColor.match(/\d+/g);chip.style.color=c&&Number(c[0])*.299+Number(c[1])*.587+Number(c[2])*.114<145?'#fff':'#28382d';}}if(!ratingCell.children.length)button('—',ratingCell,()=>bridge.openPaper(paper.path,'rating'),'pl-text-btn');
      const tags=el('td','pl-table-labels',undefined,row);for(const tag of paper.labels||[]){const chip=button(tag,tags,()=>{label=tag;folder='';tab='library';render();},'pl-paper-label');chip.style.backgroundColor=data.labelColors?.[tag]||'#edf2e8';chip.style.color='#28382d';}
    }
    el('p','pl-home-result-count',`${found.length} 篇`,list);
    if(!found.length)el('div','pl-home-empty',query||label?'没有匹配的文献。':'还没有文献，导入 PDF 或从 Zotero 选择附件。',list);
  }
  function renderBoard(){
    const top=el('div','pl-home-board-heading',undefined,content);el('h2','','最近 90 天的阅读访问',top);el('p','pl-muted','格子记录访问过的文献数量，不代表已读完或阅读时长。',top);
    const calendar=el('div','pl-home-calendar',undefined,content),now=new Date();
    for(let offset=89;offset>=0;offset--){const date=new Date(now);date.setDate(now.getDate()-offset);const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,count=(data.activity[key]||[]).length,cell=el('div','pl-home-day',undefined,calendar);cell.dataset.level=String(Math.min(4,count));cell.title=`${key} · 访问 ${count} 篇文献`;}
    const columns=el('div','pl-home-board-columns',undefined,content);
    for(const [status,label]of (data.statusOptions||[{id:'unread',name:'待阅读'},{id:'reading',name:'阅读中'},{id:'done',name:'已读'}]).map(o=>[o.id,o.name])){const col=el('section','pl-home-board-column',undefined,columns);const papers=data.papers.filter(p=>(p.statusValues||[p.status]).includes(status));el('h3','',`${label} · ${papers.length}`,col);for(const p of papers){const card=el('div','pl-home-board-card',undefined,col);button(p.title,card,()=>bridge.openPaper(p.path));el('small','pl-muted',p.lastOpened?new Date(p.lastOpened).toLocaleDateString():'尚未打开',card);optionSelect('更改阅读状态：'+p.title,Object.fromEntries((data.statusOptions||[{id:'unread',name:'未读'},{id:'reading',name:'阅读中'},{id:'done',name:'已读'}]).map(o=>[o.id,o.name])),status,card,async value=>{await bridge.setReadingStatus(p.path,value);await refresh();});}}
  }
  function renderGraph(){
    const tools=el('div','pl-home-tools',undefined,content);el('p','pl-muted','实线：文件夹归属；虚线：笔记中的真实 wikilinks。',tools);button('打开 Obsidian 全局 Graph',tools,()=>bridge.openGraph());
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 650');svg.classList.add('pl-home-graph');svg.setAttribute('role','img');svg.setAttribute('aria-label','文献文件夹与笔记关系图');content.append(svg);
    const papers=data.papers.slice(0,80),nodes=[...data.folders.filter(f=>papers.some(p=>p.folder===f)).map(f=>({id:'folder:'+f,label:f.replace(/^文献\/?/,'')||'文献',folder:true})),...papers.map(p=>({id:p.path,label:p.title,paper:p}))];
    const positions=new Map(nodes.map((n,i)=>{const a=2*Math.PI*i/Math.max(1,nodes.length),r=n.folder?150:265;return[n.id,{x:500+Math.cos(a)*r,y:325+Math.sin(a)*r,node:n}];}));
    const line=(a,b,dashed=false)=>{const from=positions.get(a),to=positions.get(b);if(!from||!to)return;const l=doc.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:from.x,y1:from.y,x2:to.x,y2:to.y}))l.setAttribute(k,String(v));l.setAttribute('class',dashed?'pl-home-edge is-link':'pl-home-edge');svg.append(l);};
    for(const paper of papers)line('folder:'+paper.folder,paper.path);
    for(const [a,b]of data.links)line(a,b,true);
    for(const {x,y,node}of positions.values()){const group=doc.createElementNS(svg.namespaceURI,'g');group.setAttribute('transform',`translate(${x},${y})`);group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',node.label);group.onclick=()=>{if(node.folder){folder=node.id.slice(7);tab='library';render();}else bridge.openPaper(node.id);};group.onkeydown=e=>{if(e.key==='Enter')group.onclick();};const circle=doc.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('r',node.folder?'13':'8');circle.setAttribute('class',node.folder?'pl-home-folder-node':'pl-home-paper-node');group.append(circle);const label=doc.createElementNS(svg.namespaceURI,'text');label.setAttribute('y','25');label.setAttribute('text-anchor','middle');label.textContent=node.label.length>26?node.label.slice(0,25)+'…':node.label;group.append(label);const title=doc.createElementNS(svg.namespaceURI,'title');title.textContent=node.label;group.append(title);svg.append(group);}
    if(data.papers.length>80)el('p','pl-muted','预览展示前 80 篇；全量关联请打开 Obsidian Graph。',content);
  }
  function dialog(title){const overlay=el('div','pl-modal-overlay',undefined,root),box=el('section','pl-modal',undefined,overlay);box.setAttribute('role','dialog');box.setAttribute('aria-label',title);const header=el('div','pl-modal-heading',undefined,box);el('h3','',title,header);button('×',header,()=>overlay.remove());return{box,close:()=>overlay.remove()};}
  function folderDialog(){const {box,close}=dialog('新建文件夹分类');el('label','pl-field-label','分类名称',box);const field=el('input','pl-input',undefined,box);field.placeholder='例如：肿瘤／宫颈癌';field.setAttribute('aria-label','分类名称');const actions=el('div','pl-modal-actions',undefined,box);button('取消',actions,close);const submit=button('创建分类',actions,async()=>{if(!field.value.trim())return bridge.notice('请输入分类名称');submit.disabled=true;try{await bridge.createCategory(field.value);close();await refresh();}finally{submit.disabled=false;}},'pl-primary');field.addEventListener('keydown',e=>{if(e.key==='Enter')submit.click();if(e.key==='Escape')close();});field.focus();}
  async function zoteroDialog(){const {box,close}=dialog('从 Zotero 选择 PDF'),search=el('input','pl-input',undefined,box),results=el('div','pl-zotero-results',undefined,box);search.placeholder='论文标题、作者或关键词';search.setAttribute('aria-label','搜索 Zotero');button('搜索',box,async()=>{results.textContent='搜索中…';const items=await bridge.searchZotero(search.value);results.replaceChildren();for(const item of items.filter(i=>!['attachment','note'].includes(i.data.itemType)))button(item.data.title||item.key,results,async()=>{const attachments=await bridge.listZoteroPdfs(item);results.replaceChildren();el('p','','勾选要导入的 PDF：',results);const choices=attachments.map(a=>{const label=el('label','pl-attachment-choice',undefined,results),check=el('input','',undefined,label);check.type='checkbox';check.checked=attachments.length===1;el('span','',a.data.title||a.data.filename||a.key,label);return{a,check};});if(!choices.length)return el('p','','该条目没有可读取的本地 PDF。',results);button('导入选中的 PDF',results,async()=>{const selected=choices.filter(c=>c.check.checked);if(!selected.length)return bridge.notice('请选择至少一个 PDF');for(const{a}of selected)await bridge.importZotero(item,a.key);close();await refresh();},'pl-primary');},'pl-zotero-result');if(!items.length)results.textContent='没有找到匹配文献。';});search.focus();}
  await refresh();
  return {refresh,destroy(){closed=true;root.replaceChildren();}};
}
module.exports={createHome};

// Distribution-only accessible fallback for a missing brand asset.
const distributionCreateHome = createHome;
createHome = async function(root, bridge) {
  const fallback = event => { const image = event.target; if (image?.tagName === "IMG" && /(?:pl-home-frog|pl-home-logo)/.test(image.className)) { const label = root.ownerDocument.createElement("span"); label.textContent = "阅读"; label.setAttribute("aria-label", "阅读图标"); image.replaceWith(label); } };
  root.addEventListener("error", fallback, true);
  const view = await distributionCreateHome(root, bridge);
  const destroy = view?.destroy; if(view) view.destroy = function(...args) { root.removeEventListener("error", fallback, true); return destroy?.apply(this, args); };
  return view;
};
module.exports.createHome = createHome;
