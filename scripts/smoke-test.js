"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "index.js"), "utf8")
  .replace(
    "module.exports = MoonAIPlugin;",
    "module.exports = { MoonAIPlugin, chatCompletionUrl, ollamaChatUrl, normalizeAIText, defaultSettings, callAI, replaceClosest, diffPreview, SELECTION_ACTIONS };"
  );

class PluginMock {
  addCommand() {}
  addTopBar() {}
  addIcons() {}
  addDock(config) { this.registeredDock = config; }
  async loadData() { return null; }
  async saveData() {}
}

let fetchMock = async () => {
  throw new Error("Unexpected fetch");
};

const sandbox = {
  module: { exports: {} },
  exports: {},
  require(id) {
    if (id === "siyuan") return { Dialog: class {}, Plugin: PluginMock, showMessage() {} };
    throw new Error(`Unexpected require: ${id}`);
  },
  fetch: (...args) => fetchMock(...args),
  URL,
  console,
  setTimeout,
  clearTimeout,
  navigator: {},
  document: { querySelector() { return null; }, addEventListener() {}, removeEventListener() {} },
  window: { confirm() { return true; }, addEventListener() {}, removeEventListener() {} }
};

vm.runInNewContext(source, sandbox, { filename: "index.js" });
const api = sandbox.module.exports;

assert.equal(api.chatCompletionUrl("https://api.deepseek.com"), "https://api.deepseek.com/v1/chat/completions");
assert.equal(api.chatCompletionUrl("http://localhost:1234/v1/"), "http://localhost:1234/v1/chat/completions");
assert.equal(api.chatCompletionUrl("https://example.com/chat/completions"), "https://example.com/chat/completions");
assert.equal(api.ollamaChatUrl("http://127.0.0.1:11434/"), "http://127.0.0.1:11434/api/chat");
assert.equal(api.normalizeAIText("```markdown\n# 标题\n```"), "# 标题");
assert.ok(api.defaultSettings().commands.length >= 4);
assert.equal(api.defaultSettings().profiles.length, 1);
assert.equal(api.SELECTION_ACTIONS.length, 8);
assert.equal(api.replaceClosest("甲乙甲乙", "甲乙", "新", 3), "甲乙新");
assert.equal(api.replaceClosest("甲乙丙", "乙", "新", 1, true), "甲乙新丙");
assert.equal(api.replaceClosest("甲乙", "丙", "新"), null);
assert.equal(api.diffPreview("我喜欢春天", "我喜欢秋天").changes, 2);

const plugin = new api.MoonAIPlugin();
plugin.settings = api.defaultSettings();
plugin.references = [];
plugin.targetID = "";
plugin.result = "";
assert.match(plugin.renderWorkbench(), /data-action="use-current"/);
assert.match(plugin.renderWorkbench(), /data-action="run"/);
assert.match(plugin.renderWorkbench(), /data-mention-popup/);
assert.match(plugin.renderWorkbench(), /输入 @ 检索并引用笔记/);
assert.doesNotMatch(plugin.renderWorkbench(), /data-field="note-search"/);
assert.match(plugin.renderSettings(), /DeepSeek/);
assert.match(plugin.renderSettings(), /data-setting="profile"/);
assert.match(plugin.renderSettings(), /新增/);
assert.match(plugin.renderShell(), /data-profile-switch/);
assert.match(plugin.renderCommands(), /自定义提示词/);

fetchMock = async (url, options) => {
  assert.equal(url, "/api/network/forwardProxy");
  const body = JSON.parse(options.body);
  assert.equal(body.url, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(body.payload.model, "deepseek-chat");
  return {
    ok: true,
    async json() {
      return {
        code: 0,
        msg: "",
        data: {
          status: 200,
          body: JSON.stringify({ choices: [{ message: { content: "连接成功" } }] })
        }
      };
    }
  };
};

async function run() {
  await plugin.onload();
  assert.equal(plugin.registeredDock.type, "moon-ai-dock");
  assert.equal(plugin.registeredDock.config.position, "RightTop");
  assert.equal(plugin.registeredDock.config.size.width, 430);

  const migratedPlugin = new api.MoonAIPlugin();
  migratedPlugin.loadData = async () => ({
    provider: "deepseek",
    protocol: "openai",
    endpoint: "https://api.deepseek.com",
    model: "deepseek-chat",
    apiKey: "legacy-key",
    temperature: 0.6,
    systemPrompt: "legacy prompt"
  });
  await migratedPlugin.loadSettings();
  assert.equal(migratedPlugin.settings.profiles.length, 1);
  assert.equal(migratedPlugin.getActiveProfile().apiKey, "legacy-key");
  assert.equal(migratedPlugin.getActiveProfile().temperature, 0.6);

  const mentionText = "结合@觉察日记";
  const activeMention = plugin.getActiveMention({ value: mentionText, selectionStart: mentionText.length });
  assert.equal(activeMention.query, "觉察日记");
  plugin.mentionResults = [{ id: "20260718120000-testdoc", content: "觉察日记", hpath: "/日记" }];
  plugin.mentionStart = 2;
  const textarea = {
    value: mentionText,
    selectionStart: mentionText.length,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    focus() {}
  };
  plugin.selectMention(0, textarea);
  assert.equal(textarea.value, "结合@《觉察日记》 ");
  assert.equal(plugin.references[0].id, "20260718120000-testdoc");

  const deepseek = await api.callAI({
    ...api.defaultSettings().profiles[0],
    apiKey: "test-key"
  }, [{ role: "user", content: "ping" }]);
  assert.equal(deepseek, "连接成功");

  fetchMock = async (url, options) => {
    assert.equal(url, "http://127.0.0.1:11434/api/chat");
    assert.equal(JSON.parse(options.body).model, "qwen2.5:7b");
    return {
      ok: true,
      status: 200,
      async text() { return JSON.stringify({ message: { content: "本地连接成功" } }); }
    };
  };

  const ollama = await api.callAI({
    ...api.defaultSettings().profiles[0],
    provider: "ollama",
    protocol: "ollama",
    endpoint: "http://127.0.0.1:11434",
    model: "qwen2.5:7b",
    apiKey: ""
  }, [{ role: "user", content: "ping" }]);
  assert.equal(ollama, "本地连接成功");

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
  assert.equal(manifest.name, "siyuan-moon-ai");
  assert.equal(manifest.version, "1.4.0");
  assert.ok(fs.statSync(path.join(root, "index.css")).size > 1000);
  assert.ok(fs.existsSync(path.join(root, "assets", "logo.svg")));

  console.log("Moon AI smoke tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
