#!/usr/bin/env node
"use strict";
const fs=require('node:fs'),path=require('node:path');
const {scan,htmlReport}=require('../src/analyzer');
function main(args) {
  let root='.',out='reports',seenRoot=false,failOn;
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(arg==='--help') { console.log('Usage: hak-quality [directory] [--out directory] [--fail-on error|warning|never] [--fail-on-findings]');return; }
    if(arg==='--out' || arg==='--fail-on') {
      const value=args[++i];if(!value || value.startsWith('--'))throw Error('Missing value for '+arg);
      if(arg==='--out')out=value;else failOn=value;
    } else if(arg==='--fail-on-findings') failOn='findings';
    else if(arg.startsWith('-')) throw Error('Unknown option: '+arg);
    else if(seenRoot)throw Error('Only one source directory is supported');
    else {root=arg;seenRoot=true;}
  }
  const report=scan(path.resolve(root),failOn && failOn!=='findings' ? {failOn} : {});
  if(failOn==='findings')report.gate={failOn:'findings',failed:report.findings.length>0};
  out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'quality-report.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(out,'dashboard.html'),htmlReport(report));
  console.log(JSON.stringify({summary:report.summary,gate:report.gate,output:out},null,2));
  if(report.gate.failed)process.exitCode=1;
}
try{main(process.argv.slice(2));}catch(err){console.error('HAK scan failed:',err.message);process.exitCode=2;}
