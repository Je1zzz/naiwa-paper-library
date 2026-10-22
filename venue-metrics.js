const normalize=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const evidenceText=s=>String(s||'').normalize('NFKC').replace(/\*\*|__/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const publishers=['nature.com','springer.com','springernature.com','wiley.com','sciencedirect.com','elsevier.com','sagepub.com','tandfonline.com','oup.com','ieee.org','acm.org','clarivate.com','biomedcentral.com','plos.org','frontiersin.org','mdpi.com','bmj.com','jamanetwork.com','nejm.org','cell.com','science.org','pnas.org','annualreviews.org'];
let catalogPromise;
function ccfGrade(text,venue){
 const body=normalize(text),name=String(venue).replace(/^proceedings of (?:the )?/i,'').replace(/\bIEEE(?:\/CVF)?\b|\bACM\b/gi,'').trim();
 const initials=s=>s.split(/[^a-zA-Z]+/).filter(w=>w&&!/^(on|of|the|and|in|for|a|an)$/i.test(w)).map(w=>w[0]).join('').toUpperCase();
 const candidates=[venue,initials(name),initials(name.replace(/^conference on /i,''))];
 const needle=candidates.find(s=>normalize(s).length>=4&&body.includes(normalize(s))&&(!/^[A-Z]+$/.test(s)||new RegExp('\\b'+s+'\\b').test(text)));
 if(!needle)return null;
 const index=body.indexOf(normalize(needle));
 const headings=[...body.slice(0,index).matchAll(/([abc])类/g)];
 return headings.at(-1)?.[1]?.toUpperCase()||null;
}
async function lookupCcf(venue,read){
 if(!catalogPromise)catalogPromise=(async()=>{
  const editionUrl='https://www.ccf.org.cn/Academic_Evaluation/By_category/',intro=await read(editionUrl);
  const url=intro.match(/https:\/\/www\.ccf\.org\.cn\/ccf\/contentcore\/resource\/download\?ID=[A-Fa-f0-9]+/)?.[0];
  const years=[...intro.matchAll(/(20\d{2})年/g)].map(m=>Number(m[1])).filter(y=>y<=new Date().getFullYear());
  if(!url||!years.length)throw new Error('CCF 官方目录无法读取');
  return{url,editionUrl,year:Math.max(...years),text:await read(url)};
 })().catch(e=>{catalogPromise=null;throw e;});
 const source=await catalogPromise,value=ccfGrade(source.text,venue);if(!value)return null;
 return{type:'CCF',value,year:source.year,url:source.url,editionUrl:source.editionUrl,category:'',quote:venue+' · '+value+' 类（官方目录表格）',checkedAt:new Date().toISOString()};
}
function allowed(type,url){try{const u=new URL(url);if(u.protocol!=='https:')return false;const hosts=type==='CCF'?['ccf.org.cn']:type==='CAS'?['fenqubiao.com']:publishers;return hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
function validValue(type,value){return type==='IF'?/^\d+(?:\.\d+)?$/.test(value):type==='JCR'?/^Q[1-4]$/.test(value):type==='CCF'?/^[ABC]$/.test(value):type==='CAS'?/^[1-4]区$/.test(value):false;}
async function verify(venue,items,read){
 const tags=[],pages=new Map();
 for(const item of (Array.isArray(items)?items:[]).slice(0,12)){
  const type=String(item.type||'').toUpperCase(),value=String(item.value||''),year=Number(item.year),quote=String(item.quote||'').trim();
  if(!validValue(type,value)||!Number.isInteger(year)||year<1990||year>new Date().getFullYear()||!allowed(type,item.url)||quote.length<8||quote.length>240)continue;
  try{if(!pages.has(item.url))pages.set(item.url,await read(item.url));const text=pages.get(item.url),body=normalize(text),q=normalize(quote);
   const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   if(!body.includes(normalize(venue))||!body.includes(q)||!evidenceText(text).includes(evidenceText(quote))||!new RegExp('(?<![\\d.])'+escaped+'(?![\\d.])','i').test(quote)||!new RegExp('\\b'+year+'\\b').test(quote))continue;
   if(type==='IF'&&(!/journal impact factor/i.test(quote)||/5.year/i.test(quote)))continue;
   if(type==='JCR'&&(!/JCR|Journal Citation Reports/i.test(quote)||/SJR|SCImago/i.test(quote)))continue;
   if(type==='CCF'&&!/CCF|类|category|rank/i.test(quote))continue;
   if(type==='CAS'&&!/中科院|Chinese Academy of Sciences/i.test(quote))continue;
   const tag={type,value,year,url:item.url,category:String(item.category||'').slice(0,120),quote,checkedAt:new Date().toISOString()};
   if(!tags.some(t=>t.type===type&&t.value===value&&t.year===year&&t.category===tag.category))tags.push(tag);
  }catch{/* Unreadable or nonmatching evidence stays unfilled. */}
 }
 // Keep the latest verified edition of each metric/category.
 return tags.filter(t=>!tags.some(o=>o.type===t.type&&o.category===t.category&&o.year>t.year));
}
async function lookup(venue,{research,read,chat,search,get,sourceUrls=[]}={}){
 if(typeof venue!=='string'||!venue.trim())throw new Error('请先补全文献的期刊或会议名称');
 if(typeof read!=='function')throw new Error('缺少期刊来源网页读取工具');
 const {parseJson,publicSearch}=require('./enrichment');
 const prompt=`联网检索这个期刊/会议的最新公开评级：${JSON.stringify(venue)}。仅使用期刊出版社官方、Clarivate、ccf.org.cn、fenqubiao.com 的页面，不使用商业期刊聚合站。查 IF(两年 Journal Impact Factor)、JCR 分区、CCF A/B/C；中科院分区仅有官方公开证据才填。不同指标可以属于不同年度，但必须各自注明年度。没有官方证据的指标留空。不要把 SJR Q1 当 JCR Q1。先检索并打开相关官方页面，最多4次搜索和4次打开。只返回 JSON 对象 {"metrics":[{"type":"IF|JCR|CCF|CAS","value":"9.9|Q1|A|1区","year":2025,"category":"学科或空字符串","url":"https://官方原始页面","quote":"页面中包含指标名称、数值和年度的原文短句，至多25个英文词，不要拼接或改写"}]}。期刊名称在来源中必须完全匹配。CCF类别不得因为主题相近而猜测。不得读取本地文件，不得运行命令。`;
 const cache=new Map(),errors=[];
 const readOnce=async url=>{if(!cache.has(url))cache.set(url,Promise.resolve().then(()=>read(url)));return cache.get(url);};
 if(research){
   try{const value=parseJson(await research(prompt));if(!Array.isArray(value.metrics))throw new Error('AI JSON 缺少 metrics 数组');const tags=await verify(venue,value.metrics,readOnce);if(tags.length)return tags;}
   catch(e){errors.push(e.message);}
 }
 // API chat models are given retrieved documents rather than being asked to
 // pretend they have a browser. No Codex account or model web-search feature needed.
 let urls=[...sourceUrls];
 // A matched Crossref work can lead to a publisher journal page even when a
 // public search engine is blocked. Never treat a different journal as a match.
 if(get&&!urls.length)try{
   const works=(await get('https://api.crossref.org/works?rows=2&query.container-title='+encodeURIComponent(venue))).message?.items||[];
   const work=works.find(w=>normalize(w['container-title']?.[0])===normalize(venue));
   const article=work?.resource?.primary?.URL;
   if(article&&allowed('IF',article)){
     const page=String(await readOnce(article));
     for(const match of page.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)){
       if(normalize(match[1])===normalize(venue)){
         const url=new URL(match[2]);
         if(url.hostname.endsWith('nature.com')&&/^\/[a-z0-9-]+\/?$/i.test(url.pathname))urls.push(url.href.replace(/\/$/,'')+'/journal-impact');
         else if(allowed('IF',url.href))urls.push(url.href);
       }
       if(/journal metrics|journal impact|about this journal/i.test(match[1])&&allowed('IF',match[2]))urls.push(match[2]);
     }
   }
 }catch(e){errors.push(e.message);}
 if(!urls.length)try{const found=await(search||((q)=>publicSearch(q,readOnce)))('"'+venue+'" official journal impact factor JCR metrics');urls.push(...(Array.isArray(found)?found:[]).map(v=>typeof v==='string'?v:v.url).filter(Boolean));}catch(e){errors.push(e.message);}
 urls=[...new Set(urls)].filter(url=>['IF','CCF','CAS'].some(type=>allowed(type,url))).slice(0,4);
 const pages=[];
 for(const url of urls){try{const text=String(await readOnce(url));if(normalize(text).includes(normalize(venue)))pages.push({url,text:text.slice(0,32000)});}catch(e){errors.push(e.message);}}
 if(!pages.length){const error=new Error('无法读取匹配期刊的官方来源，未生成评级'+(errors.length?'：'+errors.join('；'):''));error.code='VENUE_EVIDENCE_UNAVAILABLE';throw error;}
 const items=[];
 // Common publisher syntax is deterministic and does not need model tokens.
 for(const {url,text}of pages)for(const match of text.matchAll(/(?:^|\n)[^\n]{0,30}Journal Impact Factor[^\n]{0,130}/gi)){
   const quote=match[0].trim();if(/5.year/i.test(quote))continue;
   const metric=quote.match(/Journal Impact Factor\s*[:：]?\s*\*{0,2}(\d+(?:\.\d+)?)\s*\*{0,2}\s*\(?\s*(20\d{2})/i);
   if(metric)items.push({type:'IF',value:metric[1],year:Number(metric[2]),url,quote});
 }
 const deterministic=await verify(venue,items,readOnce);
 if(deterministic.length)return deterministic;
 if(chat){const answer=parseJson(await chat([{role:'system',content:prompt+' 本次已由应用联网，以下来源是实际读取的原始证据。仅从这些来源提取，不声称自己检索，不使用记忆补值。'}, {role:'user',content:JSON.stringify(pages)}]));if(!Array.isArray(answer.metrics))throw new Error('AI JSON 缺少 metrics 数组');items.push(...answer.metrics.filter(i=>pages.some(p=>p.url===i.url)));}
 return verify(venue,items,readOnce);
}
function label(tag){return (tag.type==='CCF'?'CCF-'+tag.value:tag.type==='CAS'?'中科院 '+tag.value:tag.type+' '+tag.value)+' · '+tag.year;}
module.exports={lookup,verify,label,allowed,lookupCcf,ccfGrade};
