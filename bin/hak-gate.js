#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const {gate,loadJson}=require("../src/quality-gate");
const args=process.argv.slice(2);
function option(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1];}
try{
 const report=loadJson(option("--report","reports/quality-report.json"));
 const checks=option("--checks",null)?loadJson(option("--checks")):{};
 const policy=option("--policy",null)?loadJson(option("--policy")):{};
 const result=gate(report,checks,policy);
 const output=option("--out","reports/quality-gate.json");
 fs.mkdirSync(require("node:path").dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify({status:result.status,checks:result.checks,blocking:result.findings.blockingCount}));
 if(result.status!=="PASS")process.exitCode=1;
}catch(e){console.error("HAK quality gate error:",e.message);process.exitCode=2;}
