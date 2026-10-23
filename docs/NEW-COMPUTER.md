# 在新电脑继续开发

## 代码与个人文献分开迁移

GitHub 保存插件源码、已构建插件和安装工具。个人 PDF、阅读笔记、插件 `data.json`、背景图和账号凭据不在仓库里。只下载代码不会恢复个人文献库。

请另行备份并迁移自己的整个 Obsidian vault，包括隐藏的 `.obsidian` 目录。尤其保留 `.obsidian/plugins/paper-library/data.json`：它包含文献与笔记关联、阅读状态和批注坐标。批注正文保存在 Markdown 中，但只复制 Markdown 不能恢复所有 PDF 高亮位置。背景图和 `note-format-backups/` 也应随 vault 备份。

账号在新电脑的对应应用里重新配置或登录。不要将 API key、Codex 登录文件或 OpenCodex 个人配置提交到 GitHub；也不要照搬旧电脑配置中的绝对可执行文件路径。

## 只使用插件

安装 Obsidian 桌面版（插件最低要求见 `plugin/manifest.json`），按 [安装说明](INSTALL.md) 下载 ZIP、完整解压、双击 `install.cmd` 并选择 vault。首次打开时，确认信任代码来源后选择「信任仓库作者并启用插件」；首页会自动打开。无需 Node.js。

Zotero 需要启动并允许本地 API。OpenCodex 需要当前系统账号下的兼容 API 供应商配置；Codex 通道需要本机 CLI 可启动并已使用 ChatGPT 登录。首次检测可关联多个供应商，保留原来可用的默认选择；首页可点击「重新检测」。连接不会产生新的免费额度。

Zotero 右键导入的配套 XPI 仍需在 Zotero 中手动安装，详见 [Zotero 扩展说明](../zotero-addon/README.md)。Obsidian 内的「Zotero 导入」使用本地 API，不依赖该 XPI。

## 继续修改代码

安装 Git 和 Node.js 20 或更高版本，在代码目录运行：

```powershell
git clone https://github.com/Je1zzz/naiwa-paper-library.git
cd naiwa-paper-library
npm ci
npm run build
npm test
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\generate-install-manifest.ps1
.\install.cmd -VaultPath "D:\我的测试知识库"
```

第一次开发先使用独立测试 vault。修改正在运行的插件后，在 Obsidian 中重新启用插件或重启该 vault；安装器不会中断正在进行的阅读/对话。

目录入口：

- `src/plugin.js`：Obsidian 接口、自动连接、Zotero 导入和设置。
- `src/home.js`、`src/reader.js`：文献首页与阅读器。
- `src/notebook.js`、`src/note-format.js`、`src/note-markers.js`：笔记、批注与正常编辑视图中的标记隐藏。
- `src/codex.js`、`src/models.js`、`src/completion.js`：本机 Codex、模型列表与对话。
- `plugin/`：安装器实际部署的已构建文件。
- `tools/install.ps1`、`tools/install-manifest.json`：安装逻辑与运行文件校验清单。
- `tests/`：回归测试；`native-*.js` 需要真实 Obsidian 环境，不由 Node 测试套件自动执行。

每次修改运行文件后，重新构建并刷新安装清单，连同源码一起提交。不要只改 `plugin/main.js`。`.gitattributes` 保证 ZIP 内运行文件的字节与校验清单一致。

推送前检查 `git status`、`git diff --check` 和测试结果。当前仍为开发版，不要创建 Release、上传个人文献或账号配置。
