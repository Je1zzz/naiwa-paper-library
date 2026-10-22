# Naiwa Paper Library

为 Obsidian 打造的文献管理首页与 AI 文献阅读器。文献、批注和笔记保存在自己的本地知识库中。

> 开发中：当前是功能迭代版本，尚未发布完整版，也未提供 Release 安装包。

## 功能

- 简洁导航与逐条文献列表，搜索、文件夹分类、Label 筛选及数量、阅读日历和笔记关系图。
- 独立 PDF 阅读器：连续滚动、Ctrl + 滚轮缩放、可折叠的文献信息区域。
- Notion 风格多选属性：Label、Rating、阅读状态均可自行创建选项和设置颜色。
- 彩色高亮、下划线、划词翻译、右侧直接编辑批注；可拖动、缩放和收起的便笺。
- 每篇文献对应一个 Markdown 笔记页，上方自由书写，下方汇总批注和便笺，可在 Obsidian 右侧编辑。
- 本地 PDF、Zotero、网页/PDF 链接、DOI 和 arXiv 导入；支持书签脚本入口。
- 文献元数据补全与 AI 作者信息提取；期刊/会议指标保留年份及来源，未核实的指标留空。
- AI 全文对话和划词提问，模型与推理档位选择，持久保存连接设置。
- 自定义背景、玻璃效果、透明度及模糊程度。

## 本地开发与试用

需要 Node.js 20 或更高版本：

```sh
npm install
npm run build
```

入口为 `plugin.js`，构建产物为 `main.js`。Obsidian 插件 ID 为 `paper-library`。

在测试知识库创建 `.obsidian/plugins/paper-library/`，复制根目录的 `main.js`、`manifest.json`、`styles.css` 和 `assets/` 文件夹，然后在 Obsidian 中允许社区插件并启用 **Paper Library · 文献阅读**。请先在测试知识库中试用。

`zotero-addon/` 包含配套 Zotero 扩展源码及其说明。Zotero 桌面右键导入需要另外安装配套扩展；真实桌面右键菜单的兼容性仍需各版本验证。

## AI 与本机集成

可使用自己的兼容 API，也可连接本机已安装并登录的官方 Codex CLI。程序会探测 Zotero 本地 API、兼容的 OpenCodex 配置和 Codex 登录状态；首次使用可能仍需启用本地 API 或完成登录。

使用 Codex 登录时消耗本人账户的相应额度；MCP 或配置导入不提供免费额度。项目不附带 API 密钥、账号或订阅。网页导入以公开可访问资源为主，需要登录的出版商页面可先下载 PDF 再导入。

## 资产与源码

源码不包含个人知识库、论文、阅读笔记、背景图片或登录凭据。公开版本使用独立书本 SVG 图标，见 [ASSET-NOTICE.md](ASSET-NOTICE.md)。私人使用的奶蛙图片不在公开仓库中。除该文件明确授权的图标外，目前未指定整体开源许可证。
