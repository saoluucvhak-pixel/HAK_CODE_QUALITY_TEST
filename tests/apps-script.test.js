"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {scan}=require("../src/analyzer");
test("scanner includes Apps Script .gs and detects debugger",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hak-gs-"));
 try{fs.writeFileSync(path.join(dir,"Code.gs"),"function test(){ debugger; }\n");const r=scan(dir);assert.equal(r.summary.files,1);assert.ok(r.findings.some(f=>f.rule==="debugger"&&f.file==="Code.gs"));}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
