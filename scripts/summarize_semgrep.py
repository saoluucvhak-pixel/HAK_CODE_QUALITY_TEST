#!/usr/bin/env python3
"""Convert Semgrep JSON to a concise, evidence-backed Markdown audit report."""
import argparse
import json
from collections import Counter
from pathlib import Path


def summarize(data):
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ValueError("Semgrep JSON must contain a results array")
    findings = data["results"]
    counts = Counter(str(x.get("extra", {}).get("severity", "UNKNOWN")).upper() for x in findings)
    lines = ["# HAK Semgrep Security Audit", "",
             f"- Findings: **{len(findings)}**",
             f"- Severity: {', '.join(f'{k}={v}' for k, v in sorted(counts.items())) or 'none'}",
             f"- Scan errors: **{len(data.get('errors', []))}**", "",
             "| Severity | Rule | Location | Message |", "|---|---|---|---|"]
    for item in findings:
        extra = item.get("extra") or {}
        loc = f"{item.get('path', '?')}:{(item.get('start') or {}).get('line', '?')}"
        values = [extra.get("severity", "?"), item.get("check_id", "?"), loc, extra.get("message", "")]
        clean = [str(v).replace("|", "\\|").replace("\n", " ")[:500] for v in values]
        lines.append("| " + " | ".join(clean) + " |")
    lines.extend(["", "## Limitations",
                  "Static analysis only. Zero findings does not establish absence of vulnerabilities.",
                  "Review scan errors and skipped targets before acceptance."])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("semgrep-summary.md"))
    args = parser.parse_args()
    try:
        data = json.loads(args.input.read_text(encoding="utf-8"))
        summary = summarize(data)
    except (OSError, ValueError, TypeError) as exc:
        parser.exit(2, f"Unable to summarize security scan: {exc}\n")
    args.out.write_text(summary, encoding="utf-8")
    print(summary)


if __name__ == "__main__":
    main()
