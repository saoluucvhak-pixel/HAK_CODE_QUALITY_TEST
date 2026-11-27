"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {accept}=require("../src/acceptance");
test("end-to-end acceptance requires evidence",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hak-accept-"));
 try{
  fs.writeFileSync(path.join(dir,"ok.js"),"const ok=true;\n");
  assert.equal(accept(dir).status,"NOT_RUN");
  const r=accept(dir,{syntax:"PASS",unit:"PASS"});
  assert.equal(r.status,"PASS");assert.equal(r.summary.files,1);assert.equal(r.findings.length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
