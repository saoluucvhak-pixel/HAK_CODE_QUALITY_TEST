"use strict";
const LEVELS={info:0,warning:1,medium:2,high:3,critical:4};
function evaluate(report,policy={}) {
 if(!report||!Array.isArray(report.findings)) throw new TypeError("invalid report");
 const minSeverity=policy.minSeverity||"high";
 if(!(minSeverity in LEVELS)) throw new TypeError("invalid minSeverity");
 const blocking=report.findings.filter(f=>(LEVELS[String(f.severity).toLowerCase()]??0)>=LEVELS[minSeverity]);
 return {schemaVersion:1,status:blocking.length?"FAIL":"PASS",blockingCount:blocking.length,totalFindings:report.findings.length,blocking};
}
module.exports={evaluate};
