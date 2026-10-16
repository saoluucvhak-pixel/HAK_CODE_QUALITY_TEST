"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {runRuflo}=require("../src/ruflo-adapter");
test("rejects invalid args",async()=>{await assert.rejects(runRuflo([123]),TypeError);});
test("runs configured executable without shell",async()=>{
 const result=await runRuflo(["-e","process.stdout.write('ready')"],{executable:process.execPath,timeoutMs:5000});
 assert.equal(result.ok,true);assert.equal(result.stdout,"ready");
});
test("nonzero exit remains observable",async()=>{
 const result=await runRuflo(["-e","process.exit(7)"],{executable:process.execPath,timeoutMs:5000});
 assert.equal(result.code,7);assert.equal(result.ok,false);
});
