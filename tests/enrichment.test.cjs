'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/enrichment');
const V=require('../src/venue-metrics');
const M=require('../src/metadata');
const title='A visual omics foundation model for spatial transcriptomics';
const source=title+'\nAlice Smith 1, Bob Jones 2\n1 University Alpha\n2 Institute Beta\nCorrespondence to Bob Jones. Additional article text to demonstrate a readable PDF.';
const author={title,firstAuthor:'Alice Smith',affiliation:'University Alpha',affiliationZh:'阿尔法大学',correspondingAuthor:'Bob Jones',correspondingAffiliation:'Institute Beta',correspondingAffiliationZh:'贝塔研究所',evidence:{affiliation:'1 University Alpha',correspondingAuthor:'Correspondence to Bob Jones.',correspondingAffiliation:{authorQuote:'Alice Smith 1, Bob Jones 2',affiliationQuote:'2 Institute Beta',marker:'2'}}};
const url='https://www.nature.com/nmeth/journal-impact';
const page='Nature Methods\nJournal Impact Factor: 28.2 (2025)\n5-year Journal Impact Factor: 52.4 (2025)\nJCR category Methods: Q1 (2025)';
const item={type:'IF',value:'28.2',year:2025,url,quote:'Journal Impact Factor: 28.2 (2025)'};

test('JSON: fences, prose, braces in strings, BOM, think blocks',()=>{
  for(const answer of ['```json\n{"title":"a } b"}\n```','Result: {"title":"a } b"} finished','\uFEFF<think>hidden</think>{"title":"a } b"}'])assert.deepEqual(E.parseJson(answer),{title:'a } b'});
});
test('JSON rejects truncated, ambiguous, array, invalid and empty answers',()=>{
  for(const answer of ['{"title":','{} {}','[1,2]','[{}]','```json\n[{}]\n```','{"outer":{"x":1}','undefined',''])assert.throws(()=>E.parseJson(answer));
});
test('PDF sampling keeps front and rear pages; all option includes middle',async()=>{
  const called=[],pdf={numPages:34,getPage:async n=>{called.push(n);return {getTextContent:async()=>({items:[{str:'page '+n}]})};}};
  assert.deepEqual((await E.collectPdfPages(pdf)).map(p=>p.page),[1,2,32,33,34]);
  const all=await E.collectPdfPages(pdf,{all:true});assert.equal(all.length,34);assert.equal(all[23].text,'page 24');
});
test('full PDF selects mid-document Author information despite blank rear pages',async()=>{
  const text=title+'\n'+('body '.repeat(10000))+'\nAuthor information\n'+source+'\n'+('references '.repeat(6000));
  const result=await E.extractAuthors({text,chat:async messages=>{assert.ok(messages[1].content.includes('2 Institute Beta'));assert.ok(messages[1].content.length<49000);return '```json\n'+JSON.stringify(author)+'\n```';}});
  assert.equal(result.correspondingAffiliationZh,'贝塔研究所');assert.equal(result.authorLookupStatus,'verified');
});
test('127813-character PDF retains unheaded page 15 numbered affiliations at offset 79054',async()=>{
  const header='[PDF 第 15 页] Nature Methods\n';
  const units='1 Center for Bioinformatics and Computational Biology, Houston Methodist Research Institute, Houston, TX, USA.\n2 Department of Physiology, University Beta, USA.\n'+Array.from({length:9},(_,i)=>`${i+3} Center for Research ${i+3}, Institute Gamma, USA.`).join('\n')+'\n12 These authors contributed equally.';
  const front=title+'\nAlice Smith 1, Bob Jones 2\n[PDF 第 2 页] '+('body '.repeat(20000));
  let text=front.slice(0,79054-header.length)+header+units+'\n[PDF 第 16 页] '+('body '.repeat(2000))+'\n[PDF 第 20 页] Correspondence to Bob Jones.\n';
  text=text.padEnd(127813,' ');
  assert.equal(text.indexOf('1 Center for'),79054);assert.equal(text.length,127813);
  const selected=E.selectAuthorText(text);
  assert.ok(selected.includes('[PDF 第 15 页]'));
  assert.ok(selected.includes(units));assert.ok(selected.includes('Correspondence to Bob Jones.'));assert.ok(selected.length<49000);
  const value={...author,affiliation:'Center for Bioinformatics and Computational Biology, Houston Methodist Research Institute',affiliationZh:'休斯敦卫理公会研究所',correspondingAffiliation:'Department of Physiology, University Beta',evidence:{affiliation:units.split('\n')[0],correspondingAuthor:'Correspondence to Bob Jones.',correspondingAffiliation:{authorQuote:'Alice Smith 1, Bob Jones 2',affiliationQuote:units.split('\n')[1],marker:'2'}}};
  let called=false;
  const result=await E.extractAuthors({text,chat:async messages=>{called=true;assert.ok(messages[1].content.includes(units));return JSON.stringify(value);}});
  assert.ok(called);assert.equal(result.affiliation,value.affiliation);assert.equal(result.correspondingAffiliationZh,author.correspondingAffiliationZh);
});
test('numbered institution density works without page labels and outranks reference keywords',()=>{
  const units='1 Center for Bioinformatics, Houston Methodist Research Institute.\n2 Department of Physiology, University Beta.\n3 School of Medicine, University Gamma.';
  const text=title+' '+('body '.repeat(15000))+units+' '+('references Correspondence incidental '.repeat(3000));
  const selected=E.selectAuthorText(text);assert.ok(selected.includes(units));assert.ok(selected.length<49000);
});
test('author text needs no Abstract keyword and reaches API chat',async()=>{
  const result=await E.extractAuthors({text:source,chat:async m=>{assert.ok(m[1].content.includes(source));return JSON.stringify(author);}});
  assert.equal(result.affiliation,'University Alpha');assert.ok(result.authorEvidence);
});
test('two separate quotes require matching affiliation markers',()=>{
  assert.ok(E.authorFields(author,source).correspondingAffiliationZh);
  const wrong=structuredClone(author);wrong.evidence.correspondingAffiliation.marker='1';assert.equal(E.authorFields(wrong,source).correspondingAffiliationZh,undefined);
  const wrongAuthor=structuredClone(author);wrongAuthor.correspondingAuthor='Alice Smith';wrongAuthor.evidence.correspondingAuthor='Correspondence to Alice Smith.';assert.equal(E.authorFields(wrongAuthor,source+' Correspondence to Alice Smith.').correspondingAffiliationZh,undefined);
  wrong.correspondingAuthor='Invented';assert.equal(E.authorFields(wrong,source).correspondingAuthor,undefined);
});
test('first-author affiliation accepts separate numbered evidence and preserves English names',()=>{
  const value=structuredClone(author);
  value.affiliationZh='University Alpha';
  value.evidence.affiliation={authorQuote:'Alice Smith 1, Bob Jones 2',affiliationQuote:'1 University Alpha',marker:'1'};
  const result=E.authorFields(value,source);assert.equal(result.affiliation,'University Alpha');assert.equal(result.affiliationZh,'University Alpha');
  value.evidence.affiliation.marker='2';assert.equal(E.authorFields(value,source).affiliation,undefined);
  value.evidence.affiliation.marker='1';value.evidence.affiliation.affiliationQuote='1 Invented Institution';assert.equal(E.authorFields(value,source).affiliation,undefined);
  value.evidence.firstAffiliation={authorQuote:'Alice Smith 1, Bob Jones 2',affiliationQuote:'1 University Alpha',marker:'1'};delete value.evidence.affiliation;
  assert.equal(E.authorFields(value,source).affiliation,'University Alpha');
});
test('email without correspondence does not establish corresponding author',()=>{
  const value={...author,evidence:{...author.evidence,correspondingAuthor:'Bob Jones email@example.org'}};
  assert.equal(E.authorFields(value,source+' Bob Jones email@example.org').correspondingAuthor,undefined);
});
test('scan/missing text and malformed extraction fail explicitly',async()=>{
  await assert.rejects(E.extractAuthors({text:'[PDF 第 1 页]\n   '}),e=>e.code==='PDF_TEXT_UNAVAILABLE');
  await assert.rejects(E.extractAuthors({text:source,chat:async()=>'{bad'}),/JSON/);
});
test('Crossref preserves first author affiliation, source URL and publication year',()=>{
  const result=M.fromWork({title:[title],DOI:'10.1234/abc',published:{'date-parts':[[2020]]},author:[{given:'Alice',family:'Smith',affiliation:[{name:'University Alpha'}]}]});
  assert.equal(result.year,'2020');assert.equal(result.affiliation,'University Alpha');assert.equal(result.correspondingAffiliationZh,undefined);assert.ok(result.metadataUrl.endsWith('10.1234/abc'));
});
test('publisher fallback triggers even when PDF already supplied first author affiliation',async()=>{
  let chats=0,reads=0;
  const result=await E.extractAuthors({text:source,title,chat:async messages=>{assert.ok(messages[0].content.includes('不熟悉机构保留英文'));assert.ok(messages[0].content.includes('不得按普通词义直译机构专名'));return JSON.stringify(++chats===1?{...author,correspondingAuthor:null}:author);},get:async()=>({message:{items:[{title:[title],DOI:'10.1234/abc','container-title':['Nature Methods'],resource:{primary:{URL:'https://www.nature.com/articles/example'}}}]}}),read:async()=>{reads++;return source;}});
  assert.equal(reads,1);assert.equal(result.correspondingAuthor,'Bob Jones');assert.equal(result.authorSources.at(-1).kind,'publisher');
});
test('metrics API path uses fetched publisher evidence, no Codex required',async()=>{
  let calls=0;const tags=await E.lookupVenueMetrics('Nature Methods',{search:async()=>[{url}],read:async()=>page.replace('Journal Impact Factor: 28.2 (2025)','No public IF'),chat:async messages=>{calls++;assert.ok(messages[1].content.includes('JCR'));return 'Here: '+JSON.stringify({metrics:[{type:'JCR',value:'Q1',year:2025,url,quote:'JCR category Methods: Q1 (2025)'}]});}});
  assert.equal(calls,1);assert.deepEqual(tags.map(t=>t.type),['JCR']);assert.equal(tags[0].year,2025);assert.equal(tags[0].url,url);
});
test('deterministic publisher IF costs no model call, excludes five-year IF',async()=>{
  const tags=await V.lookup('Nature Methods',{sourceUrls:[url],read:async()=>page,chat:async()=>{throw new Error('quota exhausted');}});assert.equal(tags.length,1);assert.equal(tags[0].value,'28.2');
});
test('metrics require exact value, year, trusted host, authentic quote and metric type',async()=>{
  for(const changed of [{value:'8.2'},{year:2024},{url:'https://nature.com.evil.example/foo'},{quote:'Invented Journal Impact Factor: 28.2 (2025)'},{type:'JCR',value:'Q1',quote:'SCImago SJR Q1 2025'}])assert.equal((await V.verify('Nature Methods',[{...item,...changed}],async()=>page+'\nSCImago SJR Q1 2025')).length,0);
});
test('evidence cannot move the decimal point to fabricate impact factors',async()=>{
  assert.equal((await V.verify('Nature Methods',[{...item,value:'2.82',quote:'Journal Impact Factor: 2.82 (2025)'}],async()=>page)).length,0);
});
test('unreadable official evidence is an explicit failure',async()=>{
  await assert.rejects(V.lookup('Nature Methods',{search:async()=>[],read:async()=>''}),e=>e.code==='VENUE_EVIDENCE_UNAVAILABLE');
});
test('Codex research accepts prose JSON and verifies source independently',async()=>{
  const tags=await V.lookup('Nature Methods',{research:async()=>'<think>search</think>\n'+JSON.stringify({metrics:[item]}),read:async()=>page});assert.equal(tags[0].value,'28.2');
});
test('Crossref publisher discovery works when public search is unavailable',async()=>{
  const tags=await V.lookup('Nature Methods',{get:async()=>({message:{items:[{'container-title':['Nature Methods'],resource:{primary:{URL:'https://www.nature.com/articles/example'}}}]}}),read:async u=>u.endsWith('/example')?'[Nature Methods](https://www.nature.com/nmeth/)':page});assert.equal(tags[0].url,url);
});
test('Crossref DOI failure falls back to title registry match',async()=>{
  let calls=0;const result=await M.lookup(title+' 10.1234/abc',title,async()=>{if(++calls===1)throw new Error('temporary');return {message:{items:[{title:[title],DOI:'10.1234/abc'}]}};});assert.equal(result.doi,'10.1234/abc');assert.equal(calls,2);
});
