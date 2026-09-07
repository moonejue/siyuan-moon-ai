"use strict";

const { Dialog, Plugin, showMessage } = require("siyuan");

const SETTINGS_FILE = "settings.json";
const DOCK_TYPE = "moon-ai-dock";
const MAX_NOTE_CHARS = 12000;
const MAX_CONTEXT_CHARS = 42000;

const PROVIDERS = {
  deepseek: {
    label: "DeepSeek",
    protocol: "openai",
    endpoint: "https://api.deepseek.com",
    model: "deepseek-chat",
    needsKey: true
  },
  ollama: {
    label: "Ollama（本地）",
    protocol: "ollama",
    endpoint: "http://127.0.0.1:11434",
    model: "qwen2.5:7b",
    needsKey: false
  },
  lmstudio: {
    label: "LM Studio（本地）",
    protocol: "openai",
    endpoint: "http://127.0.0.1:1234/v1",
    model: "",
    needsKey: false
  },
  openai: {
    label: "OpenAI",
    protocol: "openai",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    needsKey: true
  },
  custom: {
    label: "自定义 OpenAI 兼容接口",
    protocol: "openai",
    endpoint: "",
    model: "",
    needsKey: false
  }
};

const DEFAULT_COMMANDS = [
  {
    id: "polish",
    icon: "◌",
    name: "润色表达",
    prompt: "在不改变原意的前提下润色内容，语言自然、温柔、有力，删除空泛和重复表达。直接输出可用正文。"
  },
  {
    id: "summary",
    icon: "≈",
    name: "摘要要点",
    prompt: "提炼内容的核心观点、关键结论和可行动项，使用简洁 Markdown 输出。"
  },
  {
    id: "continue",
    icon: "→",
    name: "继续写作",
    prompt: "理解现有文本的主题、语气和逻辑，自然续写，避免突然转折和重复。只输出新增正文。"
  },
  {
    id: "awareness",
    icon: "○",
    name: "觉知改写",
    prompt: "将内容改写得更具觉知感与生活实践感：温柔、清醒、克制，不说教，不堆砌宗教术语，保留真实的人间感。直接输出正文。"
  }
];

const SELECTION_ACTIONS = [
  { id: "polish", icon: "◌", label: "润色", prompt: "在不改变原意的前提下润色所选文字，语言自然、准确、流畅，直接输出可替换原文的结果。" },
  { id: "translate", icon: "文", label: "翻译", prompt: "将所选文字翻译成与原文主要语言不同的常用目标语言：中文则译为自然英文，非中文则译为简体中文。只输出译文。" },
  { id: "summary", icon: "≈", label: "总结", prompt: "提炼所选文字的核心信息，保留关键结论，用简洁清晰的文字输出。" },
  { id: "expand", icon: "+", label: "扩写", prompt: "在保留原意与语气的前提下扩写所选文字，增加有价值的细节、逻辑和表达，不要注水。" },
  { id: "condense", icon: "−", label: "精简", prompt: "精简所选文字，删除重复、空泛与冗余表达，保留完整含义与原有语气。" },
  { id: "rewrite", icon: "↻", label: "改写", prompt: "重新组织所选文字的表达，使逻辑更顺、节奏更好、措辞更准确，不改变核心观点。" },
  { id: "continue", icon: "→", label: "续写", prompt: "保留所选原文，并在其后自然续写。输出必须包含完整原文和新续写部分，以便整体替换。" },
  { id: "awareness", icon: "○", label: "觉知风格", prompt: "将所选文字改写为月亮老师风格：温柔觉知、清醒克制、现代简洁、具有生活修行气质；不说教，不堆砌宗教术语。" }
];

const DEFAULT_SYSTEM_PROMPT = "你是一位可信赖的思源笔记写作助手。准确理解用户的指令与引用笔记，保留用户本来的观点和语气。用 Markdown 输出，不要虚构未在引用内容中出现的事实。";

function createProfile(providerKey = "deepseek", overrides = {}) {
  const preset = PROVIDERS[providerKey] || PROVIDERS.custom;
  return {
    id: overrides.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: overrides.name || preset.label,
    provider: providerKey,
    protocol: preset.protocol,
    endpoint: preset.endpoint,
    model: preset.model,
    apiKey: "",
    temperature: 0.4,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    ...overrides
  };
}

function defaultSettings() {
  const profile = createProfile("deepseek", { id: "profile-deepseek", name: "DeepSeek" });
  return {
    activeProfileId: profile.id,
    profiles: [profile],
    commands: DEFAULT_COMMANDS.map((item) => ({ ...item }))
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, "&#10;");
}

function sqlString(value) {
  return String(value || "").replace(/'/g, "''");
}

function compactEndpoint(endpoint) {
  return String(endpoint || "").trim().replace(/\/+$/, "");
}

function completionUrl(endpoint, protocol) {
  let url;
  try { url = new URL(String(endpoint || "").trim()); }
  catch { throw new Error("API 地址无效，请填写完整的 http:// 或 https:// 地址。"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("API 地址仅支持 HTTP / HTTPS；请将密钥填写在 API Key 中。");
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (protocol === "ollama") {
    if (!/\/api\/chat$/i.test(path)) path += /\/api$/i.test(path) ? "/chat" : "/api/chat";
  } else if (!/\/chat\/completions$/i.test(path)) {
    // Only a bare origin implies /v1. Custom gateway prefixes are authoritative.
    path += path ? "/chat/completions" : "/v1/chat/completions";
  }
  url.pathname = path;
  url.hash = "";
  return url.toString();
}

function chatCompletionUrl(endpoint) { return completionUrl(endpoint, "openai"); }
function ollamaChatUrl(endpoint) { return completionUrl(endpoint, "ollama"); }

function isLocalUrl(url) {
  try {
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function normalizeAIText(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

function replaceClosest(text, needle, replacement, preferredIndex = -1, insertAfter = false) {
  if (!needle) return null;
  const positions = [];
  let cursor = 0;
  while (cursor <= text.length) {
    const index = text.indexOf(needle, cursor);
    if (index < 0) break;
    positions.push(index);
    cursor = index + Math.max(1, needle.length);
  }
  if (!positions.length) return null;
  let index = positions[0];
  if (preferredIndex >= 0) {
    index = positions.reduce((best, value) =>
      Math.abs(value - preferredIndex) < Math.abs(best - preferredIndex) ? value : best, positions[0]);
  }
  const next = insertAfter ? `${needle}${replacement}` : replacement;
  return `${text.slice(0, index)}${next}${text.slice(index + needle.length)}`;
}

function diffPreview(original, modified) {
  const left = String(original || "");
  const right = String(modified || "");
  let prefix = 0;
  const maxPrefix = Math.min(left.length, right.length);
  while (prefix < maxPrefix && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) suffix += 1;
  const leftMiddle = left.slice(prefix, left.length - suffix || left.length);
  const rightMiddle = right.slice(prefix, right.length - suffix || right.length);
  const leftHtml = `${escapeHtml(left.slice(0, prefix))}${leftMiddle ? `<mark class="is-removed">${escapeHtml(leftMiddle)}</mark>` : ""}${escapeHtml(suffix ? left.slice(left.length - suffix) : "")}`;
  const rightHtml = `${escapeHtml(right.slice(0, prefix))}${rightMiddle ? `<mark class="is-added">${escapeHtml(rightMiddle)}</mark>` : ""}${escapeHtml(suffix ? right.slice(right.length - suffix) : "")}`;
  return { leftHtml, rightHtml, changes: Number(Boolean(leftMiddle)) + Number(Boolean(rightMiddle)) };
}

function currentDocID() {
  const selectors = [
    ".layout__wnd--active .protyle:not(.fn__none) .protyle-background[data-node-id]",
    ".layout__wnd--active .protyle-background[data-node-id]",
    ".protyle:not(.fn__none) .protyle-background[data-node-id]"
  ];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.dataset?.nodeId) return element.dataset.nodeId;
  }
  return "";
}

async function siyuanPost(path, data = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || `思源接口请求失败：${path}`);
  }
  return payload.data;
}

async function sql(statement) {
  return siyuanPost("/api/query/sql", { stmt: statement, readonly: true });
}

async function getKramdown(id) {
  const data = await siyuanPost("/api/block/getBlockKramdown", { id });
  return String(data?.kramdown || "");
}

async function getBlockSource(id) {
  try {
    const data = await siyuanPost("/api/block/getBlockInfo", { id });
    const source = data?.markdown || data?.content;
    if (source) return String(source);
  } catch {
    // Fall back to the public kramdown endpoint below.
  }
  return getKramdown(id);
}

async function appendBlock(id, markdown) {
  return siyuanPost("/api/block/appendBlock", {
    dataType: "markdown",
    data: markdown,
    parentID: id
  });
}

async function updateBlock(id, markdown) {
  return siyuanPost("/api/block/updateBlock", {
    dataType: "markdown",
    data: markdown,
    id
  });
}

async function directJsonFetch(url, options) {
  const response = await fetch(url, {
    method: options.method || "POST",
    headers: options.headers || {},
    body: JSON.stringify(options.body || {})
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`AI 接口返回了无法解析的内容（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `AI 接口错误：HTTP ${response.status}`);
  }
  return payload;
}

async function proxyJsonFetch(url, options) {
  const result = await siyuanPost("/api/network/forwardProxy", {
    url,
    method: options.method || "POST",
    timeout: 120000,
    contentType: "application/json",
    headers: Object.entries(options.headers || {}).map(([key, value]) => ({ [key]: value })),
    payload: options.body || {},
    // SiYuan 3.8.3 skips SetBody in its text branch; JSON forwards the object.
    payloadEncoding: "json",
    responseEncoding: "text"
  });
  let payload = {};
  try {
    payload = result?.body ? JSON.parse(result.body) : {};
  } catch {
    throw new Error(`AI 接口返回了无法解析的内容（HTTP ${result?.status || "?"}）`);
  }
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(payload?.error?.message || payload?.message || `AI 接口错误：HTTP ${result?.status || "?"}`);
  }
  return payload;
}

async function apiJsonFetch(url, options) {
  if (isLocalUrl(url)) {
    try {
      return await directJsonFetch(url, options);
    } catch (directError) {
      try {
        return await proxyJsonFetch(url, options);
      } catch {
        throw directError;
      }
    }
  }
  return proxyJsonFetch(url, options);
}

async function callAI(settings, messages) {
  const endpoint = compactEndpoint(settings.endpoint);
  const model = String(settings.model || "").trim();
  if (!endpoint) throw new Error("请先在“AI 设置”中填写接口地址。");
  if (!model) throw new Error("请先在“AI 设置”中填写模型名称。");
  if (PROVIDERS[settings.provider]?.needsKey && !String(settings.apiKey || "").trim()) {
    throw new Error("当前 AI 供应商需要 API Key。");
  }

  if (settings.protocol === "ollama") {
    const payload = await apiJsonFetch(ollamaChatUrl(endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { model, stream: false, messages }
    });
    const content = payload?.message?.content;
    if (!content) throw new Error("Ollama 未返回有效内容。");
    return normalizeAIText(content);
  }

  const payload = await apiJsonFetch(chatCompletionUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(String(settings.apiKey || "").trim() ? { Authorization: `Bearer ${String(settings.apiKey).trim()}` } : {})
    },
    body: {
      model,
      temperature: Number(settings.temperature ?? 0.4),
      messages,
      stream: false
    }
  });
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 未返回有效内容。");
  return normalizeAIText(content);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

class MoonAIPlugin extends Plugin {
  async onload() {
    this.settings = defaultSettings();
    this.references = [];
    this.targetID = "";
    this.result = "";
    this.dockElement = null;
    this.activeTab = "workbench";
    this.mentionTimer = null;
    this.mentionResults = [];
    this.mentionStart = -1;
    this.mentionIndex = 0;
    this.isRunning = false;
    this.selectionToolbar = null;
    this.selectionDialog = null;
    this.selectionContext = null;
    this.selectionResult = "";
    this.selectionSession = null;
    await this.loadSettings();

    this.boundSelectionMouseUp = (event) => this.handleSelectionMouseUp(event);
    this.boundSelectionKeyUp = (event) => this.handleSelectionKeyUp(event);
    this.boundSelectionPointerDown = (event) => this.handleSelectionPointerDown(event);
    this.boundSelectionScroll = () => this.hideSelectionToolbar();
    document.addEventListener("mouseup", this.boundSelectionMouseUp, true);
    document.addEventListener("keyup", this.boundSelectionKeyUp, true);
    document.addEventListener("mousedown", this.boundSelectionPointerDown, true);
    window.addEventListener("scroll", this.boundSelectionScroll, true);

    this.addIcons(`
      <symbol id="iconMoonAI" viewBox="0 0 32 32">
        <path d="M23.8 6.6a10.8 10.8 0 1 0 1.7 16.2A11.7 11.7 0 1 1 23.8 6.6Z" fill="currentColor"/>
        <path d="M24.7 4.1v4.2M22.6 6.2h4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </symbol>
    `);

    this.addCommand({
      langKey: "openMoonAI",
      hotkey: "⌥⌘M",
      callback: () => this.openPanel()
    });

    this.addDock({
      config: {
        position: "RightTop",
        size: { width: 430, height: 0 },
        icon: "iconMoonAI",
        title: "月照 AI 笔记助手"
      },
      data: { plugin: this },
      type: DOCK_TYPE,
      init: (dock) => this.mountDock(dock.element),
      resize: () => this.handleDockResize(),
      destroy: () => {
        this.dockElement = null;
      }
    });
  }

  onLayoutReady() {
    this.addTopBar({
      icon: "iconMoonAI",
      title: "月照 AI 笔记助手",
      position: "right",
      callback: () => this.openPanel()
    });
  }

  onunload() {
    clearTimeout(this.mentionTimer);
    document.removeEventListener("mouseup", this.boundSelectionMouseUp, true);
    document.removeEventListener("keyup", this.boundSelectionKeyUp, true);
    document.removeEventListener("mousedown", this.boundSelectionPointerDown, true);
    window.removeEventListener("scroll", this.boundSelectionScroll, true);
    this.hideSelectionToolbar();
    this.selectionDialog?.destroy?.();
    this.selectionDialog = null;
    this.dockElement = null;
  }

  async loadSettings() {
    try {
      const saved = await this.loadData(SETTINGS_FILE);
      const defaults = defaultSettings();
      let profiles;
      if (Array.isArray(saved?.profiles) && saved.profiles.length) {
        profiles = saved.profiles.map((profile, index) => createProfile(profile.provider || "custom", {
          ...profile,
          id: profile.id || `profile-migrated-${index}`,
          name: profile.name || PROVIDERS[profile.provider]?.label || `API 方案 ${index + 1}`
        }));
      } else if (saved && (saved.endpoint || saved.model || saved.apiKey)) {
        const provider = saved.provider || "custom";
        profiles = [createProfile(provider, {
          id: "profile-migrated",
          name: `${PROVIDERS[provider]?.label || "自定义 API"}（原设置）`,
          protocol: saved.protocol || PROVIDERS[provider]?.protocol || "openai",
          endpoint: saved.endpoint || "",
          model: saved.model || "",
          apiKey: saved.apiKey || "",
          temperature: saved.temperature ?? 0.4,
          systemPrompt: saved.systemPrompt || DEFAULT_SYSTEM_PROMPT
        })];
      } else {
        profiles = defaults.profiles;
      }
      const activeProfileId = profiles.some((profile) => profile.id === saved?.activeProfileId)
        ? saved.activeProfileId
        : profiles[0].id;
      this.settings = {
        activeProfileId,
        profiles,
        commands: Array.isArray(saved?.commands) && saved.commands.length
        ? saved.commands
        : defaults.commands
      };
    } catch {
      this.settings = defaultSettings();
    }
  }

  getActiveProfile() {
    const profiles = Array.isArray(this.settings?.profiles) ? this.settings.profiles : [];
    return profiles.find((profile) => profile.id === this.settings.activeProfileId) || profiles[0] || createProfile();
  }

  profileBadgeText() {
    const profile = this.getActiveProfile();
    const provider = PROVIDERS[profile.provider]?.label || "自定义";
    return profile.name === provider ? profile.name : `${profile.name} · ${provider}`;
  }

  renderProfileOptions() {
    const active = this.getActiveProfile();
    return this.settings.profiles.map((profile) =>
      `<option value="${escapeAttr(profile.id)}" ${profile.id === active.id ? "selected" : ""}>${escapeHtml(profile.name)}</option>`
    ).join("");
  }

  async persistSettings() {
    await this.saveData(SETTINGS_FILE, this.settings);
  }

  openPanel() {
    const dockButton = document.querySelector(`.dock__item[data-type="${DOCK_TYPE}"]`);
    if (!dockButton) {
      showMessage("月照 AI 右侧栏正在初始化，请稍后再试。");
      return;
    }
    if (!dockButton.classList.contains("dock__item--active")) dockButton.click();
    window.setTimeout(() => {
      this.dockElement?.querySelector('[data-field="user-prompt"]')?.focus();
    }, 120);
  }

  mountDock(element) {
    this.dockElement = element;
    element.classList.add("moon-ai-dock-host");
    element.innerHTML = `<div class="moon-ai">${this.renderShell()}</div>`;
    this.bindShellEvents();
    window.requestAnimationFrame?.(() => this.handleDockResize());
  }

  handleDockResize() {
    if (!this.dockElement) return;
    this.dockElement.classList.toggle("moon-ai-dock-host--wide", this.dockElement.clientWidth >= 680);
  }

  handleSelectionMouseUp(event) {
    if (event.target?.closest?.(".moon-ai, .moon-ai-selection-toolbar, .moon-ai-selection-result, .b3-dialog")) return;
    window.setTimeout(() => this.captureEditorSelection(), 20);
  }

  handleSelectionKeyUp(event) {
    if (!event.shiftKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    window.setTimeout(() => this.captureEditorSelection(), 20);
  }

  handleSelectionPointerDown(event) {
    if (event.target?.closest?.(".moon-ai-selection-toolbar, .moon-ai-selection-result")) return;
    this.hideSelectionToolbar();
  }

  captureEditorSelection() {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      this.hideSelectionToolbar();
      return;
    }
    const text = selection.toString();
    if (!text.trim() || text.length > 12000) {
      this.hideSelectionToolbar();
      return;
    }
    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer
      : range.endContainer.parentElement;
    const startBlock = startElement?.closest?.(".protyle-wysiwyg [data-node-id]");
    const endBlock = endElement?.closest?.(".protyle-wysiwyg [data-node-id]");
    if (!startBlock || !endBlock || startBlock.dataset.nodeId !== endBlock.dataset.nodeId) {
      this.hideSelectionToolbar();
      return;
    }
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return;
    const blockText = startBlock.innerText || startBlock.textContent || "";
    this.selectionContext = {
      blockId: startBlock.dataset.nodeId,
      selectedText: text,
      blockText,
      preferredIndex: blockText.indexOf(text),
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }
    };
    this.showSelectionToolbar(rect);
  }

  showSelectionToolbar(rect) {
    this.hideSelectionToolbar();
    const toolbar = document.createElement("div");
    toolbar.className = "moon-ai-selection-toolbar";
    toolbar.innerHTML = `
      <div class="moon-ai-selection-toolbar__head">
        <div class="moon-ai-selection-toolbar__identity"><i></i><span>月照 AI · 划词修改</span></div>
        <select data-selection-profile title="切换 API 方案">${this.renderProfileOptions()}</select>
        <button data-selection-close title="关闭">×</button>
      </div>
      <div class="moon-ai-selection-toolbar__actions">
        ${SELECTION_ACTIONS.map((action) => `
          <button data-selection-action="${action.id}"><b>${escapeHtml(action.icon)}</b>${escapeHtml(action.label)}</button>
        `).join("")}
        <span class="moon-ai-selection-toolbar__divider"></span>
        <button data-selection-custom><b>…</b>自定义</button>
      </div>
      <div class="moon-ai-selection-toolbar__custom fn__none" data-selection-custom-row>
        <input data-selection-custom-input placeholder="例如：改成更温柔的朋友圈文案…">
        <button data-selection-custom-run>开始创作 ↗</button>
      </div>
    `;
    document.body.appendChild(toolbar);
    this.selectionToolbar = toolbar;
    toolbar.querySelector("[data-selection-close]")?.addEventListener("click", () => this.hideSelectionToolbar());
    toolbar.querySelector("[data-selection-profile]")?.addEventListener("change", async (event) => {
      this.settings.activeProfileId = event.target.value;
      await this.persistSettings();
      this.updateProviderBadge();
    });
    toolbar.querySelectorAll("[data-selection-action]").forEach((button) => {
      button.addEventListener("click", () => this.runSelectionAction(button.dataset.selectionAction));
    });
    toolbar.querySelector("[data-selection-custom]")?.addEventListener("click", () => {
      const row = toolbar.querySelector("[data-selection-custom-row]");
      row?.classList.toggle("fn__none");
      row?.querySelector("input")?.focus();
      this.positionSelectionToolbar(rect);
    });
    const customInput = toolbar.querySelector("[data-selection-custom-input]");
    toolbar.querySelector("[data-selection-custom-run]")?.addEventListener("click", () => {
      const prompt = customInput?.value.trim();
      if (prompt) this.runSelectionAction("custom", prompt);
    });
    customInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const prompt = customInput.value.trim();
        if (prompt) this.runSelectionAction("custom", prompt);
      }
      if (event.key === "Escape") this.hideSelectionToolbar();
    });
    this.positionSelectionToolbar(rect);
  }

  positionSelectionToolbar(rect) {
    const toolbar = this.selectionToolbar;
    if (!toolbar) return;
    const margin = 12;
    const width = Math.min(toolbar.offsetWidth || 760, window.innerWidth - margin * 2);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    let top = rect.top - toolbar.offsetHeight - 10;
    if (top < margin) top = rect.bottom + 10;
    toolbar.style.left = `${Math.round(left)}px`;
    toolbar.style.top = `${Math.round(top)}px`;
  }

  hideSelectionToolbar() {
    this.selectionToolbar?.remove?.();
    this.selectionToolbar = null;
  }

  setSelectionToolbarLoading(actionId, loading) {
    const toolbar = this.selectionToolbar;
    if (!toolbar) return;
    toolbar.querySelectorAll("button, select, input").forEach((element) => { element.disabled = loading; });
    const active = toolbar.querySelector(`[data-selection-action="${actionId}"]`)
      || toolbar.querySelector("[data-selection-custom-run]");
    if (active) {
      if (loading) {
        active.dataset.originalHtml = active.innerHTML;
        active.innerHTML = `<i class="moon-ai-selection-spinner"></i>创作中…`;
      } else if (active.dataset.originalHtml) {
        active.innerHTML = active.dataset.originalHtml;
      }
    }
  }

  async runSelectionAction(actionId, customPrompt = "") {
    const context = this.selectionContext;
    if (!context?.selectedText) return;
    const baseAction = SELECTION_ACTIONS.find((item) => item.id === actionId);
    const savedCommand = this.settings.commands.find((item) => item.id === actionId);
    const action = baseAction ? {
      ...baseAction,
      prompt: savedCommand?.prompt || baseAction.prompt
    } : {
      id: "custom",
      icon: "…",
      label: "自定义修改",
      prompt: customPrompt
    };
    if (!action.prompt) return;
    this.setSelectionToolbarLoading(actionId, true);
    try {
      const profile = this.getActiveProfile();
      const blockSource = await getBlockSource(context.blockId);
      const messages = [
        {
          role: "system",
          content: `${profile.systemPrompt}\n\n你正在执行思源笔记的划词修改。只输出可直接应用的最终文字，不要说“好的”、不要解释修改理由、不要包裹代码块。`
        },
        {
          role: "user",
          content: `【修改任务】\n${action.prompt}\n\n【所选文字】\n${context.selectedText.trim()}\n\n【所在文本块，仅供理解上下文】\n${blockSource.slice(0, 6000)}`
        }
      ];
      const result = await callAI(profile, messages);
      this.selectionResult = result;
      this.selectionSession = { actionId: action.id, action, customPrompt };
      this.hideSelectionToolbar();
      this.showSelectionResultDialog();
    } catch (error) {
      this.setSelectionToolbarLoading(actionId, false);
      showMessage(`划词 AI 处理失败：${error.message}`, 7000, "error");
    }
  }

  showSelectionResultDialog() {
    const context = this.selectionContext;
    const session = this.selectionSession;
    if (!context || !session) return;
    this.selectionDialog?.destroy?.();
    const diff = diffPreview(context.selectedText.trim(), this.selectionResult);
    const profile = this.getActiveProfile();
    this.selectionDialog = new Dialog({
      title: `${session.action.label} · 划词 AI 对照`,
      content: `
        <div class="moon-ai-selection-result">
          <header class="moon-ai-selection-result__hero">
            <div><i></i><span>MOON AI EDIT</span><strong>${escapeHtml(session.action.label)}</strong></div>
            <small>${escapeHtml(profile.name)} · ${escapeHtml(profile.model || "未设置模型")}</small>
          </header>
          <div class="moon-ai-selection-result__toolbar">
            <button data-selection-regenerate>↻ 重新生成</button>
            <button data-selection-edit>✎ 直接编辑</button>
            <button data-selection-copy>□ 复制结果</button>
            <span></span>
            <button data-selection-insert>插入原文后</button>
            <button class="is-primary" data-selection-apply>✓ 替换选中文字</button>
            <button class="is-quiet" data-selection-cancel>取消</button>
          </div>
          <div class="moon-ai-selection-result__compare">
            <section><h4><span>原</span>原文</h4><div class="moon-ai-selection-result__text">${diff.leftHtml}</div></section>
            <section><h4><span>新</span>AI 修改后</h4><div class="moon-ai-selection-result__text" data-selection-preview>${diff.rightHtml}</div><textarea class="fn__none" data-selection-editor>${escapeHtml(this.selectionResult)}</textarea></section>
          </div>
          <footer><div><i class="is-removed"></i>删除 <i class="is-added"></i>新增</div><span>发现 ${diff.changes} 组主要变化</span></footer>
        </div>
      `,
      width: "980px",
      height: "650px",
      destroyCallback: () => { this.selectionDialog = null; }
    });
    this.bindSelectionResultEvents();
  }

  bindSelectionResultEvents() {
    const root = this.selectionDialog?.element?.querySelector(".moon-ai-selection-result");
    if (!root) return;
    const editor = root.querySelector("[data-selection-editor]");
    const preview = root.querySelector("[data-selection-preview]");
    root.querySelector("[data-selection-cancel]")?.addEventListener("click", () => this.selectionDialog?.destroy());
    root.querySelector("[data-selection-copy]")?.addEventListener("click", async () => {
      await copyText(editor?.classList.contains("fn__none") ? this.selectionResult : editor.value);
      showMessage("已复制划词 AI 结果。");
    });
    root.querySelector("[data-selection-edit]")?.addEventListener("click", (event) => {
      const editing = editor.classList.contains("fn__none");
      if (editing) {
        preview.classList.add("fn__none");
        editor.classList.remove("fn__none");
        editor.focus();
        event.currentTarget.textContent = "✓ 完成编辑";
      } else {
        this.selectionResult = editor.value.trim();
        const nextDiff = diffPreview(this.selectionContext.selectedText.trim(), this.selectionResult);
        preview.innerHTML = nextDiff.rightHtml;
        editor.classList.add("fn__none");
        preview.classList.remove("fn__none");
        event.currentTarget.textContent = "✎ 直接编辑";
      }
    });
    root.querySelector("[data-selection-regenerate]")?.addEventListener("click", () => {
      if (!editor.classList.contains("fn__none")) this.selectionResult = editor.value.trim();
      const { actionId, customPrompt } = this.selectionSession;
      this.selectionDialog?.destroy();
      this.runSelectionAction(actionId, customPrompt);
    });
    root.querySelector("[data-selection-apply]")?.addEventListener("click", () => this.applySelectionResult("replace", editor));
    root.querySelector("[data-selection-insert]")?.addEventListener("click", () => this.applySelectionResult("insert", editor));
  }

  async applySelectionResult(mode, editor) {
    const context = this.selectionContext;
    const result = (editor && !editor.classList.contains("fn__none") ? editor.value : this.selectionResult).trim();
    if (!context || !result) return;
    try {
      let source = await getBlockSource(context.blockId);
      const replacement = mode === "insert" ? `\n\n${result}` : result;
      let updated = replaceClosest(source, context.selectedText, replacement, context.preferredIndex, mode === "insert");
      if (updated === null) {
        const kramdown = await getKramdown(context.blockId);
        if (kramdown !== source) {
          source = kramdown;
          updated = replaceClosest(source, context.selectedText, replacement, context.preferredIndex, mode === "insert");
        }
      }
      if (updated === null) throw new Error("原文已发生变化，无法定位刚才选中的文字。请重新选中后再试。");
      await updateBlock(context.blockId, updated);
      this.selectionDialog?.destroy();
      window.getSelection?.()?.removeAllRanges?.();
      showMessage(mode === "insert" ? "AI 结果已插入原文之后。" : "AI 修改已应用到选中文字。");
    } catch (error) {
      showMessage(`应用修改失败：${error.message}`, 7000, "error");
    }
  }

  renderShell() {
    return `
      <header class="moon-ai__hero">
        <div class="moon-ai__brand">
          <span class="moon-ai__enso" aria-hidden="true"></span>
          <div>
            <span class="moon-ai__eyebrow">MOON AI · SIYUAN</span>
            <h2>月照 AI</h2>
            <p>引用你的笔记，让回答回到你的知识与文字里。</p>
          </div>
        </div>
        <select class="moon-ai__provider-badge" data-profile-switch title="快速切换 API 连接方案">${this.renderProfileOptions()}</select>
      </header>
      <nav class="moon-ai__tabs" aria-label="月照 AI 功能">
        <button class="is-active" data-tab="workbench">对话与修改</button>
        <button data-tab="commands">快捷指令</button>
        <button data-tab="settings">AI 设置</button>
      </nav>
      <main class="moon-ai__content" data-view>${this.renderWorkbench()}</main>
    `;
  }

  renderWorkbench() {
    return `
      <div class="moon-ai__workspace">
        <section class="moon-ai__conversation">
          <div class="moon-ai__section-title">
            <div><span>01</span><h3>向 AI 提问</h3></div>
            <span class="moon-ai__context-status" data-context-status>${this.references.length ? `已连接 ${this.references.length} 篇笔记` : "尚未引用笔记"}</span>
          </div>
          <div class="moon-ai__quickbar" data-quickbar>${this.renderQuickbar()}</div>
          <div class="moon-ai__reference-strip">
            <div class="moon-ai__selected-head">
              <span>已引用 <b data-ref-count>${this.references.length}</b></span>
              <span>◇ 为写回目标</span>
            </div>
            <div class="moon-ai__selected" data-selected-notes>${this.renderSelectedNotes()}</div>
          </div>
          <label class="moon-ai__prompt-wrap">
            <textarea data-field="user-prompt" placeholder="输入 @ 检索并引用笔记…\n例如：结合 @觉察日记 和 @课程大纲，整理成一篇新文章。"></textarea>
            <div class="moon-ai__mention-popup fn__none" data-mention-popup></div>
            <div class="moon-ai__prompt-foot">
              <div class="moon-ai__prompt-tools">
                <button type="button" data-action="use-current">+  引用当前笔记</button>
                <span><b>@</b> 搜索笔记</span>
              </div>
              <button class="moon-ai__primary" data-action="run">
                <span data-run-label>开始回答</span><b>↗</b>
              </button>
            </div>
          </label>
          <div class="moon-ai__answer" data-answer>${this.renderAnswer()}</div>
        </section>
      </div>
    `;
  }

  renderQuickbar() {
    return this.settings.commands.map((command) => `
      <button data-action="quick-run" data-command-id="${escapeAttr(command.id)}" title="点击后立即执行">
        <span>${escapeHtml(command.icon || "○")}</span>${escapeHtml(command.name)}
      </button>
    `).join("");
  }

  renderSelectedNotes() {
    if (!this.references.length) {
      return `<div class="moon-ai__empty"><span>@</span><p>在下方输入 @ 搜索并引用笔记</p></div>`;
    }
    return this.references.map((note) => `
      <article class="moon-ai__note ${note.id === this.targetID ? "is-target" : ""}" data-note-id="${escapeAttr(note.id)}">
        <button class="moon-ai__target" data-action="set-target" data-id="${escapeAttr(note.id)}" title="设为 AI 结果写回目标">◇</button>
        <div title="${escapeAttr(note.hpath || "")}"><strong>${escapeHtml(note.content || "未命名笔记")}</strong></div>
        <button class="moon-ai__remove" data-action="remove-reference" data-id="${escapeAttr(note.id)}" title="取消引用">×</button>
      </article>
    `).join("");
  }

  renderAnswer() {
    if (!this.result) {
      return `
        <div class="moon-ai__answer-empty">
          <span class="moon-ai__answer-moon">◔</span>
          <div><strong>答案会在这里渐渐清晰</strong><p>可一键复制，也可追加或替换目标笔记。</p></div>
        </div>
      `;
    }
    return `
      <div class="moon-ai__answer-head">
        <div><span>●</span><strong>AI 回答</strong></div>
        <div class="moon-ai__answer-actions">
          <button data-action="copy">复制</button>
          <button data-action="append" ${this.targetID ? "" : "disabled"}>追加到目标</button>
          <button class="is-danger" data-action="replace" ${this.targetID ? "" : "disabled"}>替换目标正文</button>
        </div>
      </div>
      <pre data-answer-text>${escapeHtml(this.result)}</pre>
    `;
  }

  renderCommands() {
    return `
      <section class="moon-ai__single-panel">
        <div class="moon-ai__panel-intro"><span>QUICK COMMANDS</span><h3>快捷指令</h3><p>设置常用提示词。在对话页点击指令，会立即读取引用笔记并生成回答。</p></div>
        <div class="moon-ai__command-list" data-command-list>${this.renderCommandRows()}</div>
        <div class="moon-ai__form-actions">
          <button class="moon-ai__secondary" data-action="add-command">+  新增指令</button>
          <button class="moon-ai__primary" data-action="save-commands">保存快捷指令</button>
        </div>
      </section>
    `;
  }

  renderCommandRows() {
    return this.settings.commands.map((command, index) => `
      <article class="moon-ai__command-row" data-command-row data-id="${escapeAttr(command.id)}">
        <label class="moon-ai__icon-field"><span>图标</span><input data-command-icon value="${escapeAttr(command.icon || "○")}" maxlength="2"></label>
        <label class="moon-ai__name-field"><span>指令名称</span><input data-command-name value="${escapeAttr(command.name)}" placeholder="例如：润色文章"></label>
        <label class="moon-ai__prompt-field"><span>自定义提示词</span><textarea data-command-prompt placeholder="请描述 AI 要如何处理引用内容">${escapeHtml(command.prompt)}</textarea></label>
        <button class="moon-ai__row-remove" data-action="delete-command" data-index="${index}" title="删除指令">×</button>
      </article>
    `).join("");
  }

  renderSettings() {
    const profile = this.getActiveProfile();
    const profileOptions = this.renderProfileOptions();
    const options = Object.entries(PROVIDERS).map(([key, item]) =>
      `<option value="${key}" ${profile.provider === key ? "selected" : ""}>${escapeHtml(item.label)}</option>`
    ).join("");
    return `
      <section class="moon-ai__single-panel">
        <div class="moon-ai__panel-intro"><span>MODEL CONNECTION</span><h3>AI 设置</h3><p>每个连接方案独立保存 API 地址、模型和 Key，可随时切换。API Key 仅保存在当前思源工作空间。</p></div>
        <div class="moon-ai__profile-bar">
          <label><span>当前连接方案</span><select data-setting="profile">${profileOptions}</select></label>
          <button class="moon-ai__secondary" data-action="add-profile">+  新增</button>
          <button class="moon-ai__quiet-button" data-action="delete-profile" ${this.settings.profiles.length <= 1 ? "disabled" : ""}>删除</button>
        </div>
        <div class="moon-ai__settings-grid">
          <label class="is-wide"><span>方案名称</span><input data-setting="profileName" value="${escapeAttr(profile.name)}" placeholder="例如：DeepSeek 写作"></label>
          <label><span>AI 供应商</span><select data-setting="provider">${options}</select></label>
          <label><span>接口协议</span><select data-setting="protocol">
            <option value="openai" ${profile.protocol === "openai" ? "selected" : ""}>OpenAI Compatible</option>
            <option value="ollama" ${profile.protocol === "ollama" ? "selected" : ""}>Ollama Chat</option>
          </select></label>
          <label class="is-wide"><span>API 地址</span><input data-setting="endpoint" value="${escapeAttr(profile.endpoint)}" placeholder="https://api.example.com/v1"><small class="moon-ai__field-hint">支持域名、接口前缀或完整 /chat/completions 地址；自定义路径会原样保留。</small></label>
          <label><span>模型名称</span><input data-setting="model" value="${escapeAttr(profile.model)}" placeholder="deepseek-chat"></label>
          <label><span>Temperature</span><input data-setting="temperature" type="number" min="0" max="2" step="0.1" value="${escapeAttr(profile.temperature)}"></label>
          <label class="is-wide"><span>API Key（本地模型可留空）</span><input data-setting="apiKey" type="password" autocomplete="off" value="${escapeAttr(profile.apiKey)}" placeholder="sk-..."></label>
          <label class="is-wide"><span>系统提示词</span><textarea data-setting="systemPrompt">${escapeHtml(profile.systemPrompt)}</textarea></label>
        </div>
        <div class="moon-ai__privacy"><span>◌</span><p><strong>隐私提醒</strong>使用远程供应商时，被引用的笔记内容会发送给该供应商；Ollama 与 LM Studio 可在本机处理。</p></div>
        <div class="moon-ai__form-actions">
          <button class="moon-ai__secondary" data-action="test-provider">测试连接</button>
          <button class="moon-ai__primary" data-action="save-settings">保存当前方案</button>
        </div>
      </section>
    `;
  }

  bindShellEvents() {
    const root = this.getRoot();
    if (!root) return;
    root.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => this.switchTab(button.dataset.tab));
    });
    root.querySelector("[data-profile-switch]")?.addEventListener("change", (event) => this.switchActiveProfile(event.target.value));
    this.bindActiveView();
  }

  getRoot() {
    return this.dockElement?.querySelector(".moon-ai") || null;
  }

  getView() {
    return this.getRoot()?.querySelector("[data-view]") || null;
  }

  switchTab(tab) {
    this.activeTab = tab;
    const root = this.getRoot();
    const view = this.getView();
    if (!root || !view) return;
    root.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
    view.innerHTML = tab === "settings" ? this.renderSettings() : tab === "commands" ? this.renderCommands() : this.renderWorkbench();
    this.bindActiveView();
  }

  bindActiveView() {
    if (this.activeTab === "settings") return this.bindSettingsEvents();
    if (this.activeTab === "commands") return this.bindCommandEvents();
    return this.bindWorkbenchEvents();
  }

  bindWorkbenchEvents() {
    const view = this.getView();
    if (!view) return;
    view.querySelector('[data-action="use-current"]')?.addEventListener("click", () => this.addCurrentNote());
    view.querySelector('[data-action="run"]')?.addEventListener("click", () => this.runAI());
    const promptField = view.querySelector('[data-field="user-prompt"]');
    promptField?.addEventListener("input", () => this.scheduleMentionSearch(promptField));
    promptField?.addEventListener("click", () => this.scheduleMentionSearch(promptField));
    promptField?.addEventListener("blur", () => {
      window.setTimeout(() => this.hideMentionPopup(), 160);
    });
    promptField?.addEventListener("keydown", (event) => {
      if (this.handleMentionKeydown(event, promptField)) return;
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.runAI();
      }
    });
    view.querySelectorAll('[data-action="quick-run"]').forEach((button) => {
      button.addEventListener("click", () => this.runAI(button.dataset.commandId));
    });
    this.bindDynamicWorkbenchActions();
  }

  bindDynamicWorkbenchActions() {
    const view = this.getView();
    if (!view) return;
    view.querySelectorAll('[data-action="set-target"]').forEach((button) => {
      button.addEventListener("click", () => {
        this.targetID = button.dataset.id;
        this.refreshWorkbenchParts();
      });
    });
    view.querySelectorAll('[data-action="remove-reference"]').forEach((button) => {
      button.addEventListener("click", () => {
        this.references = this.references.filter((item) => item.id !== button.dataset.id);
        if (this.targetID === button.dataset.id) this.targetID = this.references[0]?.id || "";
        this.refreshWorkbenchParts();
      });
    });
    view.querySelector('[data-action="copy"]')?.addEventListener("click", () => this.copyResult());
    view.querySelector('[data-action="append"]')?.addEventListener("click", () => this.appendResult());
    view.querySelector('[data-action="replace"]')?.addEventListener("click", () => this.replaceResult());
  }

  bindSettingsEvents() {
    const view = this.getView();
    if (!view) return;
    view.querySelector('[data-setting="profile"]')?.addEventListener("change", (event) => this.switchActiveProfile(event.target.value));
    view.querySelector('[data-setting="provider"]')?.addEventListener("change", (event) => {
      const preset = PROVIDERS[event.target.value];
      if (!preset || event.target.value === "custom") return;
      view.querySelector('[data-setting="protocol"]').value = preset.protocol;
      view.querySelector('[data-setting="endpoint"]').value = preset.endpoint;
      view.querySelector('[data-setting="model"]').value = preset.model;
    });
    view.querySelector('[data-action="add-profile"]')?.addEventListener("click", () => this.addProfile());
    view.querySelector('[data-action="delete-profile"]')?.addEventListener("click", () => this.deleteActiveProfile());
    view.querySelector('[data-action="save-settings"]')?.addEventListener("click", () => this.saveSettingsFromView());
    view.querySelector('[data-action="test-provider"]')?.addEventListener("click", () => this.testProvider());
  }

  bindCommandEvents() {
    const view = this.getView();
    if (!view) return;
    view.querySelector('[data-action="add-command"]')?.addEventListener("click", () => {
      this.captureCommandsFromView();
      this.settings.commands.push({ id: `custom-${Date.now()}`, icon: "○", name: "新指令", prompt: "" });
      this.switchTab("commands");
    });
    view.querySelector('[data-action="save-commands"]')?.addEventListener("click", () => this.saveCommands());
    view.querySelectorAll('[data-action="delete-command"]').forEach((button) => {
      button.addEventListener("click", () => {
        this.captureCommandsFromView();
        if (this.settings.commands.length <= 1) {
          showMessage("至少保留一个快捷指令。");
          return;
        }
        this.settings.commands.splice(Number(button.dataset.index), 1);
        this.switchTab("commands");
      });
    });
  }

  async initializeCurrentNote() {
    if (!this.references.length) await this.addCurrentNote(true);
  }

  async getDocMeta(id) {
    const rows = await sql(`SELECT id, content, hpath, box, updated FROM blocks WHERE id='${sqlString(id)}' AND type='d' LIMIT 1`);
    return rows?.[0] || null;
  }

  async addCurrentNote(silent = false) {
    try {
      const id = currentDocID();
      if (!id) {
        if (!silent) showMessage("没有识别到当前笔记，请先打开一篇笔记。");
        return;
      }
      const note = await this.getDocMeta(id);
      if (!note) throw new Error("当前页面不是可引用的文档。");
      this.addReference(note);
    } catch (error) {
      if (!silent) showMessage(error.message, 5000, "error");
    }
  }

  addReference(note) {
    if (!note?.id) return;
    if (!this.references.some((item) => item.id === note.id)) this.references.push(note);
    if (!this.targetID) this.targetID = note.id;
    this.refreshWorkbenchParts();
  }

  refreshWorkbenchParts() {
    if (this.activeTab !== "workbench") return;
    const view = this.getView();
    if (!view) return;
    const selected = view.querySelector("[data-selected-notes]");
    const answer = view.querySelector("[data-answer]");
    if (selected) selected.innerHTML = this.renderSelectedNotes();
    if (answer) answer.innerHTML = this.renderAnswer();
    const count = view.querySelector("[data-ref-count]");
    if (count) count.textContent = String(this.references.length);
    const status = view.querySelector("[data-context-status]");
    if (status) status.textContent = this.references.length ? `已连接 ${this.references.length} 篇笔记` : "尚未引用笔记";
    this.bindDynamicWorkbenchActions();
  }

  scheduleMentionSearch(textarea) {
    clearTimeout(this.mentionTimer);
    const mention = this.getActiveMention(textarea);
    if (!mention) {
      this.hideMentionPopup();
      return;
    }
    this.mentionStart = mention.start;
    this.mentionTimer = window.setTimeout(() => this.searchMentionNotes(mention.query), 180);
  }

  getActiveMention(textarea) {
    if (!textarea) return null;
    const cursor = Number(textarea.selectionStart ?? textarea.value.length);
    const beforeCursor = textarea.value.slice(0, cursor);
    const at = beforeCursor.lastIndexOf("@");
    if (at < 0) return null;
    const prefix = at > 0 ? beforeCursor[at - 1] : "";
    if (prefix && /[A-Za-z0-9._+\-]/.test(prefix)) return null;
    const query = beforeCursor.slice(at + 1);
    if (query.length > 40 || /[\n\r]/.test(query) || /@/.test(query) || /\u300b\s/.test(query)) return null;
    return { start: at, query: query.trim(), cursor };
  }

  async searchMentionNotes(keyword) {
    const popup = this.getView()?.querySelector("[data-mention-popup]");
    if (!popup) return;
    popup.classList.remove("fn__none");
    popup.innerHTML = `<div class="moon-ai__mention-state">正在检索笔记…</div>`;
    try {
      const safe = sqlString(keyword);
      const where = keyword
        ? `AND (content LIKE '%${safe}%' OR hpath LIKE '%${safe}%')`
        : "";
      const rows = await sql(`SELECT id, content, hpath, box, updated FROM blocks WHERE type='d' ${where} ORDER BY updated DESC LIMIT 12`);
      this.mentionResults = rows || [];
      this.mentionIndex = 0;
      this.renderMentionResults();
    } catch (error) {
      this.mentionResults = [];
      popup.innerHTML = `<div class="moon-ai__mention-state is-error">${escapeHtml(error.message)}</div>`;
    }
  }

  renderMentionResults() {
    const popup = this.getView()?.querySelector("[data-mention-popup]");
    if (!popup) return;
    if (!this.mentionResults.length) {
      popup.innerHTML = `<div class="moon-ai__mention-state">没有找到匹配笔记</div>`;
      return;
    }
    popup.innerHTML = `
      <div class="moon-ai__mention-head"><span>@ 引用笔记</span><small>↑↓ 选择 · Enter 引用</small></div>
      <div class="moon-ai__mention-list">
        ${this.mentionResults.map((note, index) => `
          <button class="moon-ai__mention-item ${index === this.mentionIndex ? "is-active" : ""}" data-mention-index="${index}" type="button">
            <span class="moon-ai__mention-mark">${this.references.some((item) => item.id === note.id) ? "✓" : "@"}</span>
            <span><strong>${escapeHtml(note.content || "未命名笔记")}</strong><small>${escapeHtml(note.hpath || "")}</small></span>
          </button>
        `).join("")}
      </div>
    `;
    popup.querySelectorAll("[data-mention-index]").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("mouseenter", () => {
        this.mentionIndex = Number(button.dataset.mentionIndex);
        this.updateMentionActiveItem();
      });
      button.addEventListener("click", () => this.selectMention(Number(button.dataset.mentionIndex)));
    });
  }

  updateMentionActiveItem() {
    const popup = this.getView()?.querySelector("[data-mention-popup]");
    popup?.querySelectorAll("[data-mention-index]").forEach((item, index) => {
      item.classList.toggle("is-active", index === this.mentionIndex);
      if (index === this.mentionIndex) item.scrollIntoView({ block: "nearest" });
    });
  }

  handleMentionKeydown(event, textarea) {
    const popup = this.getView()?.querySelector("[data-mention-popup]");
    const isOpen = popup && !popup.classList.contains("fn__none");
    if (!isOpen) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.mentionResults.length) return true;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      this.mentionIndex = (this.mentionIndex + direction + this.mentionResults.length) % this.mentionResults.length;
      this.updateMentionActiveItem();
      return true;
    }
    if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (!this.mentionResults.length) return false;
      event.preventDefault();
      this.selectMention(this.mentionIndex, textarea);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.hideMentionPopup();
      return true;
    }
    return false;
  }

  selectMention(index, suppliedTextarea = null) {
    const note = this.mentionResults[index];
    const textarea = suppliedTextarea || this.getView()?.querySelector('[data-field="user-prompt"]');
    if (!note || !textarea || this.mentionStart < 0) return;
    const cursor = Number(textarea.selectionStart ?? textarea.value.length);
    const token = `@《${note.content || "未命名笔记"}》 `;
    textarea.value = `${textarea.value.slice(0, this.mentionStart)}${token}${textarea.value.slice(cursor)}`;
    const nextCursor = this.mentionStart + token.length;
    textarea.setSelectionRange(nextCursor, nextCursor);
    this.addReference(note);
    this.hideMentionPopup();
    textarea.focus();
  }

  hideMentionPopup() {
    clearTimeout(this.mentionTimer);
    const popup = this.getView()?.querySelector("[data-mention-popup]");
    popup?.classList.add("fn__none");
    this.mentionResults = [];
    this.mentionStart = -1;
    this.mentionIndex = 0;
  }

  async buildContext() {
    const chunks = [];
    let used = 0;
    for (const note of this.references) {
      const markdown = await getKramdown(note.id);
      const body = markdown.length > MAX_NOTE_CHARS
        ? `${markdown.slice(0, MAX_NOTE_CHARS)}\n\n[该笔记内容已截断]`
        : markdown;
      const chunk = `### 引用笔记：${note.content || "未命名"}\n路径：${note.hpath || ""}\n块 ID：${note.id}\n\n${body}`;
      if (used + chunk.length > MAX_CONTEXT_CHARS) {
        const remaining = MAX_CONTEXT_CHARS - used;
        if (remaining > 800) chunks.push(`${chunk.slice(0, remaining)}\n\n[总上下文已达上限]`);
        break;
      }
      chunks.push(chunk);
      used += chunk.length;
    }
    return chunks.join("\n\n---\n\n");
  }

  async runAI(commandId = "") {
    if (this.isRunning) return;
    const view = this.getView();
    const promptField = view?.querySelector('[data-field="user-prompt"]');
    const command = commandId ? this.settings.commands.find((item) => item.id === commandId) : null;
    const userInput = String(promptField?.value || "").trim();
    const instruction = command?.prompt?.trim() || userInput;
    if (!instruction) {
      showMessage("请输入问题，或点击一个快捷指令。");
      return;
    }
    if (!this.references.length && !userInput) {
      showMessage("请先引用至少一篇笔记。");
      return;
    }

    this.isRunning = true;
    const label = view?.querySelector("[data-run-label]");
    const runButton = view?.querySelector('[data-action="run"]');
    if (label) label.textContent = "正在思考…";
    if (runButton) runButton.disabled = true;
    view?.querySelectorAll('[data-action="quick-run"]').forEach((button) => { button.disabled = true; });
    const answer = view?.querySelector("[data-answer]");
    if (answer) answer.innerHTML = `<div class="moon-ai__loading"><i></i><i></i><i></i><span>正在读取你的笔记…</span></div>`;

    try {
      const activeProfile = this.getActiveProfile();
      const context = await this.buildContext();
      const target = this.references.find((item) => item.id === this.targetID);
      const taskText = command && userInput
        ? `${command.prompt}\n\n用户的补充要求：${userInput}`
        : instruction;
      const content = [
        `【任务】\n${taskText}`,
        target ? `【可能的写回目标】\n${target.content}\n请只生成适合写入该笔记的 Markdown 内容，不要在开头说“好的”或解释处理过程。` : "",
        context ? `【引用笔记】\n${context}` : "【引用笔记】\n无"
      ].filter(Boolean).join("\n\n");
      this.result = await callAI(activeProfile, [
        { role: "system", content: activeProfile.systemPrompt },
        { role: "user", content }
      ]);
      this.refreshWorkbenchParts();
    } catch (error) {
      this.result = "";
      if (answer) answer.innerHTML = `<div class="moon-ai__answer-error"><strong>暂时没有得到回答</strong><p>${escapeHtml(error.message)}</p></div>`;
      showMessage(error.message, 7000, "error");
    } finally {
      this.isRunning = false;
      const currentView = this.getView();
      const currentLabel = currentView?.querySelector("[data-run-label]");
      const currentRunButton = currentView?.querySelector('[data-action="run"]');
      if (currentLabel) currentLabel.textContent = "开始回答";
      if (currentRunButton) currentRunButton.disabled = false;
      currentView?.querySelectorAll('[data-action="quick-run"]').forEach((button) => { button.disabled = false; });
    }
  }

  async copyResult() {
    if (!this.result) return;
    try {
      await copyText(this.result);
      showMessage("已复制 AI 回答。");
    } catch {
      showMessage("复制失败，请选中文本后手动复制。", 5000, "error");
    }
  }

  getTarget() {
    return this.references.find((item) => item.id === this.targetID) || null;
  }

  async appendResult() {
    const target = this.getTarget();
    if (!target || !this.result) return;
    try {
      await appendBlock(target.id, this.result);
      showMessage(`已追加到《${target.content}》。`);
    } catch (error) {
      showMessage(`追加失败：${error.message}`, 7000, "error");
    }
  }

  async replaceResult() {
    const target = this.getTarget();
    if (!target || !this.result) return;
    const confirmed = window.confirm(`确定用 AI 回答替换《${target.content}》的全部正文吗？\n\n思源会记录文档历史，但仍建议你先确认回答内容。`);
    if (!confirmed) return;
    try {
      await updateBlock(target.id, this.result);
      showMessage(`已替换《${target.content}》正文。`);
    } catch (error) {
      showMessage(`替换失败：${error.message}`, 7000, "error");
    }
  }

  readProfileFromView() {
    const view = this.getView();
    const current = this.getActiveProfile();
    if (!view?.querySelector('[data-setting="provider"]')) return current;
    return {
      ...current,
      name: view.querySelector('[data-setting="profileName"]')?.value.trim() || current.name || "未命名方案",
      provider: view.querySelector('[data-setting="provider"]')?.value || current.provider,
      protocol: view.querySelector('[data-setting="protocol"]')?.value || current.protocol,
      endpoint: view.querySelector('[data-setting="endpoint"]')?.value.trim() || "",
      model: view.querySelector('[data-setting="model"]')?.value.trim() || "",
      apiKey: view.querySelector('[data-setting="apiKey"]')?.value.trim() || "",
      temperature: Math.max(0, Math.min(2, Number(view.querySelector('[data-setting="temperature"]')?.value || 0.4))),
      systemPrompt: view.querySelector('[data-setting="systemPrompt"]')?.value.trim() || DEFAULT_SYSTEM_PROMPT
    };
  }

  captureActiveProfileFromView() {
    const profile = this.readProfileFromView();
    const index = this.settings.profiles.findIndex((item) => item.id === profile.id);
    if (index >= 0) this.settings.profiles[index] = profile;
    return profile;
  }

  updateProviderBadge() {
    const switcher = this.getRoot()?.querySelector("[data-profile-switch]");
    if (!switcher) return;
    switcher.innerHTML = this.renderProfileOptions();
    switcher.value = this.settings.activeProfileId;
    switcher.title = `当前方案：${this.profileBadgeText()}`;
  }

  async switchActiveProfile(profileId) {
    if (!this.settings.profiles.some((profile) => profile.id === profileId)) return;
    if (this.activeTab === "settings") this.captureActiveProfileFromView();
    this.settings.activeProfileId = profileId;
    await this.persistSettings();
    this.updateProviderBadge();
    if (this.activeTab === "settings") this.switchTab("settings");
    showMessage(`已切换到 API 方案“${this.getActiveProfile().name}”。`);
  }

  async addProfile() {
    const source = this.captureActiveProfileFromView();
    const profile = createProfile(source.provider, {
      ...source,
      id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${source.name || "API 方案"} 副本`
    });
    this.settings.profiles.push(profile);
    this.settings.activeProfileId = profile.id;
    await this.persistSettings();
    this.switchTab("settings");
    this.updateProviderBadge();
    this.getView()?.querySelector('[data-setting="profileName"]')?.select();
  }

  async deleteActiveProfile() {
    if (this.settings.profiles.length <= 1) {
      showMessage("至少需要保留一个 API 连接方案。");
      return;
    }
    const profile = this.getActiveProfile();
    if (!window.confirm(`确定删除 API 连接方案“${profile.name}”吗？`)) return;
    this.settings.profiles = this.settings.profiles.filter((item) => item.id !== profile.id);
    this.settings.activeProfileId = this.settings.profiles[0].id;
    await this.persistSettings();
    this.switchTab("settings");
    this.updateProviderBadge();
    showMessage(`已删除方案“${profile.name}”。`);
  }

  async saveSettingsFromView() {
    const profile = this.captureActiveProfileFromView();
    await this.persistSettings();
    this.updateProviderBadge();
    this.switchTab("settings");
    showMessage(`API 方案“${profile.name}”已保存。`);
  }

  async testProvider() {
    const candidate = this.readProfileFromView();
    const button = this.getView()?.querySelector('[data-action="test-provider"]');
    if (button) {
      button.disabled = true;
      button.textContent = "正在测试…";
    }
    try {
      const reply = await callAI(candidate, [
        { role: "system", content: "你是连接测试助手。" },
        { role: "user", content: "请只回答：连接成功" }
      ]);
      showMessage(`AI 连接成功：${reply.slice(0, 60)}`);
    } catch (error) {
      showMessage(`连接失败：${error.message}`, 7000, "error");
    } finally {
      const currentButton = this.getView()?.querySelector('[data-action="test-provider"]');
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = "测试连接";
      }
    }
  }

  captureCommandsFromView() {
    const rows = Array.from(this.getView()?.querySelectorAll("[data-command-row]") || []);
    if (!rows.length) return;
    this.settings.commands = rows.map((row, index) => ({
      id: row.dataset.id || `custom-${Date.now()}-${index}`,
      icon: row.querySelector("[data-command-icon]")?.value.trim() || "○",
      name: row.querySelector("[data-command-name]")?.value.trim() || `指令 ${index + 1}`,
      prompt: row.querySelector("[data-command-prompt]")?.value.trim() || ""
    }));
  }

  async saveCommands() {
    this.captureCommandsFromView();
    const invalid = this.settings.commands.find((item) => !item.name || !item.prompt);
    if (invalid) {
      showMessage("每个指令都需要填写名称和提示词。");
      return;
    }
    await this.persistSettings();
    showMessage("快捷指令已保存。");
  }
}

module.exports = MoonAIPlugin;
