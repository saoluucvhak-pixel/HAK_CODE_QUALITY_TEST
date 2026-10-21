"use strict";
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {loadConfig,shouldFail} = require('./config');
const {parse,walk,literal} = require('./javascript');
const {inspectAppsScript} = require('./appsscript');
const {htmlReport} = require('./report');
const DEFAULT_EXCLUDE = new Set(['.git','node_modules','dist','build','coverage','reports','.next','.cache']);
const EXTENSIONS = new Set(['.gs','.js','.cjs','.mjs','.jsx','.ts','.tsx','.json','.css','.html','.py','.go']);
function scan(root, opts = {}) {
  root = path.resolve(root);
  if (!fs.statSync(root).isDirectory()) throw new TypeError('root must be a directory');
  const config = loadConfig(root,opts), files = [], records = [], findings = [], imports = [], byHash = new Map();
  const coverage = {parsedUnits:0,failedUnits:[],skippedFiles:[],unsupportedSyntax:[],excludedEntries:0};
  let bytes = 0, encountered = 0;
  function add(rule,file,line,message) {
    const severity = config.rules[rule];
    if (severity !== 'off') findings.push({rule,severity,file,line,message});
  }
  function excluded(rel, name) {
    return DEFAULT_EXCLUDE.has(name) || config.exclude.some(e => e === name || e.replace(/\\/g,'/').replace(/\/$/,'') === rel);
  }
  function walkDirectory(dir) {
    for (const ent of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir,ent.name), rel = path.relative(root,full).split(path.sep).join('/');
      if (excluded(rel,ent.name) || ent.isSymbolicLink()) { coverage.excludedEntries++; continue; }
      if (ent.isDirectory()) { walkDirectory(full); continue; }
      const ext = path.extname(ent.name).toLowerCase();
      if (!ent.isFile() || !EXTENSIONS.has(ext)) continue;
      if (++encountered > config.maxFiles) throw new Error('File limit exceeded: ' + config.maxFiles);
      if (fs.statSync(full).size > config.maxBytes) {
        coverage.skippedFiles.push({file:rel,reason:'oversized'}); add('oversized-file',rel,0,'File exceeds per-file scan limit'); continue;
      }
      const buf = fs.readFileSync(full);
      if (buf.includes(0)) { coverage.skippedFiles.push({file:rel,reason:'binary'}); continue; }
      const source = buf.toString('utf8'), lines = source.split(/\r?\n/);
      bytes += buf.length;
      files.push({path:rel,lines:lines.length,bytes:buf.length});
      const record = {path:rel,ext,source}; records.push(record);
      if (lines.length > config.maxLines) add('long-file',rel,0,'File exceeds recommended line count (' + config.maxLines + ')');
      if (['.js','.cjs','.mjs','.gs'].includes(ext)) {
        if (ext === '.gs' && !config.appsScript.enabled) coverage.unsupportedSyntax.push({file:rel,reason:'Apps Script checks disabled'});
        else try {
          record.ast = parse(source,false,ext === '.gs'); coverage.parsedUnits++;
          walk(record.ast,node => {
            if (node.type === 'DebuggerStatement') add('debugger',rel,node.loc.start.line,'Debugger statement found');
            let specifier = null;
            if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)) specifier = literal(node.source);
            if (node.type === 'ImportExpression') specifier = literal(node.source);
            if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') specifier = literal(node.arguments[0]);
            if (specifier && /^\.{1,2}\//.test(specifier)) imports.push({from:rel,specifier,line:node.loc.start.line});
          });
        } catch (err) {
          const line = err.loc ? err.loc.line : 1;
          add('syntax',rel,line,err.message); coverage.failedUnits.push({file:rel,line,context:ext === '.gs' ? 'server' : 'javascript'});
        }
      } else if (['.ts','.tsx','.jsx','.py','.go'].includes(ext)) coverage.unsupportedSyntax.push({file:rel,reason:'TypeScript/JSX/Python/Go parsers not included; file size/duplicates only'});
      else if (ext === '.html' && !config.appsScript.enabled) coverage.unsupportedSyntax.push({file:rel,reason:'HTML script/handler checks disabled with Apps Script checks'});
      if (buf.length >= 64) {
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        if (byHash.has(hash)) add('duplicate-file',rel,0,'Same content as ' + byHash.get(hash));
        else byHash.set(hash,rel);
      }
    }
  }
  walkDirectory(root);
  const known = new Set(files.map(f => f.path)), edges = [], unresolved = [];
  for (const imp of imports) {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(imp.from),imp.specifier));
    const candidates = [base,...['.js','.cjs','.mjs','.json','/index.js','/index.cjs','/index.mjs'].map(s => base+s)];
    const target = candidates.find(p => known.has(p));
    if (target) edges.push({from:imp.from,to:target}); else unresolved.push(imp);
  }
  const graph = new Map(files.map(f => [f.path,[]]));
  edges.forEach(e => graph.get(e.from).push(e.to));
  const color = new Map(), cycles = [], seenCycles = new Set();
  function visit(node, stack) {
    color.set(node,1);
    for (const next of graph.get(node) || []) {
      if (color.get(next) === 1) {
        const cycle = stack.slice(stack.indexOf(next)).concat(next), key = cycle.slice(0,-1).sort().join('|');
        if (!seenCycles.has(key)) { seenCycles.add(key); cycles.push(cycle); }
      } else if (!color.get(next)) visit(next,stack.concat(next));
    }
    color.set(node,2);
  }
  files.forEach(f => { if (!color.get(f.path)) visit(f.path,[f.path]); });
  cycles.forEach(c => add('dependency-cycle',c[0],0,c.join(' -> ')));
  const appsScript = config.appsScript.enabled ? inspectAppsScript(records,config.appsScript,add,coverage) : {enabled:false,links:[],unresolved:[]};
  const unique = [...new Map(findings.map(f => [JSON.stringify(f),f])).values()];
  const counts = {error:0,warning:0,info:0}; unique.forEach(f => counts[f.severity]++);
  const limitations = [
    'Static analysis only; application tests, deployment and Google services were not run.',
    'Apps Script symbols are indexed project-wide; per-page include reachability and conditional definitions are not proven.',
    'Only direct inline handler calls and literal google.script.run calls are resolved; aliases, dynamic dispatch and configured RPC wrappers need review.',
    'Script/attribute extraction supports ordinary HTML; framework templates and external script contents are not evaluated.',
    'Sheet/column schemas, permissions, secrets and business correctness are not audited.',
    'TypeScript/JSX, Python and Go are inventoried but not syntax-checked; package imports are not resolved.'
  ];
  const report = {schemaVersion:2,root:path.basename(root),checkedAt:new Date().toISOString(),
    summary:{files:files.length,bytes,skipped:coverage.skippedFiles.length,findings:unique.length,cycles:cycles.length,edges:edges.length,...counts},
    files,findings:unique,architecture:{edges,unresolved,cycles},appsScript,coverage,limitations,
    configuration:{source:config.source,failOn:config.failOn,rules:config.rules}};
  report.summary.status = counts.error ? 'fail' : (counts.warning ? 'pass-with-warnings' : 'pass');
  report.summary.incomplete = coverage.skippedFiles.length > 0 || coverage.failedUnits.length > 0 || coverage.unsupportedSyntax.length > 0 || unresolved.length > 0 || appsScript.unresolved.length > 0;
  report.gate = {failOn:config.failOn,failed:shouldFail(report,config.failOn)};
  return report;
}
module.exports = {scan,htmlReport};
