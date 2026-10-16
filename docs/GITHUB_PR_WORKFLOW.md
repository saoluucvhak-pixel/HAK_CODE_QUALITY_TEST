# GitHub PR review workflow
## Safe sequence
1. Open a branch from a known base commit.
2. Run static scan, syntax validation and unit tests.
3. Produce machine-readable quality report and gate status.
4. Use a read-only GitHub token to inspect pull request diffs and publish review findings when separately authorized.
5. Human approval is mandatory before any automated fix is applied.
6. A separate write-capable identity may push to a dedicated feature branch and create a Draft PR after approval.
7. Never auto-merge or push directly to main.
## Status integrity
Use PASS only when command execution has verifiable success evidence. Use FAIL on nonzero exit or blocking findings. Use NOT_RUN when checks did not execute.
## Ruflo compatibility
The orchestration adapter is optional and disabled by default. Validate the installed Ruflo CLI command syntax and sandbox model before enabling agent execution.
## GitHub Actions permissions
CI quality gates use contents:read only. Never use pull_request_target to execute untrusted pull request code. Store no payroll, customer or banking records in artifacts.
