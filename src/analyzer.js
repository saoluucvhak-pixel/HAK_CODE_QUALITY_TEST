"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const DEFAULT_EXCLUDE = new Set([".git","node_modules","dist","build","coverage","reports",".next",".cache"]);
const EXTENSIONS = new Set([".js",".cjs",".mjs",".jsx",".ts",".tsx",".json",".css",".html",".py",".go"]);
function scan(root, opts = {}) {
  root = path.resolve(root);
  const stat = fs.statSync(root);
  if (!stat.isDirectory()) throw new TypeError("root must be a directory");
  const maxFiles = opts.maxFiles || 20000;
  const maxBytes = opts.maxBytes || 2 * 1024 * 1024;
  const excludes = new Set([...DEFAULT_EXCLUDE, ...(opts.exclude || [])]);
  const files = [], findings = [], imports = [], byHash = new Map();
  let skipped = 0, bytes = 0;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (excludes.has(ent.name) || ent.isSymbolicLink()) continue;
      const full = path.join(dir,ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!ent.isFile() || !EXTENSIONS.has(path.extname(ent.name).toLowerCase())) continue;
      if (files.length >= maxFiles) throw new Error("File limit exceeded: " + maxFiles);
      const info = fs.statSync(full), rel = path.relative(root,full).split(path.sep).join("/");
      if (info.size > maxBytes) { skipped++; findings.push({rule:"oversized-file",severity:"warning",file:rel,line:0,message:"File exceeds per-file scan limit"}); continue; }
      const buf = fs.readFileSync(full);
      if (buf.includes(0)) { skipped++; continue; }
      const source = buf.toString("utf8"), lines = source.split(/\r?\n/), ext = path.extname(ent.name).toLowerCase();
      bytes += buf.length;
      files.push({path:rel,lines:lines.length,bytes:buf.length});
      if (lines.length > (opts.maxLines || 1000)) findings.push({rule:"long-file",severity:"warning",file:rel,line:0,message:"File exceeds recommended line count"});
      if (/\.(js|cjs|mjs|jsx|ts|tsx)$/.test(ext)) {
        lines.forEach((line,i)=>{
          if (/\bdebugger\s*;?/.test(line) && !/\/\//.test(line.slice(0,line.indexOf("debugger"))))
            findings.push({rule:"debugger",severity:"warning",file:rel,line:i+1,message:"Debugger statement found"});
        });
        const rx = /(?:require\(\s*|from\s+|import\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
        let match;
        while ((match = rx.exec(source))) imports.push({from:rel,specifier:match[1]});
      }
      if (buf.length >= 64) {
        const hash = crypto.createHash("sha256").update(buf).digest("hex");
        if (byHash.has(hash)) findings.push({rule:"duplicate-file",severity:"warning",file:rel,line:0,message:"Same content as " + byHash.get(hash)});
        else byHash.set(hash,rel);
      }
    }
  }
  walk(root);
  const known = new Set(files.map(f=>f.path));
  const edges = [], unresolved = [];
  for (const imp of imports) {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(imp.from),imp.specifier));
    const candidates = [base,base+".js",base+".cjs",base+".mjs",base+".jsx",base+".ts",base+".tsx",base+".json",base+"/index.js",base+"/index.ts"];
    const target = candidates.find(p=>known.has(p));
    if (target) edges.push({from:imp.from,to:target});
    else unresolved.push(imp);
  }
  const graph = new Map(files.map(f=>[f.path,[]]));
  edges.forEach(e=>graph.get(e.from).push(e.to));
  const color = new Map(), cycles = [], seenCycles = new Set();
  function visit(node,stack) {
    color.set(node,1);
    for (const next of graph.get(node) || []) {
      if (color.get(next) === 1) {
        const cycle = stack.slice(stack.indexOf(next)).concat(next), key = cycle.slice(0,-1).sort().join("|");
        if (!seenCycles.has(key)) { seenCycles.add(key); cycles.push(cycle); }
      } else if (!color.get(next)) visit(next,stack.concat(next));
    }
    color.set(node,2);
  }
  files.forEach(f=>{if (!color.get(f.path)) visit(f.path,[f.path]);});
  cycles.forEach(c=>findings.push({rule:"dependency-cycle",severity:"warning",file:c[0],line:0,message:c.join(" -> ")}));
  return {schemaVersion:1,root:path.basename(root),summary:{files:files.length,bytes,skipped,findings:findings.length,cycles:cycles.length,edges:edges.length},files,findings,architecture:{edges,unresolved,cycles}};
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function htmlReport(report) {
  const summary = report.summary;
  const rows = report.findings.map(f=>"<tr><td>"+escapeHtml(f.severity)+"</td><td>"+escapeHtml(f.rule)+"</td><td>"+escapeHtml(f.file)+"</td><td>"+f.line+"</td><td>"+escapeHtml(f.message)+"</td></tr>").join("");
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAK Code Quality</title><style>body{font:15px system-ui;margin:30px auto;max-width:1100px;padding:0 16px;color:#18304a;background:#f7f8fa}header,section{background:white;padding:22px;border:1px solid #ddd;border-radius:12px;margin:16px 0}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;text-align:left;padding:9px}th{background:#eef3f8}</style></head><body><header><h1>HAK Code Quality Dashboard</h1><p>Repository: '+escapeHtml(report.root)+'</p><p>Files: '+summary.files+' · Findings: '+summary.findings+' · Dependency cycles: '+summary.cycles+' · Skipped: '+summary.skipped+'</p></header><section><h2>Findings</h2><table><thead><tr><th>Severity</th><th>Rule</th><th>File</th><th>Line</th><th>Description</th></tr></thead><tbody>'+rows+'</tbody></table></section></body></html>';
}
module.exports = {scan,htmlReport};
