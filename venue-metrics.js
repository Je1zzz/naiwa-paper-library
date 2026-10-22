const normalize=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const publishers=['nature.com','springer.com','springernature.com','wiley.com','sciencedirect.com','elsevier.com','sagepub.com','tandfonline.com','oup.com','ieee.org','acm.org','clarivate.com'];
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
   if(!body.includes(normalize(venue))||!body.includes(q)||!q.includes(normalize(value))||!q.includes(String(year)))continue;
   if(type==='IF'&&(!/journal impact factor/i.test(quote)||/5.year/i.test(quote)))continue;
   if(type==='JCR'&&!/JCR|Journal Citation Reports/i.test(text))continue;
   const tag={type,value,year,url:item.url,category:String(item.category||'').slice(0,120),quote,checkedAt:new Date().toISOString()};
   if(!tags.some(t=>t.type===type&&t.value===value&&t.year===year&&t.category===tag.category))tags.push(tag);
  }catch{/* Unreadable or nonmatching evidence stays unfilled. */}
 }
 // Keep the latest verified edition of each metric/category.
 return tags.filter(t=>!tags.some(o=>o.type===t.type&&o.category===t.category&&o.year>t.year));
}
async function lookup(venue,{research,read}){
 const prompt=`联网检索这个期刊/会议的最新公开评级：${JSON.stringify(venue)}。仅使用期刊出版社官方、Clarivate、ccf.org.cn、fenqubiao.com 的页面，不使用商业期刊聚合站。查 IF(两年 Journal Impact Factor)、JCR 分区、CCF A/B/C；中科院分区仅有官方公开证据才填。不同指标可以属于不同年度，但必须各自注明年度。没有官方证据的指标留空。不要把 SJR Q1 当 JCR Q1。先检索并打开相关官方页面，最多4次搜索和4次打开。只返回 JSON 对象 {"metrics":[{"type":"IF|JCR|CCF|CAS","value":"9.9|Q1|A|1区","year":2025,"category":"学科或空字符串","url":"https://官方原始页面","quote":"页面中包含指标名称、数值和年度的原文短句，至多25个英文词，不要拼接或改写"}]}。期刊名称在来源中必须完全匹配。CCF类别不得因为主题相近而猜测。不得读取本地文件，不得运行命令。`;
 const answer=(await research(prompt)).trim(),fence=String.fromCharCode(96).repeat(3),raw=answer.startsWith(fence)?answer.slice(answer.indexOf('\n')+1,answer.lastIndexOf(fence)).trim():answer,value=JSON.parse(raw);
 const tags=await verify(venue,value.metrics,read);
 if(!tags.some(t=>t.type==='CCF')&&/IEEE|ACM|conference|symposium|proceedings|^[A-Z][A-Z0-9-]{3,12}$/.test(venue))try{const ccf=await lookupCcf(venue,read);if(ccf)tags.push(ccf);}catch{}
 return tags;
}
function label(tag){return (tag.type==='CCF'?'CCF-'+tag.value:tag.type==='CAS'?'中科院 '+tag.value:tag.type+' '+tag.value)+' · '+tag.year;}
module.exports={lookup,verify,label,allowed,lookupCcf,ccfGrade};
