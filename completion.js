const Core=require('./core');
async function complete(settings,messages,post){
 const history=[...messages];let combined='';
 for(let attempt=0;attempt<4;attempt++){
  let timer;
  try{
   const response=await Promise.race([post(Core.buildRequest(settings,history)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('等待回答超时，请稍后重试；服务商请求可能仍在处理。')),240000);})]);
   const data=response.json,choice=data?.choices?.[0];
   if(choice?.finish_reason==='length'&&!choice.message?.content?.trim())throw new Error('推理用完单次输出预算但没有正文，请提高回答上限或降低推理强度。');
   Core.responseText(response.status,data);combined+=(attempt?'\n\n':'')+choice.message.content;
   if(choice.finish_reason!=='length')return combined;
   if(attempt===3)return combined+'\n\n[已自动续写三次，仍达到模型输出上限。点击“继续回答”可接着阅读。]';
   settings.onProgress?.('回答较长，正在自动续写（'+(attempt+1)+'/3）…');
   history.splice(messages.length);history.push({role:'assistant',content:combined},{role:'user',content:'上一条回答因长度被截断。请从中断处继续，不要重复开头或已讲过的内容，完成原问题尚未回答的部分。'});
  }catch(e){
   if(combined)return combined+'\n\n[自动续写中断，已保留上方内容。点击“继续回答”重试。]';
   if(/密钥|额度|余额|API 请求|服务商|预算|模型|频繁|超时/.test(e.message))throw e;
   throw new Error('无法连接服务商，请检查网络后重试。');
  }finally{clearTimeout(timer);}
 }
}
module.exports={complete};
