# HAK V11 release acceptance checklist
- [ ] CI syntax and unit tests PASS on supported Node versions.
- [ ] V11 Quality Gate PASS and artifacts downloadable.
- [ ] End-to-end acceptance JSON generated with verified syntax/unit evidence.
- [ ] Review no credentials, payroll, bank records or sensitive file contents in artifacts.
- [ ] Review all code changes, security boundaries and rollback procedure.
- [ ] Confirm Ruflo CLI compatibility in a dedicated environment (if enabling AI).
- [ ] Confirm least-privilege GitHub permissions and no auto-merge.
- [ ] Approve Draft PR and merge manually after review.
- [ ] Run smoke test on main after merge.
## Release scope
This checklist certifies the deterministic offline quality scanner and CI foundation only. Ruflo-powered automatic fixes and PR creation are not included until implemented and separately accepted.
## Rollback
Revert the merge commit using GitHub, or redeploy the previous known-good revision.
