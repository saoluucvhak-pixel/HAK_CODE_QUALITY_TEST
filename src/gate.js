"use strict";
// Cổng chất lượng dựa trên bằng chứng: chạy đúng các lệnh test/lint/build đã khai báo, ghi kết quả thật.
// Chuyển từ quality_gate.py (LUONG_HAK, nhánh feature/hak-dashboard-auto-json-v3-2).
// An toàn: lệnh là mảng argv, KHÔNG chạy qua shell; mỗi lệnh có timeout; chỉ giữ 12.000 ký tự cuối của output.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_TAIL = 12000;

function validateConfig(config) {
  if (!config || !Array.isArray(config.checks) || !config.checks.length) throw new Error("Cấu hình cần mảng checks không rỗng");
  config.checks.forEach((c, i) => {
    if (!c || typeof c.name !== "string" || !c.name.trim()) throw new Error(`checks[${i}] thiếu name`);
    if (!Array.isArray(c.command) || !c.command.length || !c.command.every(x => typeof x === "string"))
      throw new Error(`checks[${i}] "${c.name}": command phải là mảng chuỗi (argv), không phải chuỗi lệnh shell`);
  });
}

/**
 * @param {{project?: string, checks: Array<{name: string, command: string[], timeoutSeconds?: number, cwd?: string}>}} config
 * @param {string} root thư mục gốc dự án
 * @param {{commit?: string, branch?: string}} [meta]
 */
function runGate(config, root, meta = {}) {
  validateConfig(config);
  root = path.resolve(root);
  const checks = config.checks.map(c => {
    const cwd = path.resolve(root, c.cwd || ".");
    if (!cwd.startsWith(root)) throw new Error(`"${c.name}": cwd phải nằm trong thư mục dự án`);
    const started = process.hrtime.bigint();
    const r = spawnSync(c.command[0], c.command.slice(1), {
      cwd, shell: false, encoding: "utf8", timeout: (Number(c.timeoutSeconds) || 120) * 1000, maxBuffer: 32 * 1024 * 1024,
    });
    const seconds = Math.round(Number(process.hrtime.bigint() - started) / 1e6) / 1000;
    let status, exitCode = r.status, output = `${r.stdout || ""}\n${r.stderr || ""}`;
    if (r.error && r.error.code === "ETIMEDOUT") { status = "timeout"; exitCode = null; output = "Lệnh vượt quá thời gian cho phép"; }
    else if (r.error) { status = "error"; exitCode = null; output = String(r.error.message); }
    else status = r.status === 0 ? "passed" : "failed";
    return { name: c.name, command: c.command, status, exitCode, seconds, outputTail: output.slice(-OUTPUT_TAIL) };
  });
  const passed = checks.filter(c => c.status === "passed").length;
  return {
    schemaVersion: 1, kind: "hak-quality-gate", project: config.project || path.basename(root),
    commit: meta.commit || "", branch: meta.branch || "", generatedAt: new Date().toISOString(),
    checks, passed, failed: checks.length - passed, verified: checks.length > 0 && passed === checks.length,
  };
}

function loadConfig(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = { runGate, validateConfig, loadConfig };
