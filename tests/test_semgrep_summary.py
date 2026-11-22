import unittest
from scripts.summarize_semgrep import summarize


class SemgrepSummaryTests(unittest.TestCase):
    def test_empty(self):
        report = summarize({"results": [], "errors": []})
        self.assertIn("Findings: **0**", report)
        self.assertIn("Scan errors: **0**", report)

    def test_finding(self):
        report = summarize({"results": [{"check_id": "rule.test", "path": "src/a.js",
            "start": {"line": 12}, "extra": {"severity": "ERROR", "message": "Example"}}]})
        self.assertIn("src/a.js:12", report)
        self.assertIn("rule.test", report)

    def test_missing_results_fails(self):
        with self.assertRaises(ValueError):
            summarize({})


if __name__ == "__main__":
    unittest.main()
