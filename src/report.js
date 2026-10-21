"use strict";
function escapeHtml(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function htmlReport(report) {
  const e=escapeHtml, summary=report.summary;
  const rows=report.findings.map(f=>'<tr><td>'+e(f.severity)+'</td><td>'+e(f.rule)+'</td><td>'+e(f.file)+'</td><td>'+e(f.line)+'</td><td>'+e(f.message)+'</td></tr>').join('');
  const coverage=report.coverage || {}, apps=report.appsScript || {};
  const unresolved=[...(report.architecture?.unresolved || []).map(x=>({...x,kind:'import',reason:x.specifier})),...(apps.unresolved || [])];
  const list=items=>'<ul>'+items.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul>';
  const incomplete=[...(coverage.skippedFiles || []),...(coverage.unsupportedSyntax || []),...(coverage.failedUnits || []).map(x=>({...x,reason:'Syntax could not be parsed'}))];
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAK Code Quality</title><style>body{font:15px system-ui;margin:30px auto;max-width:1200px;padding:0 16px;color:#18304a;background:#f7f8fa}header,section{background:white;padding:22px;border:1px solid #ddd;border-radius:12px;margin:16px 0}.scroll{overflow:auto}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;text-align:left;padding:9px;overflow-wrap:anywhere}th{background:#eef3f8}code{overflow-wrap:anywhere}.status{font-weight:bold}li{margin:6px 0}</style></head><body>
  <header><h1>HAK Code Quality Dashboard</h1><p>Repository: ${e(report.root)}</p><p class="status">Static result: ${e(summary.status || 'not specified')} · Incomplete checks: ${summary.incomplete ? 'yes' : 'no recorded gaps'}</p><p>Files: ${summary.files} · Findings: ${summary.findings} · Errors: ${summary.error || 0} · Warnings: ${summary.warning || 0} · Dependency cycles: ${summary.cycles} · Skipped: ${summary.skipped}</p><p>CI gate: ${report.gate ? (report.gate.failed ? 'FAIL' : 'PASS')+' (threshold: '+e(report.gate.failOn)+')' : 'not configured'}. A passing static gate does not mean the application passed runtime tests.</p></header>
  <section><h2>Findings</h2><div class="scroll"><table><thead><tr><th>Severity</th><th>Rule</th><th>File</th><th>Line</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section><h2>Checked scope</h2><p>Parsed JavaScript units: ${coverage.parsedUnits || 0}. Apps Script server symbols: ${apps.serverSymbols || 0}. Resolved UI/API/include links: ${(apps.links || []).length}. Excluded entries: ${coverage.excludedEntries || 0}.</p><p>Excluded directories/files are outside the declared scan scope. Symbols are indexed project-wide; a resolved name is not proof it is loaded on every page.</p><h3>Skipped or unsupported</h3>${incomplete.length ? list(incomplete.map(x=>x.file+': '+x.reason)) : '<p>None recorded.</p>'}<h3>Unresolved references — manual review</h3>${unresolved.length ? list(unresolved.map(x=>(x.from || x.file)+':'+(x.line || 0)+' ['+x.kind+'] '+(x.name || x.target || '')+' '+x.reason)) : '<p>None recorded within supported reference forms.</p>'}</section>
  <section><h2>Not checked / limitations</h2>${list(report.limitations || ['Static checks only; runtime behavior was not tested.'])}</section>
  </body></html>`;
}
module.exports={htmlReport};
