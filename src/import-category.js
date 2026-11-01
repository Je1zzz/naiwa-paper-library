function categoryPicker(parent,bridge,folders=[],current='文献'){
  const doc=parent.ownerDocument,box=doc.createElement('div');box.className='pl-import-category';parent.append(box);
  const label=doc.createElement('label');label.textContent='导入分类';box.append(label);
  const select=doc.createElement('select');select.className='pl-select';select.setAttribute('aria-label','导入分类');label.append(select);
  for(const path of new Set(['文献',...folders,current])){const option=doc.createElement('option');option.value=path;option.textContent=path;select.append(option);}
  const option=doc.createElement('option');option.value='__new__';option.textContent='＋ 新建分类';select.append(option);select.value=current;
  const name=doc.createElement('input');name.className='pl-input';name.placeholder='例如：脑科学／世界模型';name.setAttribute('aria-label','新分类名称');name.hidden=true;box.append(name);
  select.onchange=()=>{name.hidden=select.value!=='__new__';if(!name.hidden)name.focus();};
  return{async resolve(){if(select.value!=='__new__')return select.value;if(!name.value.trim())throw new Error('请输入新分类名称');return bridge.createCategory(name.value.trim());}};
}
module.exports={categoryPicker};
