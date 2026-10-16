"use strict";
const crypto=require("node:crypto");
const SEVERITIES=new Set(["info","warning","medium","high","critical"]);
function normalizeFinding(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new TypeError("finding must be object");
 const severity=String(input.severity||"warning").toLowerCase();
 if(!SEVERITIES.has(severity))throw new TypeError("invalid severity");
 const rule=String(input.rule||"").trim(),file=String(input.file||"").trim(),message=String(input.message||"").trim();
 if(!rule||!file||!message)throw new TypeError("missing finding fields");
 const line=Number.isInteger(input.line)&&input.line>=0?input.line:0;
 const finding_id=crypto.createHash("sha256").update(JSON.stringify([rule,file,line,message])).digest("hex").slice(0,24);
 return {finding_id,rule,severity,file,line,message,verification_status:"NOT_RUN"};
}
function deduplicate(items){const map=new Map();for(const item of items){const f=normalizeFinding(item);if(!map.has(f.finding_id))map.set(f.finding_id,f);}return [...map.values()];}
module.exports={normalizeFinding,deduplicate};
