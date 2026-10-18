"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeFinding,deduplicate}=require("../src/agent-findings");
const item={rule:"debugger",severity:"warning",file:"src/a.js",line:2,message:"Debugger statement"};
test("stable finding identity",()=>assert.equal(normalizeFinding(item).finding_id,normalizeFinding(item).finding_id));
test("deduplicates repeated findings",()=>assert.equal(deduplicate([item,item]).length,1));
test("unverified AI finding never marked pass",()=>assert.equal(normalizeFinding({...item,verification_status:"PASS"}).verification_status,"NOT_RUN"));
