"use strict";
const fs = require("node:fs"), path = require("node:path");
const RULES = {
  "long-file":"warning", "oversized-file":"warning", "duplicate-file":"warning",
  "debugger":"warning", "dependency-cycle":"warning", "syntax":"error",
  "missing-include":"error", "missing-server-function":"error", "missing-handler":"warning"
};
function loadConfig(root, overrides = {}) {
  const file = path.join(root, ".hakquality.json");
  const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,"utf8")) : {};
  function validate(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configuration must be an object");
    for (const key of Object.keys(value)) {
      if (!["maxFiles","maxBytes","maxLines","exclude","rules","failOn","appsScript"].includes(key)) throw new Error("Unknown configuration option: " + key);
    }
    for (const key of ["maxFiles","maxBytes","maxLines"]) {
      if (key in value && (!Number.isSafeInteger(value[key]) || value[key] <= 0)) throw new Error(key + " must be a positive integer");
    }
    if ("exclude" in value && (!Array.isArray(value.exclude) || value.exclude.some(v => typeof v !== "string" || !v))) throw new Error("exclude must be an array of names or relative paths");
    if ("failOn" in value && !["error","warning","never"].includes(value.failOn)) throw new Error("failOn must be error, warning or never");
    if ("rules" in value) {
      if (!value.rules || typeof value.rules !== "object" || Array.isArray(value.rules)) throw new Error("rules must be an object");
      for (const [rule, level] of Object.entries(value.rules)) {
        if (!Object.hasOwn(RULES,rule) || !["off","info","warning","error"].includes(level)) throw new Error("Invalid rule or severity: " + rule);
      }
    }
    if ("appsScript" in value) {
      const a = value.appsScript;
      if (!a || typeof a !== "object" || Array.isArray(a)) throw new Error("appsScript must be an object");
      for (const key of Object.keys(a)) if (!["enabled","rpcFactories","clientGlobals","serverGlobals"].includes(key)) throw new Error("Unknown appsScript option: " + key);
      if ("enabled" in a && typeof a.enabled !== "boolean") throw new Error("appsScript.enabled must be boolean");
      for (const key of ["rpcFactories","clientGlobals","serverGlobals"]) {
        if (key in a && (!Array.isArray(a[key]) || a[key].some(v => typeof v !== "string" || !/^[A-Za-z_$][\w$]*$/.test(v)))) throw new Error("appsScript." + key + " must contain identifier names");
      }
    }
  }
  validate(saved); validate(overrides);
  return {...{maxFiles:20000,maxBytes:2*1024*1024,maxLines:1000,exclude:[],failOn:"error"}, ...saved, ...overrides,
    rules:{...RULES,...saved.rules,...overrides.rules},
    appsScript:{enabled:true,rpcFactories:[],clientGlobals:[],serverGlobals:[],...saved.appsScript,...overrides.appsScript},
    source:fs.existsSync(file) ? ".hakquality.json" : "defaults"};
}
function shouldFail(report, failOn) {
  if (failOn === "never") return false;
  return report.findings.some(f => f.severity === "error" || (failOn === "warning" && f.severity === "warning"));
}
module.exports = {loadConfig, shouldFail};
