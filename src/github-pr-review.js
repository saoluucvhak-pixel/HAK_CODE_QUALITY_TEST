"use strict";
const {evaluate}=require("./quality-policy");
function review(report,options={}) {
 if(!report||!Array.isArray(report.findings))throw new TypeError("invalid report");
 const max=options.maxAnnotations===undefined?50:options.maxAnnotations;
 if(!Number.isInteger(max)||max<0||max>50)throw new TypeError("maxAnnotations must be 0..50");
 const result=evaluate(report,{minSeverity:options.minSeverity||"high"});
 const annotations=report.findings.filter(f=>typeof f.file==="string"&&Number.isInteger(f.line)&&f.line>0).slice(0,max).map(f=>({
  path:f.file,line:f.line,annotation_level:["critical","high"].includes(f.severity)?"failure":"warning",
  message:String(f.message||f.rule||"Finding").slice(0,500),title:String(f.rule||"HAK finding").slice(0,100)
 }));
 return {conclusion:result.status==="FAIL"?"failure":"success",summary:"HAK scan: "+report.findings.length+" findings; "+result.blockingCount+" blocking",annotations};
}
module.exports={review};
