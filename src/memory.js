"use strict";
// Bộ nhớ chất lượng theo commit + Observer đề xuất skill khi một loại lỗi lặp lại.
// Chuyển từ project_memory.py, observer.py, ci_observer.py (LUONG_HAK, nhánh feature/hak-dashboard-auto-json-v3-2).
// Nguyên tắc: chỉ lưu siêu dữ liệu trong danh sách cho phép — KHÔNG lưu mã nguồn, nội dung lỗi, đường dẫn đầy đủ hay dữ liệu cá nhân.
// Observer chỉ ĐỀ XUẤT (reviewRequired: true), không bao giờ tự tạo hay chạy skill.
const fs = require("node:fs");
const path = require("node:path");

const SAFE_KEYS = ["project", "branch", "commit", "category", "testName", "status", "findingId"];
const STATUSES = new Set(["passed", "failed", "timeout", "error"]);
const CATEGORIES = new Set(["security", "electron", "skill", "architecture", "regression", "ui", "performance", "accounting", "export", "sync"]);
const SHA = /^[0-9a-f]{7,40}$/;

// rule của bộ quét → nhóm lỗi để đếm lặp lại
const RULE_CATEGORY = {
  "hardcoded-secret": "security", "eval-usage": "security", "unsafe-inner-html": "security",
  "tls-verify-disabled": "security", "shell-injection-risk": "security", "unpinned-plugin": "security",
  "electron-insecure-webpreferences": "electron",
  "skill-missing-frontmatter": "skill", "skill-name-mismatch": "skill", "skill-weak-description": "skill", "skill-missing-section": "skill",
  "dependency-cycle": "architecture", "long-file": "architecture", "duplicate-file": "architecture",
};

function sanitize(record) {
  if (!record || typeof record !== "object") throw new TypeError("Bản ghi phải là object");
  const safe = {};
  for (const k of SAFE_KEYS) {
    const v = record[k];
    if (typeof v === "string" && v.length <= 120 && !/[\r\n\0]/.test(v)) safe[k] = v;
  }
  if (!SHA.test(safe.commit || "")) throw new Error("Cần commit SHA hợp lệ (7–40 ký tự hex)");
  if (!safe.project || !safe.branch) throw new Error("Cần project và branch");
  if (safe.status && !STATUSES.has(safe.status)) throw new Error(`status không hợp lệ: ${safe.status}`);
  if (safe.category && !CATEGORIES.has(safe.category)) throw new Error(`category không hợp lệ: ${safe.category}`);
  return { schemaVersion: 1, ...safe };
}

function append(file, record) {
  const data = sanitize(record);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(data) + "\n", "utf8");
  return data;
}

function load(file, filter = {}) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (filter.project && row.project !== filter.project) continue;
    if (filter.commit && row.commit !== filter.commit) continue;
    out.push(row);
  }
  return out;
}

/**
 * Đề xuất skill khi cùng (dự án, nhóm lỗi) thất bại ở ≥ threshold commit KHÁC NHAU.
 * Cùng một commit chạy lại nhiều lần chỉ tính 1.
 */
function suggest(rows, threshold = 3) {
  if (!Number.isInteger(threshold) || threshold < 2) throw new Error("threshold phải ≥ 2");
  const commits = new Map(), last = new Map();
  for (const r of rows) {
    if (!r || r.status === "passed" || !r.category || !r.project) continue;
    const key = `${r.project}\u0000${r.category}`;
    if (!commits.has(key)) commits.set(key, new Set());
    commits.get(key).add(r.commit);
    last.set(key, r.commit);
  }
  return [...commits.entries()].filter(([, s]) => s.size >= threshold).sort().map(([key, s]) => {
    const [project, category] = key.split("\u0000");
    return { project, category, commits: s.size, lastCommit: last.get(key), proposal: `Soạn skill kiểm thử hồi quy cho nhóm lỗi "${category}"`, reviewRequired: true, autoExecute: false };
  });
}

/**
 * Ghi kết quả một lần CI vào bộ nhớ: báo cáo quét (scan) và/hoặc cổng chất lượng (gate).
 * Lỗi quét được gộp theo nhóm: mỗi nhóm có lỗi mức error/warning ghi 1 dòng failed cho commit đó.
 */
function recordRun(file, { project, branch, commit, scan, gate }) {
  const written = [];
  if (gate && Array.isArray(gate.checks)) {
    for (const c of gate.checks) {
      if (!STATUSES.has(c.status)) continue;
      written.push(append(file, { project, branch, commit, category: "regression", testName: String(c.name).slice(0, 120), status: c.status }));
    }
  }
  if (scan && Array.isArray(scan.findings)) {
    const cats = new Map();
    for (const f of scan.findings) {
      if (f.severity === "info") continue;
      const cat = RULE_CATEGORY[f.rule];
      if (cat) cats.set(cat, (cats.get(cat) || 0) + 1);
    }
    for (const [category, n] of cats) {
      written.push(append(file, { project, branch, commit, category, testName: "hak-quality-scan", status: "failed", findingId: `${category}:${n}` }));
    }
  }
  const history = load(file, { project });
  return { recorded: written.length, proposals: suggest(history), historicalCommits: new Set(history.map(r => r.commit)).size, approvalRequired: true };
}

module.exports = { sanitize, append, load, suggest, recordRun, RULE_CATEGORY, CATEGORIES };
