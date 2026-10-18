"use strict";
// Các rule theo dòng và theo file. Mỗi rule trả về danh sách {rule, severity, line, message}.
// Bỏ qua một dòng: thêm chú thích `hak-quality-ignore` (hoặc `hak-quality-ignore <rule>`) trên chính dòng đó.

const JS_LIKE = /\.(js|cjs|mjs|jsx|ts|tsx|gs)$/i;
const HTML_LIKE = /\.(html|htm)$/i;

// Mẫu bí mật thường gặp. Chỉ báo vị trí, KHÔNG in giá trị ra báo cáo.
const SECRET_PATTERNS = [
  { name: "Google API key", rx: /AIza[0-9A-Za-z_\-]{35}/ },
  { name: "OpenAI/Anthropic key", rx: /\bsk-(?:ant-)?[A-Za-z0-9_\-]{20,}/ },
  { name: "GitHub token", rx: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "Slack token", rx: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "Telegram bot token", rx: /\b\d{8,10}:[A-Za-z0-9_\-]{35}\b/ },
  { name: "AWS access key", rx: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key", rx: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];
// Gán mật khẩu/khóa bằng chuỗi cố định: password = "abc123", apiKey: 'xyz...'
const SECRET_ASSIGN = /\b(pass(?:word)?|pwd|mat_?khau|secret|api[_-]?key|access[_-]?token|bot[_-]?token)\b["']?\s*[:=]\s*["'`]([^"'`\s]{6,})["'`]/i;
const PLACEHOLDER = /^(x+|\*+|your[_-]|<|\$\{|process\.env|changeme|example|test|dummy|placeholder)/i;

function ignored(line, rule) {
  const m = line.match(/hak-quality-ignore(?:\s+([\w-]+))?/);
  return !!m && (!m[1] || m[1] === rule);
}

function lineRules(rel, lines) {
  const out = [];
  const isJs = JS_LIKE.test(rel), isHtml = HTML_LIKE.test(rel);
  const push = (rule, severity, i, message) => { if (!ignored(lines[i], rule)) out.push({ rule, severity, line: i + 1, message }); };

  lines.forEach((line, i) => {
    // 1. Bí mật nằm trong code
    for (const p of SECRET_PATTERNS) {
      if (p.rx.test(line)) { push("hardcoded-secret", "error", i, `Có thể lộ ${p.name} trong mã nguồn — chuyển sang biến môi trường/PropertiesService`); break; }
    }
    if (isJs || isHtml) {
      const m = line.match(SECRET_ASSIGN);
      if (m && !PLACEHOLDER.test(m[2])) push("hardcoded-secret", "error", i, `Gán "${m[1]}" bằng chuỗi cố định — không lưu mật khẩu/khóa trong code`);
    }
    if (!(isJs || isHtml)) return;

    // 2. Electron webPreferences không an toàn
    if (/\bnodeIntegration\s*:\s*true\b/.test(line)) push("electron-insecure-webpreferences", "error", i, "nodeIntegration: true cho phép trang web chạy lệnh hệ thống — đặt false, dùng preload + contextBridge");
    if (/\bcontextIsolation\s*:\s*false\b/.test(line)) push("electron-insecure-webpreferences", "error", i, "contextIsolation: false — phải để true");
    if (/\bwebSecurity\s*:\s*false\b/.test(line)) push("electron-insecure-webpreferences", "error", i, "webSecurity: false tắt cơ chế bảo vệ cùng nguồn");
    if (/\benableRemoteModule\s*:\s*true\b/.test(line)) push("electron-insecure-webpreferences", "error", i, "enableRemoteModule: true — module remote đã bị loại bỏ vì không an toàn");
    if (/\bsandbox\s*:\s*false\b/.test(line)) push("electron-insecure-webpreferences", "warning", i, "sandbox: false — nên bật sandbox cho cửa sổ hiển thị");

    // 3. Thực thi chuỗi như code
    if (/(^|[^\w.$])eval\s*\(/.test(line) || /\bnew\s+Function\s*\(/.test(line)) push("eval-usage", "warning", i, "eval/new Function chạy chuỗi như code — dễ bị chèn mã");

    // 4. innerHTML với dữ liệu động (chuỗi ghép hoặc biến)
    const ih = line.match(/\.(?:innerHTML|outerHTML)\s*\+?=\s*(.+)$/);
    if (ih) {
      const rhs = ih[1].trim();
      // Chuỗi cố định (kể cả "" để xóa nội dung) kết thúc bằng ; hoặc hết dòng → an toàn
      const pureLiteral = /^(['"])(?:(?!\1).)*\1\s*(;|$)/.test(rhs) || /^`[^$`]*`\s*(;|$)/.test(rhs);
      if (!pureLiteral) push("unsafe-inner-html", "warning", i, "Gán innerHTML bằng dữ liệu động — escape dữ liệu hoặc dùng textContent");
    }
    if (/document\.write\s*\(/.test(line)) push("unsafe-inner-html", "warning", i, "document.write — tránh dùng");

    // 5. Còn sót debugger (giữ rule cũ)
    const d = line.indexOf("debugger");
    if (isJs && d >= 0 && /\bdebugger\b\s*;?/.test(line) && !/\/\//.test(line.slice(0, d))) push("debugger", "warning", i, "Còn câu lệnh debugger");
  });
  return out;
}

// ---- Skill (SKILL.md) -------------------------------------------------------
const HAK_SECTIONS = ["Mục đích", "Khi dùng", "Đầu vào", "Quy trình", "Đầu ra", "Kiểm thử", "Ràng buộc"];

function skillRules(rel, source) {
  const out = [];
  const dir = rel.split("/").slice(-2, -1)[0] || "";
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    out.push({ rule: "skill-missing-frontmatter", severity: "error", line: 1, message: "SKILL.md thiếu khối khai báo --- name/description --- nên Claude không nhận ra skill" });
    return out;
  }
  const fm = {};
  for (const l of m[1].split(/\r?\n/)) { const kv = l.match(/^([\w-]+):\s*(.*)$/); if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, ""); }
  if (!fm.name) out.push({ rule: "skill-missing-frontmatter", severity: "error", line: 1, message: "Thiếu name" });
  else if (dir && fm.name !== dir) out.push({ rule: "skill-name-mismatch", severity: "warning", line: 1, message: `name "${fm.name}" khác tên thư mục "${dir}"` });
  if (!fm.description) out.push({ rule: "skill-missing-frontmatter", severity: "error", line: 1, message: "Thiếu description" });
  else {
    if (fm.description.length < 60) out.push({ rule: "skill-weak-description", severity: "warning", line: 1, message: "description quá ngắn — cần nói rõ KHI NÀO dùng skill" });
    if (fm.description.length > 1024) out.push({ rule: "skill-weak-description", severity: "error", line: 1, message: "description dài hơn 1024 ký tự" });
  }
  if (/^hak-/.test(fm.name || "") || /^hak-/.test(dir)) {
    for (const h of HAK_SECTIONS) {
      if (!new RegExp(`^## ${h}`, "m").test(source)) out.push({ rule: "skill-missing-section", severity: "warning", line: 0, message: `Skill HAK thiếu mục "## ${h}"` });
    }
  }
  return out;
}

// ---- Plugin / MCP lạ --------------------------------------------------------
// Cảnh báo khi cấu hình Claude cài plugin/MCP chạy bằng npx/uvx không ghim phiên bản.
function claudeConfigRules(rel, source) {
  const out = [];
  if (!/(^|\/)(\.mcp\.json|\.claude\/settings(\.local)?\.json|\.claude\/\.mcp\.json)$/.test(rel)) return out;
  let cfg;
  try { cfg = JSON.parse(source); } catch { return out; }
  const servers = cfg.mcpServers || {};
  for (const [name, s] of Object.entries(servers)) {
    if (!s || !/^(npx|uvx|bunx|pnpx)$/.test(String(s.command || ""))) continue;
    const pkg = (s.args || []).find(a => typeof a === "string" && !a.startsWith("-"));
    const pinned = pkg && /@\d+(\.\d+){0,2}([-.\w]*)?$/.test(pkg.replace(/^@/, "x"));
    if (!pinned) {
      const line = source.split(/\r?\n/).findIndex(l => l.includes(`"${name}"`)) + 1;
      out.push({ rule: "unpinned-plugin", severity: "warning", line, message: `MCP "${name}" chạy ${s.command} ${pkg || ""} không ghim phiên bản — dễ bị thay mã độc; ghim phiên bản và chỉ dùng nguồn chính chủ` });
    }
  }
  return out;
}

module.exports = { lineRules, skillRules, claudeConfigRules, JS_LIKE };
