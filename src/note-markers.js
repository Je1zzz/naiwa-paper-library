// Keep synchronization anchors in Markdown without exposing them in Live Preview.
function markerRanges(doc) {
  const ranges=[];let fence=null;
  for(let n=1;n<=doc.lines;n++){
    const line=doc.line(n),text=line.text.trim();
    const match=text.match(/^(`{3,}|~{3,})/);
    if(match){if(!fence)fence=match[1];else if(match[1][0]===fence[0]&&match[1].length>=fence.length)fence=null;continue;}
    if(fence)continue;
    if(/^<!-- paper-library:(?:annotations:(?:start|end)|body|end|annotation \{.*\}) -->$/.test(text))ranges.push({from:line.from,to:line.to+(n<doc.lines?1:0)});
  }
  return ranges;
}
function createNoteMarkers({StateField,Decoration,EditorView,editorInfoField,editorLivePreviewField,isNote}){
  const compute=state=>{
    const info=state.field(editorInfoField,false);
    if(!state.field(editorLivePreviewField,false)||!isNote(info?.file?.path))return Decoration.none;
    return Decoration.set(markerRanges(state.doc).map(({from,to})=>Decoration.replace({block:true}).range(from,to)));
  };
  const field=StateField.define({create:compute,update:(_value,tr)=>compute(tr.state),provide:f=>EditorView.decorations.from(f)});
  return [field,EditorView.atomicRanges.of(view=>view.state.field(field))];
}
module.exports={markerRanges,createNoteMarkers};
