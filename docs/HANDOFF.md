# 给新电脑 Codex 的接手提示词

复制下文作为新会话的第一条消息：

```text
请接手 Naiwa Paper Library，继续开发 Obsidian 桌面端的文献管理和 AI 阅读插件。
项目：https://github.com/Je1zzz/naiwa-paper-library
分支：main。先确认本机目录、git status 和最新提交，保留已有修改，不沿用旧电脑的绝对路径。持续要求：不要创建或发布 Release。

先读 docs/DEVELOPMENT.md、docs/NEW-COMPUTER.md、docs/INSTALL.md、docs/INSTALL-ACCEPTANCE.md、docs/SYNC.md。

当前进度：
- 已有无侧栏文献首页、表格和自定义属性、连续滚动 PDF 阅读器、彩色标注/下划线、便笺与合并文章笔记、全文/划词 AI、模型和推理选择。
- GitHub ZIP 的 Windows install.cmd 已在真实全新 Obsidian vault 验证，自动检测 Zotero、OpenCodex 和 Codex；重载和重复安装保留数据。OpenCodex 兼容 DeepSeek/OpenRouter 的 openai-chat 配置；Codex 走本机 CLI 登录，不承诺免费额度。
- 已修复 Codex 先连接后漏掉 OpenCodex 供应商的问题，以及迁移后陈旧 Codex 路径/就绪标记的回退。
- 已增加可选“导入时同时保存到 Zotero”：本地/网页 PDF 先保存到 Obsidian，再保存副本至 Zotero 当前可写分类。Zotero 导入不回传；按本库内容记录去重；失败保留本地文件并提供重试。合成 PDF 的真实保存、字节一致、重复内容不再上传和反向复用本地文献已验证。
- 坚果云目前采用桌面客户端同步 vault 文件夹，Zotero 用自身元数据同步及可选 WebDAV 附件同步；插件没有内置云同步引擎，也没有两库批注/标签持续双向同步。

开发步骤：
1. 必要时 git clone 项目，安装 Node.js >=20，npm ci。
2. 改 src/ 下源码，npm run build，npm test。
3. 最终构建后执行 powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\generate-install-manifest.ps1。
4. 用 .\install.cmd -VaultPath "新建测试知识库的绝对路径" 部署，在真实 Obsidian 中启用/重载并验证实际功能。源码目录与 vault 必须分开。
5. 运行文件及清单应和源码一起提交；推送 main 可以，仍然不要发布 Release。

待验证或限制：
- 新电脑与旧电脑间坚果云同步，尤其隐藏 .obsidian、data.json、批注/便笺恢复及冲突；需我指定同步目录后再配置，不自行上传个人文献。
- Zotero XPI 在真实插件管理器的安装、右键菜单和不同版本；此前只做过打包/兼容性检查，本轮出站保存不依赖 XPI。
- 群组库出站保存、网页 PDF 出站保存、超大 PDF、真实连接中断后的恢复，仍需实机验证。已有部分模拟测试不能代替实测。
- macOS/Linux、手机及一台未安装外部应用的全新系统，尚未完成完整安装验收。
- 两库持续双向同步、批注/标签同步、Zotero 源回链随 Obsidian 改名回写，尚未实现。

保留约定：README 只放一只奶蛙；人读文章笔记保留自由笔记、原文引用、批注和便笺，不加大量自动元数据。paper-library HTML 注释是同步锚点，不可直接删除，正常编辑视图隐藏它们。个人 PDF、笔记、data.json、背景、API key 和登录文件不要提交 GitHub。账号需在本机应用重新配置或登录。

请先核对实际代码和测试证据，再按新需求继续修改；区分已实现、已实测、未验证，不把检测到配置当作所有模型均可调用。
```
