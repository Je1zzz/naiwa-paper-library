# 开发与目录

- `src/`：Obsidian 插件源码。
- `plugin/`：可部署的插件，含构建后的 `main.js`、清单、样式和图片。
- `tests/`：回归测试；其中 native 脚本供本机 Obsidian 环境使用。
- `tools/`：插件和 Zotero 扩展构建工具。
- `zotero-addon/`：Zotero 配套扩展源码、XPI 和安装说明。
- `docs/`：开发说明与资产声明。

使用 Node.js 20 或更高版本，在仓库根目录运行：

```sh
npm ci
npm run build
npm test
```

构建结果写入 `plugin/main.js`。试用时将 `plugin/` 内的文件复制到测试知识库的 `.obsidian/plugins/paper-library/`，再启用插件。当前仍为开发版本，未发布 Release。

Zotero 扩展的安装与构建见 [配套扩展说明](../zotero-addon/README.md)。图片使用说明见 [资产声明](ASSET-NOTICE.md)。
