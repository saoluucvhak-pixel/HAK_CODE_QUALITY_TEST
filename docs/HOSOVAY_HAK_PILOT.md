# Pilot: hosovay_hak
Repository: https://github.com/saoluucvhak-pixel/hosovay_hak
Type: Google Apps Script, Sheets, Drive.
## Execution
The pilot must be run on a checked-out copy of hosovay_hak. This repository's scanner now includes .gs files.
1. Checkout the target repository at a pinned commit.
2. Execute `node bin/hak-quality.js <target-dir> --out reports/hosovay`.
3. Review findings and false positives manually.
4. Run target repository's own tests (e.g. `kiem_thu/chay_tat_ca.sh`) in an isolated test environment with appropriate permissions.
5. Record exact commit, scan summary, test results and blockers in acceptance report.
## Important
A passing scanner test on a synthetic .gs fixture is NOT a completed scan of hosovay_hak. No business logic, Google Drive integration, DOCX/XLSX template or banking workflow acceptance is implied.
