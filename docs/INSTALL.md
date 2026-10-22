# 安装奶蛙

## Windows：下载后双击安装

1. 下载仓库的源码 ZIP 并完整解压。保留 `install.cmd`、`tools/`、`plugin/` 和 `zotero-addon/` 的相对位置，不要在 ZIP 预览窗口直接运行。解压位置应在目标 Obsidian 仓库之外。
2. 双击根目录 `install.cmd`。安装器列出 `%APPDATA%/obsidian/obsidian.json` 中已注册且仍存在的 vault；输入序号选择。也可输入完整的本地目录路径，或输入 `B` 打开目录选择器。空输入取消。
3. 打开所选 vault，在 Obsidian 中允许第三方插件并启用 **Paper Library · 文献阅读**。已运行的插件需要你自行重新启用或重启 Obsidian；安装器不会中断当前阅读。
4. 打开 `文献首页.md`，或在命令面板运行 **Paper Library · 文献阅读：打开文献首页**。如果已有同名首页，安装器保留原内容，不自动加入属性或替换它；可直接使用命令打开插件首页。

安装直接复制仓库内已构建的 `plugin/`，不需要 Node、npm、管理员权限、Release 或先运行构建。如果 Windows 提示来源安全警告，请先确认代码来源；只运行你信任的副本。`install.cmd` 仅为这次 PowerShell 进程使用执行策略参数，不修改系统执行策略。

## 会改什么、保留什么

安装器只更新 `.obsidian/plugins/paper-library/` 下清单明确列出的五个运行文件：`main.js`、`manifest.json`、`styles.css` 和两张内置资源。它会将 `paper-library` 合并到 `.obsidian/community-plugins.json`，保留其他插件 ID 和其顺序；已启用时不重写该文件。不会关闭 Obsidian 的受限模式，也不修改其他插件文件。

已有 `data.json`、自定义背景、PDF、Markdown 笔记及 `文献首页.md` 均保留。只在不存在时建立 `文献/`、`阅读笔记/` 和首页。可以从同一源码目录重复安装；不会删除目标插件中的旧文件或其他内容。

写入前会检查全部运行文件 SHA256、插件 ID/版本、注册表格式和所有目标路径，拒绝 junction/symlink、路径穿越、UNC/设备路径、系统目录和源码/目标互相嵌套。校验失败时不开始写入。SHA256 用于发现构建与清单不一致或副本损坏，不能替代对下载来源的信任。复制期间发生磁盘/权限故障时可能只完成部分运行文件；修复故障后可重复安装，安装器不会以清理用户数据的方式回滚。

## 指定目录与预演

在解压后的仓库根目录运行：

```powershell
.\install.cmd -VaultPath "D:\我的文献库"
.\install.cmd -VaultPath "D:\我的文献库" -DryRun -SkipProbes
```

`-VaultPath`（同义参数 `-Target`）不会弹目录选择器或询问 vault；带参数运行时 CMD 不暂停。`-DryRun` 只验证，连空目录也不创建。`-SkipProbes` 跳过可选服务探测。默认使用 Windows 自带的 **Windows PowerShell 5.1**，不是要求另装的 PowerShell 7。带 `B` 的目录选择需要 STA，双击入口已配置。

## Zotero 与账号连接

安装器只探测 Zotero 本地 API 的 HTTP 可达性、相关程序是否在 PATH/运行，以及 OpenCodex 配置和 Codex 账号文件是否存在。它不读取、输出或复制这些文件的密钥，不运行登录命令，不安装或启动任何外部应用。存在配置不代表已登录；本地端口可达也不代表所有 API 权限已开启。插件首次启动会自行检测 Zotero 本地 API、OpenCodex 配置与 Codex 登录状态，按实际情况显示连接状态。

**Zotero 伴侣需要另行手动安装**：在 Zotero 的「工具 → 插件 → 齿轮 → 从文件安装插件」选择仓库的 `zotero-addon/paper-library-zotero.xpi`。安装器不会写 Zotero profile、启用本地 API 或重启 Zotero。不要把 XPI 放进 Obsidian 插件目录。

Zotero 需要已启动并允许本地 API 访问。OpenCodex 需要当前系统账号下已有兼容的 API 供应商配置；插件按需读取凭据，保留已经可用的供应商设置。关联配置不会产生额外免费额度，调用仍使用对应供应商或 Codex 账号的额度。

自动安装入口目前面向 Windows。其他桌面系统可手动将 `plugin/` 内全部文件复制到目标 vault 的 `.obsidian/plugins/paper-library/`，再在 Obsidian 中启用。

## 维护者：最终构建后刷新安装清单

源码修改并最终构建 `plugin/main.js` 后，在仓库根目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\generate-install-manifest.ps1
```

该命令只读取现有 `plugin/` 五个运行文件并更新 `tools/install-manifest.json`，无需 Node、不会构建插件、不会接触任何 vault。相同输入重复执行会得到相同清单。每次改动 `plugin/main.js`、manifest、样式或内置资源后都应重新运行，再提交对应源码和已构建文件；不需要 Release 或二进制附件发布步骤。

开发测试（Node 仅供维护者跑测试，安装用户不需要）：

```powershell
node --test tests/installer.test.cjs
```

测试在操作系统临时目录建立合成的中文路径 vault 和下载副本，覆盖首次/重复安装、保留已有内容、注册 vault 选择、无界面显式目标模式，以及路径和校验失败的拒绝行为，不操作真实用户 vault。
