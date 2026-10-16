"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {scan,htmlReport}=require("../src/analyzer");
function fixture(fn) { const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hak-quality-"));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})} }
test("detects local imports and dependency cycles",()=>fixture(dir=>{
 fs.writeFileSync(path.join(dir,"a.js"),'const b=require("./b");\n');
 fs.writeFileSync(path.join(dir,"b.js"),'const a=require("./a");\n');
 const result=scan(dir);
 assert.equal(result.summary.files,2);assert.equal(result.summary.cycles,1);assert.equal(result.summary.edges,2);
}));
test("does not traverse excluded directories",()=>fixture(dir=>{
 fs.mkdirSync(path.join(dir,"node_modules"));fs.writeFileSync(path.join(dir,"node_modules","bad.js"),"debugger;");
 fs.writeFileSync(path.join(dir,"ok.js"),"const ok = true;");
 assert.equal(scan(dir).summary.files,1);
}));
test("reports debugger and duplicate content",()=>fixture(dir=>{
 const body="debugger;\n"+"const x = 1;".repeat(10);
 fs.writeFileSync(path.join(dir,"a.js"),body);fs.writeFileSync(path.join(dir,"b.js"),body);
 const report=scan(dir);
 assert.ok(report.findings.some(f=>f.rule==="debugger"));
 assert.ok(report.findings.some(f=>f.rule==="duplicate-file"));
}));
test("escapes HTML in dashboard",()=>{
 const report={root:"<unsafe>",summary:{files:0,findings:1,cycles:0,skipped:0},findings:[{severity:"warning",rule:"x",file:"<script>",line:1,message:"<img>"}]};
 const html=htmlReport(report);
 assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("<script>"));
});
