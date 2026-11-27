"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {evaluate}=require("../src/quality-policy");
test("warnings are not blocking by default",()=>assert.equal(evaluate({findings:[{severity:"warning"}]}).status,"PASS"));
test("high findings block",()=>assert.equal(evaluate({findings:[{severity:"high"}]}).status,"FAIL"));
test("configurable threshold",()=>assert.equal(evaluate({findings:[{severity:"warning"}]},{minSeverity:"warning"}).blockingCount,1));
test("invalid report fails closed",()=>assert.throws(()=>evaluate({}),TypeError));
