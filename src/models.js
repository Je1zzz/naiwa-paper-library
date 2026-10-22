// Discover models through the configured endpoint; never return credentials.
function endpoint(chatUrl) {
  const url = new URL(chatUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('模型地址必须使用 HTTPS 或本机 HTTP');
  url.pathname = url.pathname.replace(/\/(?:chat\/completions|responses)\/?$/, '').replace(/\/$/, '') + '/models';
  url.search = ''; url.hash = ''; return url.href;
}
function normalize(data) {
  if (!Array.isArray(data?.data)) throw new Error('服务商未返回有效的模型列表');
  return data.data.filter(m => typeof m.id === 'string' && (!m.architecture?.output_modalities || m.architecture.output_modalities.includes('text')) && (!m.output_modalities || m.output_modalities.includes('text'))).map(m => ({
    id:m.id, name:m.name || m.id, context:m.context_length || m.context_window || null, maxOutput:m.max_output_tokens || m.top_provider?.max_completion_tokens || null,
    free:m.pricing ? Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 : null,
    efforts:m.effort?.supported_levels || (m.supported_parameters?.includes('reasoning') ? ['low','medium','high'] : [])
  }));
}
module.exports = { endpoint, normalize };
