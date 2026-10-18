"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { scan, shouldFail } = require("../src/analyzer");

function fixture(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hak-quality-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), body);
    }
    return fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const rules = r => r.findings.map(f => f.rule);
// Ghép chuỗi lúc chạy để repo không chứa chuỗi trông như khóa thật.
const FAKE_GOOGLE = "AIza" + "S".repeat(35);
const FAKE_TG = "123456789:" + "A".repeat(35);

test("bắt khóa API và token trong .gs và .js", () => fixture({
  "Code.gs": `var KEY = "${FAKE_GOOGLE}";\n`,
  "bot.js": `const t = "${FAKE_TG}";\n`,
}, dir => {
  const r = scan(dir);
  assert.equal(r.findings.filter(f => f.rule === "hardcoded-secret").length, 2);
  assert.ok(r.findings.every(f => !f.message.includes(FAKE_GOOGLE)), "không được in giá trị bí mật ra báo cáo");
  assert.equal(r.summary.errors, 2);
}));

test("bắt mật khẩu gán cứng nhưng bỏ qua giá trị mẫu và biến môi trường", () => fixture({
  "a.js": [
    'const password = "Hak@2026xyz";',
    'const apiKey = "your-api-key";',
    "const token = process.env.TOKEN;",
    'const matKhau = "xxxxxxxx";',
  ].join("\n"),
}, dir => {
  const s = scan(dir).findings.filter(f => f.rule === "hardcoded-secret");
  assert.deepEqual(s.map(f => f.line), [1]);
}));

test("bắt webPreferences Electron không an toàn", () => fixture({
  "main.js": "new BrowserWindow({ webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false } });\n",
}, dir => {
  const f = scan(dir).findings.filter(x => x.rule === "electron-insecure-webpreferences");
  assert.equal(f.filter(x => x.severity === "error").length, 2);
  assert.equal(f.filter(x => x.severity === "warning").length, 1);
}));

test("innerHTML: báo dữ liệu động, bỏ qua chuỗi cố định", () => fixture({
  "ui.js": [
    'el.innerHTML = "<b>Tổng</b>";',
    "el.innerHTML = `<td>${row.ten}</td>`;",
    "el.innerHTML += html;",
  ].join("\n"),
}, dir => {
  assert.deepEqual(scan(dir).findings.filter(f => f.rule === "unsafe-inner-html").map(f => f.line), [2, 3]);
}));

test("eval và new Function", () => fixture({ "x.js": 'eval("1");\nconst f = new Function("a", "return a");\nobj.eval(1);\n' }, dir => {
  assert.deepEqual(scan(dir).findings.filter(f => f.rule === "eval-usage").map(f => f.line), [1, 2]);
}));

test("hak-quality-ignore bỏ qua đúng dòng", () => fixture({
  "x.js": 'eval("1"); // hak-quality-ignore eval-usage\neval("2"); // hak-quality-ignore debugger\n',
}, dir => {
  assert.deepEqual(scan(dir).findings.filter(f => f.rule === "eval-usage").map(f => f.line), [2]);
}));

test("SKILL.md: thiếu khai báo, sai tên, thiếu mục", () => fixture({
  "skills/hak-a/SKILL.md": "# Không có khai báo\n",
  "skills/hak-b/SKILL.md": "---\nname: khac-ten\ndescription: ngắn\n---\n## Mục đích\n",
  "skills/other/SKILL.md": "---\nname: other\ndescription: " + "Mô tả đủ dài để nói rõ khi nào cần dùng skill này cho công việc. ".repeat(2) + "\n---\nNội dung\n",
}, dir => {
  const r = scan(dir), by = file => r.findings.filter(f => f.file === file).map(f => f.rule);
  assert.deepEqual(by("skills/hak-a/SKILL.md"), ["skill-missing-frontmatter"]);
  const b = by("skills/hak-b/SKILL.md");
  assert.ok(b.includes("skill-name-mismatch") && b.includes("skill-weak-description") && b.includes("skill-missing-section"));
  assert.deepEqual(by("skills/other/SKILL.md"), []);
  assert.ok(!r.files.some(f => f.path.endsWith("README.md")));
}));

test("MCP chạy npx không ghim phiên bản", () => fixture({
  ".mcp.json": JSON.stringify({ mcpServers: {
    la: { command: "npx", args: ["-y", "ruflo-core"] },
    ghim: { command: "npx", args: ["-y", "@scope/tool@1.4.2"] },
    local: { command: "node", args: ["server.js"] },
  } }, null, 2),
}, dir => {
  const f = scan(dir).findings.filter(x => x.rule === "unpinned-plugin");
  assert.equal(f.length, 1); assert.match(f[0].message, /"la"/);
}));

test(".hakquality.json: tắt rule, đổi mức, loại thư mục", () => fixture({
  ".hakquality.json": JSON.stringify({ disable: ["eval-usage"], severity: { "unsafe-inner-html": "error" }, exclude: ["vendor"] }),
  "a.js": 'eval("x");\nel.innerHTML = html;\n',
  "vendor/lib.js": "debugger;\n",
}, dir => {
  const r = scan(dir);
  assert.deepEqual(rules(r), ["unsafe-inner-html"]);
  assert.equal(r.findings[0].severity, "error");
}));

test("shouldFail theo ngưỡng", () => {
  const rep = { findings: [{ severity: "warning" }] };
  assert.equal(shouldFail(rep, "error"), false);
  assert.equal(shouldFail(rep, "warning"), true);
  assert.equal(shouldFail(rep, undefined), false);
  assert.throws(() => shouldFail(rep, "abc"));
});

test("CLI --fail-on error trả mã 1 khi có lỗi", () => fixture({ "Code.gs": `var K = "${FAKE_GOOGLE}";\n` }, dir => {
  const bin = path.join(__dirname, "..", "bin", "hak-quality.js"), out = path.join(dir, "r");
  let code = 0;
  try { execFileSync(process.execPath, [bin, dir, "--out", out, "--fail-on", "error"], { stdio: "pipe" }); }
  catch (e) { code = e.status; }
  assert.equal(code, 1);
  const html = fs.readFileSync(path.join(out, "dashboard.html"), "utf8");
  assert.match(html, /hardcoded-secret/); assert.ok(!html.includes(FAKE_GOOGLE));
}));

test("innerHTML = \"\" rồi lệnh khác trên cùng dòng không bị báo; JSON dài không bị báo long-file", () => fixture({
  "ui.js": 'list.innerHTML = ""; list.appendChild(x);\n',
  "data.json": JSON.stringify(Array.from({ length: 1500 }, (_, i) => i), null, 1),
}, dir => assert.deepEqual(rules(scan(dir)), [])));
