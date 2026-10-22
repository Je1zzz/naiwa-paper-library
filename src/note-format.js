function record(note){const {body,quote,path,_source,_block,_originalBody,...data}=note;return data;}
function cleanProse(source,paper){
 const normalized=source.replace(/\r\n/g,'\n'),boundary=normalized.indexOf('<!-- paper-library:annotations:start -->'),head=boundary<0?normalized:normalized.slice(0,boundary),tail=boundary<0?'':normalized.slice(boundary);
 const title=paper.split('/').pop().replace(/\.pdf$/i,''),lines=head.split('\n');
 return lines.filter(line=>line!=='# '+title&&line!=='在这里自由记录想法。'&&!/^\[打开文献\]\(obsidian:\/\/paper-library\?/.test(line)&&!/^\[在 Zotero 中打开\]\(zotero:\/\/select\//.test(line)).join('\n')+tail;
}
function ownedKeys(metadata={}){
 const aliases={firstAuthor:'first-author',correspondingAuthor:'corresponding-author',metadataSource:'metadata-source',metadataUrl:'metadata-url'};
 return new Set(['type','paper','title','authors','doi','year','venue','labels','rating-options','reading-status-options','custom-properties','venue-metrics','zotero-key','zotero-uri','citation-key','sourceUrl','pdfUrl','publisherUrl','lookupAt','lookupStatus','authorLookupAt','authorLookupStatus','authorLookupError','authorSource','authorSources','authorEvidence','authorWarnings','authorVerification','affiliation','affiliationZh','correspondingAffiliation','correspondingAffiliationZh','first-author','corresponding-author','metadata-source','metadata-url',...Object.keys(metadata).map(key=>aliases[key]||key)]);
}
module.exports={record,cleanProse,ownedKeys};
