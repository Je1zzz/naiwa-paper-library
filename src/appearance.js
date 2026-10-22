const defaults={enabled:false,color:'#e9edf0',backgroundFile:'',transparency:25,blur:16};
function normalize(value={}){return{enabled:Boolean(value.enabled),color:/^#[\da-f]{6}$/i.test(value.color||'')?value.color:defaults.color,backgroundFile:String(value.backgroundFile||''),transparency:Math.max(0,Math.min(95,Number(value.transparency??25)||0)),blur:Math.max(0,Math.min(40,Number(value.blur??16)||0))};}
function apply(root,value,resource){const v=normalize(value);root.classList.toggle('pl-glass-mode',v.enabled);root.style.setProperty('--pl-wallpaper-color',v.color);root.style.setProperty('--pl-wallpaper',v.backgroundFile&&resource?'url('+JSON.stringify(resource(v.backgroundFile))+')':'none');root.style.setProperty('--pl-glass-opacity',String(1-v.transparency/100));root.style.setProperty('--pl-glass-blur',v.blur+'px');}
function dialog(root,bridge){
 const doc=root.ownerDocument,original=normalize(bridge.getAppearance?.()),draft={...original},created=[];
 const el=(tag,cls,text,parent)=>{const n=doc.createElement(tag);n.className=cls||'';if(text)n.textContent=text;parent?.append(n);return n;};
 const overlay=el('div','pl-modal-overlay','',root),box=el('section','pl-modal pl-appearance-modal','',overlay);box.setAttribute('role','dialog');box.setAttribute('aria-label','背景与玻璃');
 const button=(text,parent,action,cls='')=>{const b=el('button','pl-btn '+cls,text,parent);b.onclick=()=>Promise.resolve().then(action).catch(e=>bridge.notice(e.message));return b;};
 const preview=()=>bridge.previewAppearance(draft),close=save=>{doc.removeEventListener('keydown',esc);overlay.remove();if(!save){bridge.previewAppearance(original);for(const path of created)bridge.removeBackground?.(path).catch(()=>{});}};
 const esc=e=>{if(e.key==='Escape')close(false);};doc.addEventListener('keydown',esc);overlay.onpointerdown=e=>{if(e.target===overlay)close(false);};
 const head=el('div','pl-modal-heading','',box);el('h3','','背景与玻璃',head);button('×',head,()=>close(false));
 const row=(label)=>{const r=el('label','pl-appearance-row','',box);el('span','',label,r);return r;};
 const enabled=el('input','','',row('启用玻璃效果'));enabled.type='checkbox';enabled.checked=draft.enabled;enabled.setAttribute('aria-label','启用玻璃效果');enabled.onchange=()=>{draft.enabled=enabled.checked;preview();};
 const color=el('input','','',row('背景颜色'));color.type='color';color.value=draft.color;color.setAttribute('aria-label','背景颜色');color.oninput=()=>{draft.color=color.value;preview();};
 for(const[key,name,max]of [['transparency','面板透明度',95],['blur','背景模糊',40]]){const r=row(name),slider=el('input','','',r),value=el('output','','',r);slider.type='range';slider.min=0;slider.max=max;slider.value=draft[key];slider.setAttribute('aria-label',name);const update=()=>{draft[key]=Number(slider.value);value.textContent=draft[key]+(key==='blur'?' px':'%');preview();};slider.oninput=update;value.textContent=draft[key]+(key==='blur'?' px':'%');}
 const file=el('input','pl-hidden','',box);file.type='file';file.accept='image/png,image/jpeg,image/webp';file.onchange=async()=>{try{const f=file.files[0];if(!f)return;const path=await bridge.saveBackground(f.name,await f.arrayBuffer());created.push(path);draft.backgroundFile=path;draft.enabled=true;enabled.checked=true;preview();}catch(e){bridge.notice(e.message);}};
 const image=el('div','pl-appearance-image-actions','',box);button('选择背景图片',image,()=>file.click());button('移除图片',image,()=>{draft.backgroundFile='';preview();});
 const actions=el('div','pl-modal-actions','',box);button('取消',actions,()=>close(false));button('保存',actions,async()=>{await bridge.saveAppearance(draft);close(true);},'pl-primary');
}
module.exports={defaults,normalize,apply,dialog};
