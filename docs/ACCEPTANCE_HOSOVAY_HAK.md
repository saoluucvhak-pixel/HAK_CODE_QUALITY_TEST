# HAK Quality Platform — Acceptance Gate (hosovay_hak)

Status: NOT ACCEPTED until CI evidence and functional evidence are attached.

## Required checks

- [ ] Node 18, 20, 22: npm ci && npm test && npm run check (record run URLs).
- [ ] Scanner output JSON parses, HTML dashboard opens, findings have paths and severity.
- [ ] AST parser tests cover import, require, dynamic import, malformed JS, and false positives.
- [ ] Security tests cover secret detection (redacted), injection, unsafe logging, and permission boundaries.
- [ ] Workflow tests: draft -> validate -> preview (no writes) -> issue (atomic) -> complete -> disburse (bank evidence) -> reconcile.
- [ ] Concurrency: revision conflict, idempotent retry, stale cache invalidation, rollback after partial failure.
- [ ] Data integrity: duplicate ticket IDs, parent-child relationships, monetary totals, no silent overwrites.
- [ ] Scan hosovay_hak on an immutable commit SHA and attach report + three existing long-file warnings triage.
- [ ] Run tests on synthetic or redacted data only; do not upload loan/customer credentials or real personal data.
- [ ] Human review of evidence, zero unresolved critical/high findings, approved PR before merge.

## Ruflo integration rules

- Ruflo is optional and cannot bypass the deterministic quality gate.
- Agents may propose patches only on feature branches, never write directly to main.
- Record agent version, prompts/config, target SHA, test results and PR links.
- Missing CI artifacts or failed checks must block acceptance.

## Evidence template

| Check | Commit SHA | CI run URL | Result | Reviewer |
| --- | --- | --- | --- | --- |
| Unit tests | | | PENDING | |
| Static scan | | | PENDING | |
| Security | | | PENDING | |
| Business E2E | | | PENDING | |
| Regression | | | PENDING | |

Do not mark this project production-ready based on a successful static scan alone.
