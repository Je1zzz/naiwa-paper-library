'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/enrichment'),M=require('../src/metadata');
const enabled=process.env.ENRICHMENT_LIVE==='1';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Public HTTP '+r.status);return r.json();};
const read=async url=>{const r=await fetch('https://r.jina.ai/'+url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Public reader HTTP '+r.status);return r.text();};
test('LIVE: user paper title resolves to public Crossref metadata',{skip:!enabled},async()=>{
  const title='A visual–omics foundation model to bridge histopathology with spatial transcriptomics';
  const result=await M.lookup('',title,get);assert.ok(result);assert.equal(result.venue,'Nature Methods');assert.ok(result.year);assert.ok(result.metadataUrl);assert.ok(result.publisherUrl);console.log('PUBLIC_METADATA',JSON.stringify({title:result.title,doi:result.doi,year:result.year,venue:result.venue,publisherUrl:result.publisherUrl}));
});
test('LIVE: public Nature Methods publisher evidence yields IF without model tokens',{skip:!enabled},async()=>{
  const url='https://www.nature.com/nmeth/journal-impact';
  const tags=await E.lookupVenueMetrics('Nature Methods',{sourceUrls:[url],read});assert.ok(tags.some(t=>t.type==='IF'));assert.ok(tags.every(t=>t.url===url&&t.year&&t.quote));assert.ok(!tags.some(t=>t.type==='JCR'));console.log('PUBLIC_METRICS',JSON.stringify(tags));
});
test('LIVE: Crossref discovery reaches publisher metrics without Codex or search credentials',{skip:!enabled},async()=>{
  const tags=await E.lookupVenueMetrics('Nature Methods',{get,read,chat:async()=>{throw Error('Model must not be called for deterministic IF');}});
  assert.ok(tags.some(t=>t.type==='IF'));console.log('PUBLIC_DISCOVERY',JSON.stringify(tags));
});
