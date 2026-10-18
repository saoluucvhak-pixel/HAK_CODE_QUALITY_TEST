"use strict";
// v0.3: tính năng gộp từ bản Python (quality_gate, security_audit, architecture_analyzer, observer/memory, dashboard history).
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { scan, impactedFiles, pythonImports } = require("../src/analyzer");
const { runGate, validateConfig } = require("../src/gate");
const memory = require("../src/memory");
const { loadReports, historyHtml } = require("../src/history");

const BIN = path.join(__dirname, "..", "bin", "hak-quality.js");
function tmp(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hakq3-"));
  for (const [rel, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); }
  return dir;
}
const rm = d => fs.rmSync(d, { recursive: true, force: true });
const SHA = n => String(n).repeat(7).slice(0, 7).replace(/[^0-9a-f]/g, "a");

// ---------- rule mới ----------
test("Python: shell=True, eval/exec, except trống, verify=False", () => {
  const d = tmp({ "a.py": ["import subprocess", "subprocess.run(cmd, shell=True)", "exec(code)", "try:", "  x()", "except:", "  pass", "requests.get(u, verify=False)", "obj.exec(1)"].join("\n") });
  try {
    const f = scan(d).findings.map(x => `${x.rule}:${x.line}`).sort();
    assert.deepEqual(f, ["bare-except:6", "eval-usage:3", "shell-injection-risk:2", "tls-verify-disabled:8"]);
  } finally { rm(d); }
});

test("Node: rejectUnauthorized:false và exec với chuỗi ghép", () => {
  const d = tmp({ "a.js": 'https.request({ rejectUnauthorized: false });\nexec(`git log ${branch}`);\nexecFile("git", ["log"]);\n' });
  try { assert.deepEqual(scan(d).findings.map(x => x.rule).sort(), ["shell-injection-risk", "tls-verify-disabled"]); } finally { rm(d); }
});

// ---------- kiến trúc Python + ảnh hưởng thay đổi ----------
test("đồ thị import Python (tương đối, gói, kiểu script) và vòng phụ thuộc", () => {
  const d = tmp({
    "pkg/__init__.py": "", "pkg/a.py": "from .b import x\nimport os\n", "pkg/b.py": "from . import c\n", "pkg/c.py": "from .a import y\n",
    "tool/observer.py": "def f(): pass\n", "tool/ci.py": "from observer import f\n",
  });
  try {
    const r = scan(d);
    const edges = r.architecture.edges.map(e => `${e.from}>${e.to}`).sort();
    assert.ok(edges.includes("pkg/a.py>pkg/b.py") && edges.includes("pkg/b.py>pkg/c.py") && edges.includes("pkg/c.py>pkg/a.py") && edges.includes("tool/ci.py>tool/observer.py"));
    assert.equal(r.summary.cycles, 1);
    assert.equal(r.architecture.unresolved.length, 0, "thư viện ngoài (os) không bị báo");
  } finally { rm(d); }
});

test("pythonImports đọc nhiều dạng import", () => {
  assert.deepEqual(pythonImports("import a.b, c as d\nfrom .. import e, f\nfrom .g import h  # cmt\n# import z"), ["a.b", "c", "..e", "..f", ".g"]);
});

test("--changed: liệt kê file bị ảnh hưởng gián tiếp", () => {
  const d = tmp({ "core.js": "module.exports=1;\n", "svc.js": 'require("./core");\n', "ui.js": 'require("./svc");\n', "other.js": "1;\n" });
  try {
    const r = scan(d);
    assert.deepEqual(impactedFiles(r, ["core.js"]), ["core.js", "svc.js", "ui.js"]);
    const out = path.join(d, "r");
    const json = JSON.parse(execFileSync(process.execPath, [BIN, d, "--out", out, "--changed", "core.js"], { encoding: "utf8" }));
    assert.deepEqual(json.impacted, ["core.js", "svc.js", "ui.js"]);
  } finally { rm(d); }
});

// ---------- cổng chất lượng ----------
test("gate: chạy lệnh thật, ghi đạt/lỗi/timeout, verified chỉ khi tất cả đạt", () => {
  const d = tmp();
  try {
    const node = process.execPath;
    const r = runGate({ project: "demo", checks: [
      { name: "đạt", command: [node, "-e", "console.log('ok')"] },
      { name: "lỗi", command: [node, "-e", "process.exit(3)"] },
      { name: "chậm", command: [node, "-e", "setTimeout(()=>{},5000)"], timeoutSeconds: 1 },
      { name: "không có", command: ["lenh-khong-ton-tai-hak"] },
    ] }, d, { commit: "abc1234" });
    assert.deepEqual(r.checks.map(c => c.status), ["passed", "failed", "timeout", "error"]);
    assert.equal(r.checks[1].exitCode, 3);
    assert.match(r.checks[0].outputTail, /ok/);
    assert.deepEqual([r.passed, r.failed, r.verified, r.commit], [1, 3, false, "abc1234"]);
  } finally { rm(d); }
});

test("gate: từ chối lệnh dạng chuỗi shell và cwd ra ngoài dự án", () => {
  assert.throws(() => validateConfig({ checks: [{ name: "x", command: "npm test && rm -rf /" }] }), /mảng chuỗi/);
  assert.throws(() => validateConfig({ checks: [] }), /không rỗng/);
  const d = tmp();
  try { assert.throws(() => runGate({ checks: [{ name: "x", command: ["node", "-v"], cwd: "../.." }] }, d), /trong thư mục dự án/); } finally { rm(d); }
});

test("CLI gate: mã thoát 0 khi đạt, 1 khi chưa đạt", () => {
  const d = tmp({ "ok.json": JSON.stringify({ checks: [{ name: "a", command: [process.execPath, "-v"] }] }), "bad.json": JSON.stringify({ checks: [{ name: "a", command: [process.execPath, "-e", "process.exit(1)"] }] }) });
  try {
    execFileSync(process.execPath, [BIN, "gate", "--config", path.join(d, "ok.json"), "--root", d, "--out", path.join(d, "g.json")]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(d, "g.json"), "utf8")).verified, true);
    let code = 0;
    try { execFileSync(process.execPath, [BIN, "gate", "--config", path.join(d, "bad.json"), "--root", d, "--out", path.join(d, "g2.json")], { stdio: "pipe" }); } catch (e) { code = e.status; }
    assert.equal(code, 1);
  } finally { rm(d); }
});

// ---------- bộ nhớ + observer ----------
test("memory: chỉ lưu khóa cho phép, đòi commit SHA, chặn xuống dòng", () => {
  const d = tmp(), f = path.join(d, "m.jsonl");
  try {
    const row = memory.append(f, { project: "P", branch: "main", commit: "abc1234", category: "security", status: "failed", secret: "xxx", source: "code" });
    assert.deepEqual(Object.keys(row).sort(), ["branch", "category", "commit", "project", "schemaVersion", "status"]);
    assert.throws(() => memory.append(f, { project: "P", branch: "b", commit: "khong-phai-sha" }), /SHA/);
    assert.throws(() => memory.append(f, { project: "P", branch: "b", commit: "abc1234", category: "lung-tung" }), /category/);
    const r2 = memory.append(f, { project: "P", branch: "b", commit: "abc1234", testName: "a\nb" });
    assert.equal(r2.testName, undefined);
  } finally { rm(d); }
});

test("observer: đề xuất khi lỗi lặp ở ≥3 commit KHÁC nhau, chạy lại cùng commit không tính", () => {
  const rows = [];
  for (const c of ["aaaaaaa", "aaaaaaa", "aaaaaaa", "bbbbbbb"]) rows.push({ project: "P", category: "electron", commit: c, status: "failed" });
  assert.deepEqual(memory.suggest(rows), []);
  rows.push({ project: "P", category: "electron", commit: "ccccccc", status: "failed" });
  rows.push({ project: "P", category: "skill", commit: "ddddddd", status: "passed" });
  const s = memory.suggest(rows);
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].category, s[0].commits, s[0].reviewRequired, s[0].autoExecute], ["electron", 3, true, false]);
  assert.throws(() => memory.suggest(rows, 1));
});

test("recordRun + CLI memory: gom lỗi quét theo nhóm, ghi kết quả gate, ra đề xuất", () => {
  const d = tmp(), f = path.join(d, "mem.jsonl");
  try {
    const scanRep = { findings: [{ rule: "hardcoded-secret", severity: "error" }, { rule: "eval-usage", severity: "warning" }, { rule: "unresolved-import", severity: "info" }, { rule: "electron-insecure-webpreferences", severity: "error" }] };
    let res;
    for (const c of ["1111111", "2222222", "3333333"]) res = memory.recordRun(f, { project: "LUONG", branch: "main", commit: c, scan: scanRep });
    assert.deepEqual(res.proposals.map(p => p.category).sort(), ["electron", "security"]);
    assert.equal(memory.load(f, { commit: "1111111" }).length, 2, "security gộp 1 dòng/commit, info bỏ qua");
    fs.writeFileSync(path.join(d, "gate.json"), JSON.stringify({ checks: [{ name: "unit", status: "failed" }], passed: 0, failed: 1 }));
    execFileSync(process.execPath, [BIN, "memory", "--memory", f, "--project", "LUONG", "--branch", "main", "--commit", "4444444", "--gate", path.join(d, "gate.json"), "--out", path.join(d, "p.json")]);
    const out = JSON.parse(fs.readFileSync(path.join(d, "p.json"), "utf8"));
    assert.equal(out.recorded, 1); assert.equal(out.approvalRequired, true);
  } finally { rm(d); }
});

// ---------- lịch sử ----------
test("history: nhận báo cáo quét + gate, bỏ qua file lạ, so sánh 2 lần quét, escape HTML", () => {
  const d = tmp({
    "r1/quality-report.json": JSON.stringify({ summary: { errors: 3, warnings: 5, cycles: 1, files: 10 }, findings: [], byRule: {} }),
    "r2/quality-report.json": JSON.stringify({ commit: "<b>abc</b>", summary: { errors: 1, warnings: 6, cycles: 0, files: 11 }, findings: [] }),
    "g.json": JSON.stringify({ checks: [], passed: 4, failed: 0, verified: true }),
    "la.json": JSON.stringify({ x: 1 }), "hong.json": "{",
  });
  try {
    const data = loadReports(["r1/quality-report.json", "r2/quality-report.json", "g.json", "la.json", "hong.json"].map(f => path.join(d, f)));
    assert.equal(data.runs.length, 3); assert.equal(data.skipped.length, 2);
    const html = historyHtml(data);
    assert.match(html, /Đạt — 4\/4/);
    assert.match(html, />-2</, "lỗi giảm 2");
    assert.ok(html.includes("&lt;b&gt;abc") && !html.includes("<b>abc"));
    const out = path.join(d, "h.html");
    execFileSync(process.execPath, [BIN, "history", path.join(d, "r1/quality-report.json"), path.join(d, "g.json"), "--out", out]);
    assert.ok(fs.readFileSync(out, "utf8").includes("Lịch sử chất lượng"));
  } finally { rm(d); }
});
