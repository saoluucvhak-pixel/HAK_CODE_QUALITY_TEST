"use strict";
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED = ["unit", "static", "security", "business", "regression"];
const ALLOWED = new Set(["PASS", "FAIL", "NOT_RUN"]);

function verifyEvidence(evidence) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return {status:"BLOCK",errors:["Invalid evidence object"]};
  if (!/^[0-9a-f]{40}$/i.test(evidence.targetSha || "")) errors.push("targetSha must be a full immutable commit SHA");
  if (!Array.isArray(evidence.checks)) errors.push("checks must be an array");
  const checks = Array.isArray(evidence.checks) ? evidence.checks : [];
  for (const name of REQUIRED) {
    const matches = checks.filter(x => x && x.name === name);
    if (matches.length !== 1) { errors.push(name + ": exactly one check required"); continue; }
    const check = matches[0];
    if (!ALLOWED.has(check.status)) errors.push(name + ": invalid status");
    if (check.status !== "PASS") errors.push(name + ": not passing");
    if (check.targetSha !== evidence.targetSha) errors.push(name + ": mismatched target SHA");
    if (typeof check.runUrl !== "string" || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+$/.test(check.runUrl)) errors.push(name + ": missing GitHub Actions evidence");
  }
  if (evidence.criticalFindings !== 0 || evidence.highFindings !== 0) errors.push("Critical/high findings must both be zero");
  if (evidence.humanApproved !== true) errors.push("Human approval required");
  return {status:errors.length ? "BLOCK" : "PASS",errors};
}
function main() {
  const input = process.argv[2];
  if (!input) { console.error("Usage: node bin/verify-evidence.js evidence.json"); process.exitCode=2; return; }
  try {
    const result = verifyEvidence(JSON.parse(fs.readFileSync(path.resolve(input),"utf8")));
    console.log(JSON.stringify(result,null,2));
    if (result.status !== "PASS") process.exitCode=1;
  } catch(e) { console.error("Invalid evidence:",e.message); process.exitCode=2; }
}
if (require.main === module) main();
module.exports = {verifyEvidence};
