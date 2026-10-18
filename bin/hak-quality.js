#!/usr/bin/env node
"use strict";
// HAK Code Quality — dòng lệnh
//   hak-quality [scan] <thư-mục> [--out reports] [--fail-on error|warning|info] [--changed <file>]...
//   hak-quality gate --config hak-gate.json [--root .] [--out hak-quality-results.json] [--commit SHA --branch NAME]
//   hak-quality memory --memory .hak/quality-memory.jsonl --project P --branch B --commit SHA [--scan quality-report.json] [--gate hak-quality-results.json] [--out hak-skill-proposals.json]
//   hak-quality history <báo-cáo.json>... [--out history.html]
// Mã thoát: 0 đạt · 1 có phát hiện đạt ngưỡng / cổng chưa đạt · 2 lỗi khi chạy
const fs = require("node:fs"), path = require("node:path");
const { scan, htmlReport, shouldFail, impactedFiles } = require("../src/analyzer");

const argv = process.argv.slice(2);
const SUBCOMMANDS = new Set(["scan", "gate", "memory", "history"]);
const cmd = SUBCOMMANDS.has(argv[0]) ? argv.shift() : "scan";
const VALUE_FLAGS = new Set(["--out", "--fail-on", "--config", "--root", "--commit", "--branch", "--memory", "--project", "--scan", "--gate", "--changed"]);
const opt = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const all = name => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(argv[i - 1]));
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, data) => { fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2) + "\n"); };

try {
  if (cmd === "scan") {
    const root = path.resolve(positional[0] || ".");
    const out = path.resolve(opt("--out") || "reports");
    let failOn = opt("--fail-on");
    if (argv.includes("--fail-on-findings")) failOn = "info";
    const report = scan(root);
    const changed = all("--changed").map(f => f.split(path.sep).join("/"));
    if (changed.length) report.architecture.impacted = impactedFiles(report, changed);
    fs.mkdirSync(out, { recursive: true });
    writeJson(path.join(out, "quality-report.json"), report);
    fs.writeFileSync(path.join(out, "dashboard.html"), htmlReport(report));
    console.log(JSON.stringify({ summary: report.summary, impacted: report.architecture.impacted, output: out }, null, 2));
    if (shouldFail(report, failOn)) process.exitCode = 1;
  } else if (cmd === "gate") {
    const { runGate, loadConfig } = require("../src/gate");
    if (!opt("--config")) throw new Error("Thiếu --config");
    const report = runGate(loadConfig(opt("--config")), opt("--root") || ".", { commit: opt("--commit"), branch: opt("--branch") });
    writeJson(opt("--out") || "hak-quality-results.json", report);
    console.log(JSON.stringify({ project: report.project, passed: report.passed, failed: report.failed, verified: report.verified }));
    if (!report.verified) process.exitCode = 1;
  } else if (cmd === "memory") {
    const { recordRun } = require("../src/memory");
    for (const k of ["--memory", "--project", "--branch", "--commit"]) if (!opt(k)) throw new Error(`Thiếu ${k}`);
    const res = recordRun(opt("--memory"), {
      project: opt("--project"), branch: opt("--branch"), commit: opt("--commit"),
      scan: opt("--scan") && fs.existsSync(opt("--scan")) ? readJson(opt("--scan")) : null,
      gate: opt("--gate") && fs.existsSync(opt("--gate")) ? readJson(opt("--gate")) : null,
    });
    writeJson(opt("--out") || "hak-skill-proposals.json", { schemaVersion: 1, project: opt("--project"), commit: opt("--commit"), ...res });
    console.log(JSON.stringify({ recorded: res.recorded, proposals: res.proposals.length }));
  } else if (cmd === "history") {
    const { loadReports, historyHtml } = require("../src/history");
    if (!positional.length) throw new Error("Cần ít nhất 1 file báo cáo JSON");
    const data = loadReports(positional);
    const out = opt("--out") || "history.html";
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, historyHtml(data));
    console.log(JSON.stringify({ runs: data.runs.length, skipped: data.skipped.length, output: path.resolve(out) }));
  }
} catch (err) { console.error(`hak-quality ${cmd} lỗi:`, err.message); process.exitCode = 2; }
