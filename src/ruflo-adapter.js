"use strict";
const {spawn}=require("node:child_process");
function runRuflo(args=[],options={}) {
 if(!Array.isArray(args)||args.some(x=>typeof x!=="string")) throw new TypeError("args must be strings");
 const timeoutMs=Math.min(Math.max(options.timeoutMs||120000,1000),300000);
 const executable=options.executable||"ruflo";
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{cwd:options.cwd||process.cwd(),shell:false,env:options.env||process.env,stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="",settled=false;
  const finish=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve(result);};
  const timer=setTimeout(()=>{child.kill("SIGKILL");finish(new Error("Ruflo timed out"));},timeoutMs);
  child.stdout.on("data",b=>{stdout+=b.toString();if(stdout.length>1048576){child.kill();finish(new Error("stdout limit exceeded"));}});
  child.stderr.on("data",b=>{stderr+=b.toString();if(stderr.length>1048576){child.kill();finish(new Error("stderr limit exceeded"));}});
  child.on("error",err=>finish(err));
  child.on("close",code=>finish(null,{code,stdout,stderr,ok:code===0}));
 });
}
module.exports={runRuflo};
