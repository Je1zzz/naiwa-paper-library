# 用坚果云同步

当前插件没有内置远程同步或 WebDAV 引擎。桌面端可让坚果云客户端同步 Obsidian vault 文件夹；Zotero 则使用自己的同步设置。以下是配置方案，本项目尚未完成两台物理电脑间的坚果云实测。

## Obsidian：同步整个个人知识库

1. 两台电脑安装并登录坚果云桌面客户端，将个人 vault 目录设为同步文件夹。先在第一台关闭该 vault，等待上传完成，再在新电脑完整下载；PDF 应实际落地，不能只是云端占位文件。
2. 确认 `文献/`、`阅读笔记/`、`文献首页.md` 和 `.obsidian/plugins/paper-library/` 都已同步。尤其不能漏掉隐藏目录中的 `data.json`：批注坐标、文章与笔记关联、标签和阅读状态都依赖它。背景图和笔记备份也应保留。
3. 在新电脑 Obsidian 中打开下载后的 vault，最好保持相同的 vault 名称，以便已有 Obsidian 回链继续生效。按首次打开提示启用插件；外部账号在新电脑自行登录。
4. 在一个设备完成编辑后，等待坚果云两端同步完成再换另一台。插件 `data.json` 不是支持并发合并的数据库，暂未实现多设备同时修改同一批注的冲突合并。

开发源码目录与个人 vault 分开：源码通过 GitHub 同步，个人文献通过坚果云同步。不要把 `.git/`、`node_modules/` 或测试目录放进个人 vault。若客户端支持排除规则，可排除设备界面布局 `.obsidian/workspace*.json`，但不要排除插件 `data.json`。

不要对同一 vault 同时启用多个同步服务。Obsidian 的文件夹同步说明见 [官方帮助](https://obsidian.md/help/sync-notes)。

## Zotero：条目与附件分开配置

- 条目元数据：在 Zotero「设置 → 同步」登录 Zotero 账号，使用 Zotero 自身的数据同步。
- 个人文库附件：可选坚果云 WebDAV。服务器填 `https://dav.jianguoyun.com/dav/`，用户名使用坚果云账号，密码使用坚果云生成的专用应用密码，然后验证服务器。群组附件的同步规则不同，不将个人文库的 WebDAV 方案直接用于群组。
- 不要把整个 Zotero 数据目录或 `zotero.sqlite` 放入坚果云同步文件夹。数据库应留在 Zotero 管理的位置。

官方依据：[Zotero 同步](https://www.zotero.org/support/sync)、[坚果云 WebDAV 配置](https://help.jianguoyun.com/?page_id=gmfiepiyzfgpe)、[Zotero 数据库不能直接放进网盘目录](https://www.zotero.org/support/kb/data_directory_in_cloud_storage_folder)。

## 导入时同时保存到 Zotero

文献首页 →「导入设置」→ 勾选「导入时同时保存到 Zotero」→ 保存。开关默认关闭，只影响之后的本地和网页 PDF 导入。

插件先保存 Obsidian 文件，再通过 Zotero 官方桌面 Connector API 保存独立 PDF 副本到 Zotero 当前选中的可写文库/分类。界面显示当前目标；不需要额外的 Paper Library XPI。文献识别由 Zotero 自己处理，无法保证每个 PDF 都能自动识别作者等元数据。

从 Zotero 导入不会再次回传；同一 vault 的已保存记录按 PDF 内容去重。已导出的 PDF 从 Zotero 再导入时，若原本地 PDF 仍存在且内容一致，会复用原文献。Zotero 中的源 URL 是返回 Obsidian 的链接。

若保存失败，Obsidian PDF 保留，在「导入设置」中重试。若请求中断而无法确认 Zotero 是否已保存，会要求先检查 Zotero 并确认没有该 PDF，避免自动重试产生重复。去重依赖本库的 `data.json`，不承诺扫描整个 Zotero 历史文库进行全局去重。

这是一份独立副本的一次性导入，不是两库持续双向同步。后续 PDF 内容、批注、标签和改名不会自动回写 Zotero；源文献改名后的 Zotero 回链也不会自动更新。
