#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/validate-quality-report.js <report.json>'); process.exit(2); }
try {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw Error('Report must be an object');
  if (report.schemaVersion !== 2) throw Error('Expected schemaVersion 2');
  if (!report.summary || typeof report.summary !== 'object') throw Error('Missing summary');
  if (!Array.isArray(report.findings)) throw Error('Missing findings array');
  if (!report.gate || typeof report.gate.failed !== 'boolean') throw Error('Missing boolean gate.failed');
  if (report.gate.failed) { console.error('Quality gate failed'); process.exit(1); }
  console.log('HAK quality report contract OK');
} catch (err) { console.error('Invalid quality report:', err.message); process.exit(2); }
