"use strict";
// Dashboard lịch sử: gộp nhiều báo cáo (quét + cổng chất lượng) thành 1 trang HTML tĩnh, xem xu hướng và so sánh 2 lần gần nhất.
// Thay cho history.html/auto.html + serve.py của bản Python: không cần chạy máy chủ, không mở cổng mạng.
const fs = require("node:fs");
const path = require("node:path");

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/** Đọc các file báo cáo JSON (tối đa 5 MB/file); file không nhận dạng được thì bỏ qua và đếm. */
function loadReports(files) {
  const runs = [], skipped = [];
  for (const f of files) {
    try {
      if (fs.statSync(f).size > 5 * 1024 * 1024) { skipped.push(f); continue; }
      const data = JSON.parse(fs.readFileSync(f, "utf8"));
      const label = String(data.commit || data.generatedAt || path.basename(path.dirname(path.resolve(f))) || path.basename(f)).slice(0, 60);
      if (data.summary && Array.isArray(data.findings)) {
        runs.push({ kind: "scan", label, file: path.basename(f), errors: data.summary.errors ?? 0, warnings: data.summary.warnings ?? 0, cycles: data.summary.cycles ?? 0, files: data.summary.files ?? 0, byRule: data.byRule || {} });
      } else if (Array.isArray(data.checks) && Number.isFinite(data.passed) && Number.isFinite(data.failed)) {
        runs.push({ kind: "gate", label, file: path.basename(f), passed: data.passed, failed: data.failed, verified: !!data.verified });
      } else skipped.push(f);
    } catch { skipped.push(f); }
  }
  return { runs, skipped };
}

function bars(series, keys, colors, title) {
  if (!series.length) return `<p class="empty">Chưa có báo cáo ${escapeHtml(title)}.</p>`;
  const W = 640, H = 200, max = Math.max(1, ...series.map(r => keys.reduce((s, k) => s + (r[k] || 0), 0)));
  const bw = Math.max(6, Math.min(40, (W - 40) / series.length - 6));
  let x = 30, out = `<svg viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="${escapeHtml(title)}"><line x1="24" y1="${H}" x2="${W}" y2="${H}" class="axis"/>`;
  for (const r of series) {
    let y = H;
    keys.forEach((k, i) => {
      const h = (r[k] || 0) / max * (H - 10);
      out += `<rect x="${x}" y="${y - h}" width="${bw}" height="${h}" fill="${colors[i]}"><title>${escapeHtml(r.label)}: ${keys.map(kk => `${kk} ${r[kk] || 0}`).join(", ")}</title></rect>`;
      y -= h;
    });
    x += bw + 6;
  }
  return out + "</svg>";
}

function compareTable(a, b, keys, labels) {
  if (!a || !b) return "";
  const rows = keys.map((k, i) => { const d = (b[k] || 0) - (a[k] || 0); return `<tr><td>${labels[i]}</td><td class="num">${a[k] || 0}</td><td class="num">${b[k] || 0}</td><td class="num ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "+" : ""}${d}</td></tr>`; }).join("");
  return `<table><thead><tr><th>Chỉ số</th><th>${escapeHtml(a.label)}</th><th>${escapeHtml(b.label)}</th><th>Chênh</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function historyHtml({ runs, skipped }) {
  const scans = runs.filter(r => r.kind === "scan"), gates = runs.filter(r => r.kind === "gate");
  const lastScan = scans.at(-1), prevScan = scans.at(-2), lastGate = gates.at(-1);
  const verdict = lastGate ? (lastGate.verified ? `<span class="ok">Đạt — ${lastGate.passed}/${lastGate.passed + lastGate.failed} kiểm tra</span>` : `<span class="bad">Chưa đạt — ${lastGate.failed} kiểm tra lỗi</span>`) : "Chưa có kết quả cổng chất lượng";
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAK Quality History</title><style>
:root{--bg:#f5f2ec;--card:#fffefb;--ink:#1a2130;--mut:#6b655a;--line:#e5dfd1;--brand:#1d3a63;--ok:#17654a;--bad:#b42318;--warn:#8a5a12}
@media (prefers-color-scheme:dark){:root{--bg:#0b101a;--card:#121926;--ink:#e8e6df;--mut:#9aa0ad;--line:#232c3d;--brand:#d4b06a;--ok:#6fd3a8;--bad:#ff8a7a;--warn:#f0cf8f}}
body{font:15px/1.5 system-ui,"Segoe UI",sans-serif;margin:0;background:var(--bg);color:var(--ink)}main{max-width:1100px;margin:0 auto;padding:24px 16px}
section,header{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px}h1{color:var(--brand);margin:0 0 6px;font-size:22px}h2{font-size:17px;margin:0 0 12px}
svg{width:100%;height:auto}.axis{stroke:var(--mut)}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border-bottom:1px solid var(--line);padding:8px;text-align:left}.num{text-align:right;font-variant-numeric:tabular-nums}
.up{color:var(--bad)}.down{color:var(--ok)}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}.mut,.empty{color:var(--mut)}.legend span{display:inline-block;margin-right:14px}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px}
</style></head><body><main>
<header><h1>Lịch sử chất lượng</h1><p>${verdict}</p><p class="mut">${scans.length} lần quét · ${gates.length} lần chạy cổng chất lượng${skipped.length ? ` · bỏ qua ${skipped.length} file không nhận dạng được` : ""}</p></header>
<section><h2>Phát hiện qua các lần quét</h2><p class="legend"><span><i class="sw" style="background:var(--bad)"></i>Lỗi</span><span><i class="sw" style="background:var(--warn)"></i>Cảnh báo</span></p>
${bars(scans, ["errors", "warnings"], ["var(--bad)", "var(--warn)"], "quét")}
${compareTable(prevScan, lastScan, ["errors", "warnings", "cycles", "files"], ["Lỗi", "Cảnh báo", "Vòng phụ thuộc", "File"])}</section>
<section><h2>Cổng chất lượng</h2><p class="legend"><span><i class="sw" style="background:var(--ok)"></i>Đạt</span><span><i class="sw" style="background:var(--bad)"></i>Lỗi</span></p>
${bars(gates, ["passed", "failed"], ["var(--ok)", "var(--bad)"], "cổng chất lượng")}</section>
</main></body></html>`;
}

module.exports = { loadReports, historyHtml };
