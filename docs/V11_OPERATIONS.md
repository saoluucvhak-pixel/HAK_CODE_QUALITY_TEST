# HAK Quality V11 operations
## Local
Run `npm run check`, `npm test`, then `npm run scan`.
For a deterministic gate, create `reports/checks.json` with statuses from actual executed checks, for example `{"syntax":"PASS","unit":"PASS"}` ONLY after both succeeded. Run `npm run gate`.
## GitHub
CI uses read-only repository permissions. The review module only formats annotations; it does not post to GitHub or modify source. To post reviews, add a separately approved integration with least-privilege credentials.
## Ruflo
The optional adapter is not an installer. The real Ruflo CLI command contract, version, supported permissions and sandbox behavior require separate integration testing.
## Security and release
Do not upload business data or secrets. Keep PR as Draft until workflow and end-to-end acceptance pass. Never auto-merge.
