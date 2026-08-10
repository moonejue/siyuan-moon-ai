"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
const requiredFiles = [
  "plugin.json",
  "index.js",
  "index.css",
  "icon.png",
  "preview.png",
  "README.md",
  "README_zh_CN.md",
  "LICENSE",
  "assets/donate-wechat.jpg"
];

for (const file of requiredFiles) {
  assert.ok(fs.statSync(path.join(root, file)).isFile(), `Missing required file: ${file}`);
}

assert.equal(manifest.name, "siyuan-moon-ai");
assert.equal(manifest.author, "moonejue");
assert.equal(manifest.url, "https://github.com/moonejue/siyuan-moon-ai");
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.equal(typeof manifest.disabledInPublish, "boolean");
assert.deepEqual(manifest.funding?.custom, [
  "https://raw.githubusercontent.com/moonejue/siyuan-moon-ai/main/assets/donate-wechat.jpg"
]);
assert.ok(manifest.readme?.default);
for (const readmePath of Object.values(manifest.readme || {})) {
  assert.ok(fs.existsSync(path.join(root, readmePath)), `Missing declared README: ${readmePath}`);
}

require(path.join(root, "scripts", "smoke-test.js"));
console.log(`Release validation passed for ${manifest.name} v${manifest.version}.`);
