function sourceUrl(input){
 let value=String(input||'').trim();if(/^10\.\d{4,9}\//.test(value))value='https://doi.org/'+value;
 let url;try{url=new URL(value);}catch{throw new Error('请输入网页、PDF、arXiv 链接或 DOI。');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('仅支持不含账号密码的 HTTP / HTTPS 链接。');
 if(url.hostname==='arxiv.org'&&url.pathname.startsWith('/abs/'))url.pathname=url.pathname.replace('/abs/','/pdf/');
 url.hash='';return url.href;
}
function isPdf(bytes){return new TextDecoder().decode(new Uint8Array(bytes).slice(0,1024)).includes('%PDF-');}
function bookmarklet(vault){const prefix='obsidian://paper-library?vault='+encodeURIComponent(vault)+'&action=web-import&url=';return 'javascript:'+encodeURIComponent('(()=>{location.href='+JSON.stringify(prefix)+'+encodeURIComponent(location.href)})()');}

async function inspect(input,request,parse){
 const url=sourceUrl(input),response=await request(url);if(response.status<200||response.status>=300)throw new Error('网页返回 '+response.status+'，请使用可公开访问的 PDF 或页面。');
 if(isPdf(response.arrayBuffer)){const filename=decodeURIComponent(new URL(url).pathname.split('/').pop()||'网页文献.pdf').replace(/\.pdf$/i,'');return{url,title:filename||'网页文献',pdfs:[{url,label:'PDF 全文'}],directBytes:response.arrayBuffer};}
 const doc=parse(response.text),meta=name=>doc.querySelector(`meta[name="${name}"],meta[property="${name}"]`)?.getAttribute('content')?.trim()||'';
 const title=meta('citation_title')||meta('og:title')||doc.querySelector('title')?.textContent?.trim()||'网页文献';
 const pdfs=[],add=(href,label)=>{try{const link=new URL(href,url);if(!['http:','https:'].includes(link.protocol)||link.username||link.password)return;if(!pdfs.some(p=>p.url===link.href))pdfs.push({url:link.href,label:label||'PDF 全文'});}catch{}};
 const primary=meta('citation_pdf_url')||meta('dc.relation.haspart');if(primary)add(primary,'论文全文 PDF');
 for(const a of doc.querySelectorAll('a[href]'))if(/\.pdf(?:$|[?#])|\/pdf\//i.test(a.getAttribute('href')))add(a.getAttribute('href'),a.textContent.trim().slice(0,100)||'PDF 附件');
 return{url,title,doi:meta('citation_doi'),year:meta('citation_publication_date').match(/\b(?:19|20)\d{2}\b/)?.[0]||'',venue:meta('citation_journal_title')||meta('citation_conference_title'),pdfs:pdfs.slice(0,12)};
}
async function dialog(root,bridge,initial=''){
 const doc=root.ownerDocument,overlay=doc.createElement('div');overlay.className='pl-modal-overlay';root.append(overlay);
 const box=doc.createElement('section');box.className='pl-modal pl-web-import';box.setAttribute('role','dialog');box.setAttribute('aria-label','从网页导入');overlay.append(box);
 const el=(tag,cls,text,parent=box)=>{const n=doc.createElement(tag);n.className=cls||'';if(text)n.textContent=text;parent.append(n);return n;};
 const close=()=>overlay.remove(),button=(text,parent,action,cls='')=>{const b=el('button','pl-btn '+cls,text,parent);b.onclick=()=>Promise.resolve().then(action).catch(e=>bridge.notice(e.message));return b;};
 const heading=el('div','pl-modal-heading');el('h3','','从网页导入',heading);button('×',heading,close);
 const field=el('input','pl-input');field.setAttribute('aria-label','网页或 PDF 链接');field.placeholder='粘贴网页、PDF、arXiv 链接或 DOI';field.value=initial;
 const result=el('div','pl-web-results'),actions=el('div','pl-modal-actions');
 const probe=button('解析链接',actions,async()=>{probe.disabled=true;result.textContent='正在查找 PDF…';try{const preview=await bridge.inspectWeb(field.value);result.replaceChildren();el('p','pl-web-title',preview.title,result);if(!preview.pdfs.length){el('p','pl-muted','这个页面未找到可下载 PDF。可使用出版社的 PDF 链接；需要登录的页面请先在浏览器下载。',result);return;}
 const choices=preview.pdfs.map((pdf,i)=>{const row=el('label','pl-attachment-choice','',result),check=el('input','','',row);check.type='checkbox';check.checked=i===0;el('span','',pdf.label,row);return{pdf,check};});
 const data=await bridge.libraryData(),folder=el('select','pl-select','',result);folder.setAttribute('aria-label','导入到文件夹');for(const path of data.folders){const option=el('option','',path,folder);option.value=path;}folder.value='文献';
 button('导入选中的 PDF',result,async()=>{const selected=choices.filter(c=>c.check.checked);if(!selected.length)return bridge.notice('请选择至少一个 PDF');const paths=[];for(const c of selected)paths.push(await bridge.importWeb(preview,c.pdf.url,folder.value));close();await bridge.openHome?.();bridge.notice('已导入 '+paths.length+' 篇文献');},'pl-primary');
 }catch(e){result.textContent=e.message;}finally{probe.disabled=false;}});
 button('复制浏览器导入书签',actions,async()=>{await doc.defaultView.navigator.clipboard.writeText(bridge.webBookmarklet());bridge.notice('书签代码已复制：新建浏览器书签，将网址替换为此代码；阅读网页时点击该书签即可导入。');});
 el('p','pl-small','在浏览器中点击导入书签，会把当前页面送到这里；也可直接粘贴链接。');
 field.addEventListener('keydown',e=>{if(e.key==='Enter')probe.click();});overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});field.focus();
 if(initial)probe.click();return{close};
}
module.exports={sourceUrl,isPdf,bookmarklet,inspect,dialog};
