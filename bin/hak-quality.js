#!/usr/bin/env node
"use strict";
// Dùng: hak-quality <thư-mục> [--out reports] [--fail-on error|warning|info] [--fail-on-findings]
// Mã thoát: 0 đạt · 1 có phát hiện đạt ngưỡng --fail-on · 2 lỗi khi quét
const fs = require("node:fs"), path = require("node:path");
const { scan, htmlReport, shouldFail } = require("../src/analyzer");

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith("--") && !["--out", "--fail-on"].includes(args[i - 1]));
const root = path.resolve(positional[0] || ".");
const out = path.resolve(opt("--out") || "reports");
let failOn = opt("--fail-on");
if (args.includes("--fail-on-findings")) failOn = "info";

try {
  const report = scan(root);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "quality-report.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "dashboard.html"), htmlReport(report));
  console.log(JSON.stringify({ summary: report.summary, output: out }, null, 2));
  if (shouldFail(report, failOn)) process.exitCode = 1;
} catch (err) { console.error("HAK scan failed:", err.message); process.exitCode = 2; }
