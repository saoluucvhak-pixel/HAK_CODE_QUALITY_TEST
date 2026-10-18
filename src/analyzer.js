"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { lineRules, skillRules, claudeConfigRules, JS_LIKE } = require("./rules");

const DEFAULT_EXCLUDE = new Set([".git", "node_modules", "dist", "build", "coverage", "reports", ".next", ".cache", "__pycache__", ".venv", "out", "release"]);
// .gs = Google Apps Script
const EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".jsx", ".ts", ".tsx", ".gs", ".json", ".css", ".html", ".htm", ".py", ".go"]);
const CONFIG_FILE = ".hakquality.json";
const SEVERITY_RANK = { info: 0, warning: 1, error: 2 };

/** Đọc cấu hình riêng của dự án (.hakquality.json ở thư mục gốc), nếu có. */
function loadConfig(root) {
  const p = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (err) { throw new Error(`${CONFIG_FILE} không phải JSON hợp lệ: ${err.message}`); }
}

function scan(root, opts = {}) {
  root = path.resolve(root);
  const stat = fs.statSync(root);
  if (!stat.isDirectory()) throw new TypeError("root must be a directory");
  const cfg = { ...loadConfig(root), ...opts };
  const maxFiles = cfg.maxFiles || 20000;
  const maxBytes = cfg.maxBytes || 2 * 1024 * 1024;
  const maxLines = cfg.maxLines || 1000;
  const excludes = new Set([...DEFAULT_EXCLUDE, ...(cfg.exclude || [])]);
  const disabled = new Set(cfg.disable || []);
  const overrides = cfg.severity || {};
  const files = [], findings = [], imports = [], byHash = new Map();
  let skipped = 0, bytes = 0;

  const add = (rel, f) => {
    if (disabled.has(f.rule)) return;
    findings.push({ rule: f.rule, severity: overrides[f.rule] || f.severity, file: rel, line: f.line, message: f.message });
  };

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (excludes.has(ent.name) || ent.isSymbolicLink()) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      const ext = path.extname(ent.name).toLowerCase();
      const isSkill = ent.name === "SKILL.md";
      if (!ent.isFile() || (!EXTENSIONS.has(ext) && !isSkill)) continue;
      if (files.length >= maxFiles) throw new Error("File limit exceeded: " + maxFiles);
      const info = fs.statSync(full), rel = path.relative(root, full).split(path.sep).join("/");
      if (excludes.has(rel)) continue;
      if (info.size > maxBytes) { skipped++; add(rel, { rule: "oversized-file", severity: "warning", line: 0, message: "File vượt giới hạn dung lượng quét" }); continue; }
      const buf = fs.readFileSync(full);
      if (buf.includes(0)) { skipped++; continue; }
      const source = buf.toString("utf8"), lines = source.split(/\r?\n/);
      bytes += buf.length;
      files.push({ path: rel, lines: lines.length, bytes: buf.length });

      if (isSkill) { skillRules(rel, source).forEach(f => add(rel, f)); continue; }
      if (lines.length > maxLines && ext !== ".json") add(rel, { rule: "long-file", severity: "warning", line: 0, message: `File dài ${lines.length} dòng (khuyến nghị ≤ ${maxLines}) — nên tách module` });
      lineRules(rel, lines).forEach(f => add(rel, f));
      claudeConfigRules(rel, source).forEach(f => add(rel, f));

      if (JS_LIKE.test(ent.name)) {
        const rx = /(?:require\(\s*|from\s+|import\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
        let match;
        while ((match = rx.exec(source))) imports.push({ from: rel, specifier: match[1] });
      }
      if (buf.length >= 64) {
        const hash = crypto.createHash("sha256").update(buf).digest("hex");
        if (byHash.has(hash)) add(rel, { rule: "duplicate-file", severity: "warning", line: 0, message: "Nội dung trùng y hệt " + byHash.get(hash) });
        else byHash.set(hash, rel);
      }
    }
  }
  walk(root);

  const known = new Set(files.map(f => f.path));
  const edges = [], unresolved = [];
  for (const imp of imports) {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(imp.from), imp.specifier));
    const candidates = [base, base + ".js", base + ".cjs", base + ".mjs", base + ".jsx", base + ".ts", base + ".tsx", base + ".json", base + "/index.js", base + "/index.ts"];
    const target = candidates.find(p => known.has(p));
    if (target) edges.push({ from: imp.from, to: target });
    else unresolved.push(imp);
  }
  const graph = new Map(files.map(f => [f.path, []]));
  edges.forEach(e => graph.get(e.from).push(e.to));
  const color = new Map(), cycles = [], seenCycles = new Set();
  function visit(node, stack) {
    color.set(node, 1);
    for (const next of graph.get(node) || []) {
      if (color.get(next) === 1) {
        const cycle = stack.slice(stack.indexOf(next)).concat(next), key = cycle.slice(0, -1).sort().join("|");
        if (!seenCycles.has(key)) { seenCycles.add(key); cycles.push(cycle); }
      } else if (!color.get(next)) visit(next, stack.concat(next));
    }
    color.set(node, 2);
  }
  files.forEach(f => { if (!color.get(f.path)) visit(f.path, [f.path]); });
  cycles.forEach(c => add(c[0], { rule: "dependency-cycle", severity: "warning", line: 0, message: c.join(" -> ") }));
  unresolved.forEach(u => add(u.from, { rule: "unresolved-import", severity: "info", line: 0, message: `Không tìm thấy file cho import "${u.specifier}"` }));

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.file.localeCompare(b.file) || a.line - b.line);
  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byRule = {};
  for (const f of findings) { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; byRule[f.rule] = (byRule[f.rule] || 0) + 1; }

  return {
    schemaVersion: 2,
    root: path.basename(root),
    summary: { files: files.length, bytes, skipped, findings: findings.length, errors: bySeverity.error, warnings: bySeverity.warning, infos: bySeverity.info, cycles: cycles.length, edges: edges.length },
    byRule, files, findings, architecture: { edges, unresolved, cycles },
  };
}

/** true nếu có phát hiện đạt mức failOn trở lên ("error" | "warning" | "info"). */
function shouldFail(report, failOn) {
  if (!failOn) return false;
  const min = SEVERITY_RANK[failOn];
  if (min === undefined) throw new Error(`--fail-on phải là error, warning hoặc info`);
  return report.findings.some(f => SEVERITY_RANK[f.severity] >= min);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function htmlReport(report) {
  const s = report.summary;
  const label = { error: "Lỗi", warning: "Cảnh báo", info: "Thông tin" };
  const rows = report.findings.map(f => `<tr class="${escapeHtml(f.severity)}"><td><span class="sev">${escapeHtml(label[f.severity] || f.severity)}</span></td><td>${escapeHtml(f.rule)}</td><td>${escapeHtml(f.file)}</td><td class="num">${f.line || ""}</td><td>${escapeHtml(f.message)}</td></tr>`).join("");
  const rules = Object.entries(report.byRule || {}).sort((a, b) => b[1] - a[1]).map(([r, n]) => `<li><b>${n}</b> ${escapeHtml(r)}</li>`).join("");
  const tile = (n, t, cls) => `<div class="tile ${cls}"><div class="n">${n ?? 0}</div><div>${t}</div></div>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAK Code Quality</title><style>
:root{--bg:#f5f2ec;--card:#fffefb;--ink:#1a2130;--mut:#6b655a;--line:#e5dfd1;--brand:#1d3a63;--err:#b42318;--errBg:#fdecea;--warn:#8a5a12;--warnBg:#faf3e3;--info:#22345a;--infoBg:#eef1f7}
@media (prefers-color-scheme:dark){:root{--bg:#0b101a;--card:#121926;--ink:#e8e6df;--mut:#9aa0ad;--line:#232c3d;--brand:#d4b06a;--err:#ff8a7a;--errBg:#3a1e17;--warn:#f0cf8f;--warnBg:#2a2213;--info:#c3d3f0;--infoBg:#18243a}}
body{font:15px/1.5 system-ui,"Segoe UI",sans-serif;margin:0;background:var(--bg);color:var(--ink)}main{max-width:1180px;margin:0 auto;padding:24px 16px}
header,section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 16px}h1{margin:0 0 4px;color:var(--brand);font-size:22px}p{margin:0;color:var(--mut)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:16px}.tile{border:1px solid var(--line);border-radius:10px;padding:12px}.tile .n{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
.tile.e .n{color:var(--err)}.tile.w .n{color:var(--warn)}.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:760px}td,th{border-bottom:1px solid var(--line);text-align:left;padding:8px;vertical-align:top}th{position:sticky;top:0;background:var(--card)}td.num{text-align:right;font-variant-numeric:tabular-nums}
.sev{display:inline-block;padding:1px 8px;border-radius:999px;font-size:13px;white-space:nowrap}.error .sev{background:var(--errBg);color:var(--err)}.warning .sev{background:var(--warnBg);color:var(--warn)}.info .sev{background:var(--infoBg);color:var(--info)}
ul{columns:2;padding-left:18px;margin:0}.empty{color:var(--mut);padding:12px 0}</style></head><body><main>
<header><h1>HAK Code Quality</h1><p>Dự án: ${escapeHtml(report.root)} · ${s.files} file đã quét${s.skipped ? ` · bỏ qua ${s.skipped}` : ""}</p>
<div class="tiles">${tile(s.errors, "Lỗi", "e")}${tile(s.warnings, "Cảnh báo", "w")}${tile(s.cycles, "Vòng phụ thuộc", "")}${tile(s.edges, "Liên kết import", "")}</div></header>
${rules ? `<section><h2>Theo rule</h2><ul>${rules}</ul></section>` : ""}
<section><h2>Chi tiết</h2>${rows ? `<div class="wrap"><table><thead><tr><th>Mức</th><th>Rule</th><th>File</th><th>Dòng</th><th>Mô tả</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">Không có phát hiện nào.</p>`}</section>
</main></body></html>`;
}

module.exports = { scan, htmlReport, shouldFail, loadConfig };
