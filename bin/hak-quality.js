#!/usr/bin/env node
"use strict";
const fs = require("node:fs"),path=require("node:path");
const {scan,htmlReport} = require("../src/analyzer");
const args=process.argv.slice(2), root=path.resolve(args[0] || ".");
const outArg=args.indexOf("--out"),out=path.resolve(outArg>=0 ? args[outArg+1] || "reports" : "reports");
try {
  const report=scan(root);
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,"quality-report.json"),JSON.stringify(report,null,2)+"\n");
  fs.writeFileSync(path.join(out,"dashboard.html"),htmlReport(report));
  console.log(JSON.stringify({summary:report.summary,output:out},null,2));
  if(args.includes("--fail-on-findings") && report.findings.length) process.exitCode=1;
} catch(err) { console.error("HAK scan failed:",err.message);process.exitCode=2; }
