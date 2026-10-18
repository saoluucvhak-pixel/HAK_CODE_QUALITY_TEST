"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {gate}=require("../src/quality-gate");
const clean={findings:[]};
test("pass requires all checks",()=>assert.equal(gate(clean,{syntax:"PASS",unit:"PASS"}).status,"PASS"));
test("missing evidence is NOT_RUN",()=>assert.equal(gate(clean,{syntax:"PASS"}).status,"NOT_RUN"));
test("failing check blocks",()=>assert.equal(gate(clean,{syntax:"FAIL",unit:"PASS"}).status,"FAIL"));
test("high severity blocks",()=>assert.equal(gate({findings:[{severity:"high"}]},{syntax:"PASS",unit:"PASS"}).status,"FAIL"));
test("rejects fabricated status",()=>assert.throws(()=>gate(clean,{syntax:"MAGIC",unit:"PASS"}),TypeError));
