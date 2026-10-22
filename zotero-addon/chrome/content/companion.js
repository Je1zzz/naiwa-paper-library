/* Loaded into a private bootstrap scope on Zotero 7–10. */
var PaperLibraryBridge = {
  defaultVault: "paper_library",
  vaultPref: "extensions.paper-library-obsidian.vault",
  importLabel: "导入到 Obsidian · Paper Library",
  settingsLabel: "Paper Library：设置 Obsidian 目标仓库…",

  normalizeVault(value) {
    if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
      throw new Error("请输入非空的 Obsidian 仓库名称（不含控制字符）。");
    }
    return value.trim();
  },

  isCandidate(item) {
    return !!item && !item.deleted && (item.isRegularItem() || item.isPDFAttachment());
  },

  validateTarget(target) {
    if (!/^[A-Z0-9]{8}$/u.test(target.itemKey)
        || (target.attachmentKey !== undefined && !/^[A-Z0-9]{8}$/u.test(target.attachmentKey))
        || !Number.isSafeInteger(target.libraryId) || target.libraryId <= 0) {
      throw new Error("无效的 Zotero 条目或文库标识。");
    }
    if (target.libraryType !== "user" && target.libraryType !== "group") {
      throw new Error("仅支持个人文库和群组文库。");
    }
    if (target.libraryType === "group"
        && (!Number.isSafeInteger(target.groupId) || target.groupId <= 0)) {
      throw new Error("无法确认群组 ID；已阻止按个人文库发送。");
    }
    if (target.libraryType === "user" && target.groupId !== undefined) {
      throw new Error("个人文库不能包含群组 ID。");
    }
  },

  buildImportURI(vault, target) {
    this.validateTarget(target);
    const params = [
      ["vault", this.normalizeVault(vault)],
      ["action", "zotero-import"],
      ["itemKey", target.itemKey]
    ];
    if (target.attachmentKey !== undefined) params.push(["attachmentKey", target.attachmentKey]);
    params.push(["libraryId", target.libraryId]);
    if (target.libraryType === "group") {
      params.push(["libraryType", "group"], ["groupId", target.groupId]);
    }
    return "obsidian://paper-library?" + params
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join("&");
  },

  async collectTargets(items, zotero) {
    const targets = new Map();
    const skipped = [];
    for (const selected of items) {
      try {
        if (!this.isCandidate(selected)) {
          throw new Error("仅支持普通文献或 PDF 附件。");
        }
        const isPDF = selected.isPDFAttachment();
        const standalonePDF = isPDF && !selected.parentItemID;
        const parent = isPDF && !standalonePDF
          ? await zotero.Items.getAsync(selected.parentItemID) : selected;
        if (!parent || parent.deleted || (!standalonePDF && !parent.isRegularItem())
            || parent.libraryID !== selected.libraryID) {
          throw new Error("PDF 的父文献无效或文库不匹配。");
        }
        const library = zotero.Libraries.get(parent.libraryID);
        const target = {
          itemKey: parent.key,
          libraryId: parent.libraryID,
          libraryType: library?.libraryType
        };
        // Do not inspect/choose child attachments for a bibliographic selection.
        if (isPDF) target.attachmentKey = selected.key;
        if (target.libraryType === "group") {
          target.groupId = zotero.Groups.getGroupIDFromLibraryID(parent.libraryID);
        }
        this.validateTarget(target);
        const identity = `${target.libraryId}/${target.itemKey}/${target.attachmentKey || ""}`;
        targets.set(identity, target);
      } catch (error) {
        skipped.push({ itemKey: selected?.key, reason: error.message });
      }
    }
    // When both parent and PDF rows are selected, explicit PDFs take precedence.
    const explicitParents = new Set([...targets.values()]
      .filter(target => target.attachmentKey)
      .map(target => `${target.libraryId}/${target.itemKey}`));
    return {
      targets: [...targets.values()].filter(target => target.attachmentKey
        || !explicitParents.has(`${target.libraryId}/${target.itemKey}`)),
      skipped
    };
  }
};

var createPaperLibraryAddon = function ({ Zotero, Services }) {
  const bridge = PaperLibraryBridge;
  return {
    active: false,
    busy: false,
    menuIDs: [],
    windows: new Map(),
    useMenuManager: false,

    getVault() {
      const saved = Zotero.Prefs.get(bridge.vaultPref, true);
      return saved === undefined ? bridge.defaultVault : bridge.normalizeVault(saved);
    },

    showError(window, error) {
      Zotero.logError(error);
      Services.prompt.alert(window, "Paper Library", error.message);
    },

    configureVault(window) {
      const saved = Zotero.Prefs.get(bridge.vaultPref, true);
      const input = { value: typeof saved === "string" ? saved : bridge.defaultVault };
      if (!Services.prompt.prompt(window, "Paper Library · Obsidian",
        "目标 Obsidian 仓库名称（不是路径）：", input, null, { value: false })) return;
      try {
        Zotero.Prefs.set(bridge.vaultPref, bridge.normalizeVault(input.value), true);
      } catch (error) {
        this.showError(window, error);
      }
    },

    ensureLocalAPI() {
      // Zotero 10 checks this API flag per request. Its HTTP server switch is
      // different: the official preferences UI explicitly requires a restart.
      if (Zotero.Prefs.get("httpServer.enabled") !== true) {
        throw new Error("Zotero HTTP 服务未开启。请打开 Zotero 设置 → 高级 → 本地 API，"
          + "点击“启用并重启”（Enable and Restart），然后再次选择导入。扩展不会自动重启。");
      }
      let port;
      try { port = Zotero.Server?.port; } catch (_) { /* Uninitialized server getter throws. */ }
      if (!Number.isInteger(port) || port <= 0) {
        throw new Error("Zotero HTTP 服务尚未运行。请在 Zotero 设置 → 高级检查本地 API/端口，"
          + "必要时手动重启 Zotero 后重试；尚未启用 API 或交接条目。");
      }
      const enabled = Zotero.Prefs.get("httpServer.localAPI.enabled");
      if (typeof enabled !== "boolean") {
        throw new Error("当前 Zotero 未提供可用的本地 API 开关。请更新 Zotero，并在设置 → 高级检查本地 API。");
      }
      if (!enabled) {
        // Relative Zotero pref: extensions.zotero.httpServer.localAPI.enabled.
        // Never read/rewrite the profile prefs.js or change the server switch.
        Zotero.Prefs.set("httpServer.localAPI.enabled", true);
        if (Zotero.Prefs.get("httpServer.localAPI.enabled") !== true) {
          throw new Error("无法启用 Zotero 本地 API；尚未交接条目。请在设置 → 高级手动开启本地 API 后重试。");
        }
      }
    },

    async importItems(window, items) {
      if (!this.active || this.busy) return;
      this.busy = true;
      try {
        const vault = this.getVault();
        const { targets, skipped } = await bridge.collectTargets(Array.from(items), Zotero);
        if (!this.active) return;
        // Only a real Import command with eligible targets may enable the API.
        if (targets.length) this.ensureLocalAPI();
        let sent = 0;
        const failures = [];
        for (const target of targets) {
          // Disabling during an awaited parent lookup/launch stops further dispatch.
          if (!this.active) return;
          try {
            await Zotero.launchURL(bridge.buildImportURI(vault, target));
            sent++;
          } catch (error) {
            Zotero.logError(error);
            failures.push(error.message);
          }
        }
        if (this.active && (skipped.length || failures.length || !targets.length)) {
          const reasons = [...new Set([...skipped.map(item => item.reason), ...failures])];
          Services.prompt.alert(window, "Paper Library",
            `已向 Obsidian 交接 ${sent} 项；跳过 ${skipped.length} 项；启动失败 ${failures.length} 项。`
            + (reasons.length ? "\n\n" + reasons.join("\n") : "\n请先选择文献或 PDF 附件。"));
        }
      } finally {
        this.busy = false;
      }
    },

    runImport(window, items) {
      return this.importItems(window, items).catch(error => {
        if (this.active) this.showError(window, error);
      });
    },

    start(pluginID) {
      this.active = true;
      this.useMenuManager = typeof Zotero.MenuManager?.registerMenu === "function";
      if (this.useMenuManager) {
        const registrations = [
          {
            menuID: "paper-library-import",
            pluginID,
            target: "main/library/item",
            menus: [{
              menuType: "menuitem",
              onShowing: (_event, context) => {
                context.menuElem.label = bridge.importLabel;
                context.setVisible((context.items || []).some(item => bridge.isCandidate(item)));
                context.setEnabled(!this.busy);
              },
              onCommand: (event, context) => this.runImport(
                event.target.ownerGlobal, context.items || []
              )
            }]
          },
          {
            menuID: "paper-library-vault",
            pluginID,
            target: "main/menubar/tools",
            menus: [{
              menuType: "menuitem",
              onShowing: (_event, context) => { context.menuElem.label = bridge.settingsLabel; },
              onCommand: event => this.configureVault(event.target.ownerGlobal)
            }]
          }
        ];
        for (const registration of registrations) {
          const registeredID = Zotero.MenuManager.registerMenu(registration);
          if (!registeredID) throw new Error("Paper Library 菜单注册失败。");
          this.menuIDs.push(registeredID);
        }
      } else {
        for (const window of Zotero.getMainWindows()) this.addToWindow(window);
      }
    },

    addToWindow(window) {
      if (!this.active || this.useMenuManager || this.windows.has(window) || !window.ZoteroPane) return;
      const doc = window.document;
      const popup = doc.getElementById("zotero-itemmenu");
      const tools = doc.getElementById("menu_ToolsPopup");
      if (!popup || !tools) throw new Error("找不到 Zotero 主窗口菜单。");
      const importItem = doc.createXULElement("menuitem");
      importItem.id = "paper-library-import";
      importItem.label = bridge.importLabel;
      importItem.hidden = true;
      const settingsItem = doc.createXULElement("menuitem");
      settingsItem.id = "paper-library-vault";
      settingsItem.label = bridge.settingsLabel;
      const selection = () => window.ZoteroPane.getSelectedItems();
      const showing = event => {
        // Ignore bubbled submenu popups.
        if (event.target !== popup) return;
        importItem.hidden = !selection().some(item => bridge.isCandidate(item));
        importItem.disabled = this.busy;
      };
      const importing = () => this.runImport(window, selection());
      const configuring = () => this.configureVault(window);
      popup.addEventListener("popupshowing", showing);
      importItem.addEventListener("command", importing);
      settingsItem.addEventListener("command", configuring);
      // Append to preserve Zotero 7's positional built-in menu indices.
      popup.appendChild(importItem);
      tools.appendChild(settingsItem);
      this.windows.set(window, { popup, importItem, settingsItem, showing, importing, configuring });
    },

    removeFromWindow(window) {
      const state = this.windows.get(window);
      if (!state) return;
      state.popup.removeEventListener("popupshowing", state.showing);
      state.importItem.removeEventListener("command", state.importing);
      state.settingsItem.removeEventListener("command", state.configuring);
      state.importItem.remove();
      state.settingsItem.remove();
      this.windows.delete(window);
    },

    stop() {
      this.active = false;
      for (const menuID of this.menuIDs) Zotero.MenuManager.unregisterMenu(menuID);
      this.menuIDs = [];
      for (const window of this.windows.keys()) this.removeFromWindow(window);
    }
  };
};
