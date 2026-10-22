// Accept only identifiers or close title matches; never infer a year from a DOI.
function normalized(s){return String(s||'').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function similarity(a,b){const x=new Set(normalized(a).split(' ')),y=new Set(normalized(b).split(' '));return [...x].filter(w=>y.has(w)).length/Math.max(x.size,y.size,1);}
function fromWork(w){const year=(w.published||w['published-print']||w['published-online'])?.['date-parts']?.[0]?.[0];return {title:w.title?.[0],year:year?String(year):'',venue:w['container-title']?.[0]||w.event?.name||'',doi:w.DOI,firstAuthor:w.author?.[0]?[w.author[0].given,w.author[0].family].filter(Boolean).join(' '):'',metadataSource:'Crossref publisher-deposited metadata',metadataUrl:'https://doi.org/'+w.DOI};}
async function lookup(text,title,get){
 const first=String(text||'').split('[PDF 第 2 页]')[0];
 const doi=first.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0]?.replace(/[.,;:)]+$/,'');
 if(doi){try{const w=(await get('https://api.crossref.org/works/'+encodeURIComponent(doi))).message;if(w?.DOI&&w.title?.[0]&&(similarity(w.title[0],title)>.8||normalized(first).includes(normalized(w.title[0]))))return fromWork(w);}catch(e){if(e.status!==404)throw e;}}
 const arxiv=first.match(/arXiv:\s*(\d{4}\.\d{4,5})(?:v\d+)?/i);
 if(arxiv){const yy=Number(arxiv[1].slice(0,2));return{year:String((yy<91?2000:1900)+yy),venue:'arXiv',metadataSource:'arXiv identifier in PDF',metadataUrl:'https://arxiv.org/abs/'+arxiv[1]};}
 if(normalized(title).split(' ').length<5)return null;
 const items=(await get('https://api.crossref.org/works?rows=3&query.title='+encodeURIComponent(title))).message?.items||[];
 const matches=items.map(w=>({w,score:similarity(w.title?.[0],title)})).sort((a,b)=>b.score-a.score);
 return matches[0]?.score>=.94&&(!matches[1]||matches[0].w.DOI===matches[1].w.DOI||matches[0].score-matches[1].score>.05)?fromWork(matches[0].w):null;
}
module.exports={lookup,similarity,fromWork};
