#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path");
const {accept}=require("../src/acceptance");
const args=process.argv.slice(2);
function arg(flag,fallback){const i=args.indexOf(flag);return i===-1?fallback:args[i+1];}
try{
 const root=path.resolve(arg("--root","."));
 const checks=JSON.parse(fs.readFileSync(arg("--checks","reports/checks.json"),"utf8"));
 const policy=JSON.parse(fs.readFileSync(arg("--policy","config/quality-policy.json"),"utf8"));
 const result=accept(root,checks,policy);
 const out=arg("--out","reports/acceptance.json");
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify({status:result.status,summary:result.summary,output:out}));
 if(result.status!=="PASS")process.exitCode=1;
}catch(e){console.error("HAK acceptance error:",e.message);process.exitCode=2;}
