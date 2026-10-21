"use strict";
const path = require("node:path");
const {walk,parse,literal,member,declarations,isRpc,maskTemplates} = require("./javascript");
const BROWSER_GLOBALS = new Set(["alert","confirm","prompt","open","print","close","focus","blur","setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","cancelAnimationFrame","fetch","parseInt","parseFloat","isNaN","isFinite","encodeURIComponent","decodeURIComponent","Number","String","Boolean","Array","Object","Date","JSON","eval","atob","btoa"]);
function inspectAppsScript(records, config, add, coverage) {
  const server = new Set(config.serverGlobals), declaredServer = new Set(config.serverGlobals), client = new Set([...BROWSER_GLOBALS,...config.clientGlobals]);
  const links = [], includes = [], handlers = [], rpc = [], unresolved = [];
  const htmlFiles = new Set(records.filter(r => r.ext === ".html").map(r => r.path));
  const incompleteServer = records.some(r => r.ext === ".gs" && !r.ast) || coverage.skippedFiles.some(r => r.file.endsWith(".gs"));
  const incompleteClient = () => coverage.failedUnits.some(r => r.context === "client") || coverage.skippedFiles.some(r => r.file.endsWith(".html"));
  function declarationsInto(ast, target) { if (ast) declarations(ast).declared.forEach(n => target.add(n)); }
  function inspect(ast, record, kind, offset = 0) {
    if (!ast) return;
    walk(ast,node => {
      if (node.type !== "CallExpression") return;
      const line = offset + node.loc.start.line;
      if (kind === "server" && node.callee.type === "Identifier" && node.callee.name === "include") {
        includes.push({from:record.path,line,target:literal(node.arguments[0])});
      }
      if (kind === "server" && ["createTemplateFromFile","createHtmlOutputFromFile"].includes(member(node.callee)) && node.callee.object.type === "Identifier" && node.callee.object.name === "HtmlService") {
        includes.push({from:record.path,line,target:literal(node.arguments[0])});
      }
      if (kind === "client" && node.callee.type === "MemberExpression" && isRpc(node.callee.object,config.rpcFactories)) {
        const name = member(node.callee);
        if (["withSuccessHandler","withFailureHandler","withUserObject"].includes(name)) return;
        rpc.push({from:record.path,line,name,privateFunction:!!name && name.endsWith("_")});
      }
    });
  }
  for (const record of records) if (record.ext === ".gs") {
    if (record.ast) {
      const symbols = declarations(record.ast);
      symbols.declared.forEach(n => declaredServer.add(n));
      symbols.callable.forEach(n => server.add(n));
    }
    inspect(record.ast,record,"server");
  }
  // Every client script is indexed before checking inline handlers across HTML includes.
  for (const record of records) if (record.ext === ".html") {
    const html = record.source.replace(/<!--[\s\S]*?-->/g,s => s.replace(/[^\r\n]/g," "));
    const lineAt = i => html.slice(0,i).split(/\r?\n/).length - 1;
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const attrs = match[1], code = match[2], offset = lineAt(match.index + match[0].indexOf(">") + 1);
      const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs);
      if (/\bsrc\s*=/i.test(attrs)) { unresolved.push({kind:"external-script",from:record.path,line:offset+1,reason:"External scripts are not fetched"}); continue; }
      if (type && !["module","text/javascript","application/javascript"].includes(type[1].toLowerCase())) continue;
      try {
        const ast = parse(maskTemplates(code));
        coverage.parsedUnits++;
        // Module-local declarations are not globals available to HTML onclick.
        if (!type || type[1].toLowerCase() !== "module") declarationsInto(ast,client);
        inspect(ast,record,"client",offset);
        walk(ast,n => { if (n.type === "DebuggerStatement") add("debugger",record.path,offset+n.loc.start.line,"Debugger statement found"); });
      } catch (err) {
        const line = offset + (err.loc ? err.loc.line : 1);
        add("syntax",record.path,line,err.message); coverage.failedUnits.push({file:record.path,line,context:"client"});
      }
    }
    // Scriptlets execute on the server, including include('File') expressions.
    for (const match of html.matchAll(/<\?([!=]?)([\s\S]*?)\?>/g)) {
      // Apps Script output expressions may begin with != rather than =.
      const code = match[2].replace(/^=/,"");
      try { inspect(parse(code),record,"server",lineAt(match.index)); }
      catch { unresolved.push({kind:"template-scriptlet",from:record.path,line:lineAt(match.index)+1,reason:"Partial template scriptlet is not statically parsed"}); }
    }
    // Extract attributes only from tags, never from JS strings inside script bodies.
    const tags = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,s => s.replace(/[^\r\n]/g," "));
    for (const tag of tags.matchAll(/<[A-Za-z](?:"[^"]*"|'[^']*'|[^'">])*>/g)) {
      for (const attr of tag[0].matchAll(/\bon[a-z]+\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
        const raw = attr[2] === undefined ? attr[3] : attr[2];
        const code = raw.replace(/&(?:quot|apos|amp|lt|gt|#(\d+)|#x([\da-f]+));/gi,(s,n,h) => n || h ? String.fromCodePoint(parseInt(n || h,h ? 16 : 10)) : ({"&quot;":'"',"&apos;":"'","&amp;":"&","&lt;":"<","&gt;":">"}[s.toLowerCase()]));
        const offset = lineAt(tag.index + attr.index);
        try {
          const ast = parse(maskTemplates(code),true), local = new Set(["event"]);
          walk(ast,n => {
            if (n.type === "VariableDeclarator" && n.id.type === "Identifier") local.add(n.id.name);
            if (n.type === "FunctionDeclaration" && n.id) local.add(n.id.name);
            if (["FunctionDeclaration","FunctionExpression","ArrowFunctionExpression"].includes(n.type)) n.params.forEach(p => { if (p.type === "Identifier") local.add(p.name); });
          });
          walk(ast,n => { if (n.type === "CallExpression" && n.callee.type === "Identifier" && !local.has(n.callee.name)) handlers.push({from:record.path,line:offset+n.loc.start.line,name:n.callee.name}); });
          inspect(ast,record,"client",offset); coverage.parsedUnits++;
        } catch (err) {
          const line = offset + (err.loc ? err.loc.line : 1);
          add("syntax",record.path,line,"Inline event handler: " + err.message); coverage.failedUnits.push({file:record.path,line,context:"client"});
        }
      }
    }
  }
  for (const item of includes) {
    if (item.target === null) { unresolved.push({...item,kind:"dynamic-include",reason:"Include name is computed"}); continue; }
    const target = item.target.endsWith(".html") ? item.target : item.target + ".html";
    // Apps Script file names are project-relative, not relative to the including file.
    if (!htmlFiles.has(path.posix.normalize(target))) {
      if (coverage.skippedFiles.some(r => r.file === target)) unresolved.push({...item,kind:"skipped-include",reason:"Target file was skipped"});
      else add("missing-include",item.from,item.line,"HTML include not found: " + target);
    } else links.push({...item,to:target,kind:"include"});
  }
  for (const item of rpc) {
    if (!item.name) unresolved.push({...item,kind:"dynamic-rpc",reason:"Server function name is computed"});
    else if (item.privateFunction) add("missing-server-function",item.from,item.line,"Apps Script private function cannot be called through google.script.run: " + item.name);
    else if (!server.has(item.name)) {
      if (declaredServer.has(item.name)) unresolved.push({...item,kind:"rpc",reason:"Symbol exists but a callable function could not be proven"});
      else if (incompleteServer) unresolved.push({...item,kind:"rpc",reason:"Server index incomplete because files could not be parsed/read"});
      else add("missing-server-function",item.from,item.line,"Server function not found: " + item.name);
    } else links.push({...item,kind:"rpc",to:item.name});
  }
  for (const item of handlers) {
    if (!client.has(item.name)) {
      if (incompleteClient()) unresolved.push({...item,kind:"handler",reason:"Client script index is incomplete"});
      else add("missing-handler",item.from,item.line,"Inline handler function not found in scanned scripts: " + item.name);
    } else links.push({...item,kind:"handler",to:item.name});
  }
  return {serverSymbols:server.size,clientSymbols:client.size,links,unresolved};
}
module.exports = {inspectAppsScript};
