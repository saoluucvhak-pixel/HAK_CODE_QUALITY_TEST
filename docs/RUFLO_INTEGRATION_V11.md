# HAK Ruflo Integration V11 — Phase 1
## Baseline
Existing scanner: `src/analyzer.js`; CLI: `bin/hak-quality.js`; offline HTML dashboard; Node test suite and CI.
Keep the existing CLI and report formats unchanged.
## Adapter
`src/ruflo-adapter.js` exports `runRuflo(args, options)` as an opt-in subprocess boundary.
Ruflo is NOT installed by this PR. No agent executes on GitHub PR events. Verify installed Ruflo CLI commands and compatibility before connecting real orchestration.
Do not pass untrusted model output directly as executable arguments. Restrict agent operations using an allowlist in the future gateway.
## Security
Never expose credentials, payroll records, customer documents or repository write tokens to agent prompts.
Agent execution must be isolated, have explicit approval for writes, bounded time and output, and an auditable log.
## Future phases
1. Introduce versioned agent result JSON schema and finding deduplication.
2. Implement policy engine and deterministic CI quality gates.
3. Implement read-only GitHub review integration.
4. Add human-approved branch creation and draft PR workflow with least-privilege GitHub token.
5. Add optional Ruflo orchestration and dashboard history.
## Acceptance
`npm run check`, `npm test`, existing scan and new adapter tests must pass. No automatic merges.
