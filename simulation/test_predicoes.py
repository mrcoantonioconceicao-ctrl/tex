"""Testes do modelo de predição (só biblioteca padrão).

  python -m unittest discover -s simulation
"""
import tempfile
import unittest
from pathlib import Path

import predicoes


class FitTest(unittest.TestCase):
    def test_coefficient_is_mean_ratio_per_material(self):
        coefficients = predicoes.fit_coefficients(predicoes.REFERENCE_TESTS)
        # SIBAL: 80/22 e 120/31 (Saffire IV-1 e VI-2)
        self.assertAlmostEqual(coefficients["SIBAL"], (80 / 22 + 120 / 31) / 2)
        self.assertAlmostEqual(coefficients["Algodão"], 83 / 26.2)
        self.assertEqual(set(coefficients), {"SIBAL", "Algodão", "PMMA"})

    def test_fit_check_compares_with_every_published_test(self):
        report = predicoes.build_report()
        self.assertEqual(len(report["fit_check"]), len(predicoes.REFERENCE_TESTS))
        # Material com um teste só: o ajuste reproduz o medido exatamente
        single = next(r for r in report["fit_check"] if r["test_id"] == "Saffire V-2")
        self.assertEqual(single["error_pct"], 0.0)


class ReportTest(unittest.TestCase):
    def setUp(self):
        self.report = predicoes.build_report()

    def test_same_seed_gives_same_report(self):
        self.assertEqual(predicoes.render(self.report), predicoes.render(predicoes.build_report()))

    def test_different_seed_changes_projections(self):
        other = predicoes.build_report(seed=1)
        self.assertNotEqual(self.report["projections"], other["projections"])

    def test_lineage_marks_facts_and_hypotheses(self):
        for test in self.report["reference_tests"]:
            self.assertEqual(test["origin_category"], "Published")
            self.assertIn("20240002981", test["source"])
        for projection in self.report["projections"]:
            self.assertEqual(projection["origin_category"], "Synthetic")
            self.assertEqual(projection["quality_status"], "PENDING_VALIDATION")
        self.assertEqual(self.report["model"]["origin_category"], "Synthetic")

    def test_projection_statistics_are_consistent(self):
        for p in self.report["projections"]:
            self.assertLessEqual(p["co_p05_ppm"], p["co_p50_ppm"])
            self.assertLessEqual(p["co_p50_ppm"], p["co_p95_ppm"])
            self.assertGreaterEqual(p["prob_exceeds_24h"], p["prob_exceeds_1h"])
            for prob in (p["prob_exceeds_24h"], p["prob_exceeds_1h"]):
                self.assertGreaterEqual(prob, 0.0)
                self.assertLessEqual(prob, 1.0)

    def test_every_material_has_every_scenario(self):
        pairs = {(p["material"], p["o2_pct"]) for p in self.report["projections"]}
        self.assertEqual(len(pairs), 3 * len(predicoes.SCENARIO_O2_PCT))


class ClassifyTest(unittest.TestCase):
    def test_thresholds_follow_smac(self):
        self.assertEqual(predicoes.classify(100.0), "WITHIN_SMAC")
        self.assertEqual(predicoes.classify(100.1), "EXCEEDS_SMAC_24H")
        self.assertEqual(predicoes.classify(425.0), "EXCEEDS_SMAC_24H")
        self.assertEqual(predicoes.classify(425.1), "EXCEEDS_SMAC_1H")


class PercentileTest(unittest.TestCase):
    def test_interpolates_between_points(self):
        values = [0.0, 10.0, 20.0, 30.0, 40.0]
        self.assertEqual(predicoes.percentile(values, 0.0), 0.0)
        self.assertEqual(predicoes.percentile(values, 0.5), 20.0)
        self.assertAlmostEqual(predicoes.percentile(values, 0.95), 38.0)
        self.assertEqual(predicoes.percentile(values, 1.0), 40.0)


class CheckModeTest(unittest.TestCase):
    def test_check_fails_until_file_is_generated(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "predicoes.json"
            self.assertEqual(predicoes.main(["--output", str(output), "--check"]), 1)
            self.assertEqual(predicoes.main(["--output", str(output)]), 0)
            self.assertEqual(predicoes.main(["--output", str(output), "--check"]), 0)


if __name__ == "__main__":
    unittest.main()
