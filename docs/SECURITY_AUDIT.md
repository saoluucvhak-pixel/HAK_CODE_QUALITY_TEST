# HAK Security Audit — initial integration

This adds a separate **Semgrep** security scan to the existing Node.js scanner. It does not replace the original quality checks, and does not run or modify application data.

## Usage

- Open GitHub Actions → **HAK Optional Security Audit** → **Run workflow**.
- It also runs when a PR changes scanner code, package metadata, or this workflow.
- Download `semgrep-security-report` from the workflow artifacts to inspect findings.

## Safety and limitations

- Semgrep's `p/security-audit` rules are downloaded from its rule registry during the GitHub Actions run; the runner therefore needs Internet access. Do not use this hosted workflow for private code without reviewing the rules and data-handling implications first.
- The workflow scans only this repository; it does **not** automatically audit other HAK repositories.
- Findings are static-analysis indicators, not confirmed exploitable vulnerabilities. Review false positives.
- This integration does not implement CodeQL, Playwright, Claude orchestration, runtime observation, or business-logic validation.
- A successful scan does not prove the application is secure.
- Review and pin action SHAs and Python package versions before adopting in a production security baseline.

## Next integration milestones

1. Add local pinned rules and reproducible tool versions.
2. Export normalized findings to the existing quality-report schema without conflating scanner coverage.
3. Add an opt-in target-repository audit runner with explicit path and permissions.
4. Integrate CodeQL where supported and Playwright only for test environments.
5. Add audit evidence, triage, approval gates and AI analysis with human review.
