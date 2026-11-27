"use strict";
const {scan}=require("./analyzer");
const {gate}=require("./quality-gate");
const {runRuflo}=require("./ruflo-adapter");
const ALLOWED=new Set(["scan","quality-gate","ruflo"]);
async function execute(task,options={}) {
 if(!task||!ALLOWED.has(task.type))throw new TypeError("unsupported task");
 if(task.type==="scan")return {type:"scan",status:"PASS",report:scan(task.root||".",options.scan||{})};
 if(task.type==="quality-gate") {
  const result=gate(task.report,task.checks||{},options.policy||{});
  return {type:task.type,status:result.status,result};
 }
 if(options.enableRuflo!==true) return {type:"ruflo",status:"NOT_RUN",reason:"Ruflo is disabled by default"};
 if(!Array.isArray(task.args)||!task.args.every(x=>typeof x==="string"))throw new TypeError("invalid Ruflo args");
 const allow=options.allowedCommands||[];
 if(!allow.includes(task.args[0]))throw new Error("Ruflo command not allowlisted");
 const result=await runRuflo(task.args,{executable:options.executable,timeoutMs:options.timeoutMs,cwd:options.cwd});
 return {type:"ruflo",status:result.ok?"PASS":"FAIL",exitCode:result.code,stdout:result.stdout,stderr:result.stderr};
}
module.exports={execute};
