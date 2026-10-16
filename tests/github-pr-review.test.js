"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {review}=require("../src/github-pr-review");
test("produces read-only review data",()=>{const r=review({findings:[{severity:"high",file:"src/a.js",line:2,rule:"x",message:"issue"}]});assert.equal(r.conclusion,"failure");assert.equal(r.annotations[0].path,"src/a.js");});
test("skips invalid line annotations",()=>assert.equal(review({findings:[{file:"a.js",line:0}]}).annotations.length,0));
test("enforces annotation bound",()=>assert.throws(()=>review({findings:[]},{maxAnnotations:51}),TypeError));
