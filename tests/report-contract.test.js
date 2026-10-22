'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const validator = path.resolve(__dirname, '../scripts/validate-quality-report.js');
function validate(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hak-contract-'));
  try {
    const file = path.join(dir, 'report.json');
    fs.writeFileSync(file, JSON.stringify(value));
    return spawnSync(process.execPath, [validator, file], {encoding:'utf8'});
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
}
test('accepts passing schema v2 report', () => {
  assert.equal(validate({schemaVersion:2, summary:{}, findings:[], gate:{failed:false}}).status, 0);
});
test('rejects failing gate', () => {
  assert.equal(validate({schemaVersion:2, summary:{}, findings:[], gate:{failed:true}}).status, 1);
});
test('rejects missing fields', () => {
  assert.equal(validate({schemaVersion:2, summary:{}, gate:{failed:false}}).status, 2);
});
test('rejects unsupported schema', () => {
  assert.equal(validate({schemaVersion:1, summary:{}, findings:[], gate:{failed:false}}).status, 2);
});
