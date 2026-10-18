"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {execute}=require("../src/agent-orchestrator");
test("rejects unknown agent task",async()=>await assert.rejects(execute({type:"write-files"}),TypeError));
test("Ruflo disabled by default",async()=>assert.equal((await execute({type:"ruflo",args:["version"]})).status,"NOT_RUN"));
test("Ruflo command allowlist",async()=>await assert.rejects(execute({type:"ruflo",args:["delete"]},{enableRuflo:true,allowedCommands:["version"]}),/allowlisted/));
test("gate task preserves NOT_RUN",async()=>assert.equal((await execute({type:"quality-gate",report:{findings:[]}})).status,"NOT_RUN"));
