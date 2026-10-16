"use strict";
const fs=require("node:fs");
const {evaluate}=require("./quality-policy");
function gate(report,checks={},policy={}) {
 const findings=evaluate(report,policy);
 const required=policy.requiredChecks||["syntax","unit"];
 if(!Array.isArray(required)||required.some(x=>typeof x!=="string")) throw new TypeError("invalid requiredChecks");
 const statuses={};
 for(const name of required) {
  const value=checks[name]||"NOT_RUN";
  if(!["PASS","FAIL","NOT_RUN"].includes(value)) throw new TypeError("invalid check: "+name);
  statuses[name]=value;
 }
 const status=findings.status==="FAIL"||Object.values(statuses).includes("FAIL")?"FAIL":Object.values(statuses).includes("NOT_RUN")?"NOT_RUN":"PASS";
 return {schemaVersion:1,status,findings,checks:statuses};
}
function loadJson(file){return JSON.parse(fs.readFileSync(file,"utf8"));}
module.exports={gate,loadJson};
