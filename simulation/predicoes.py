#!/usr/bin/env python3
"""Projeção de CO por material, calibrada nos testes publicados do Saffire IV a VI.

Gera frontend/src/data/predicoes.json, lido pelo painel (seção de predições).

  python simulation/predicoes.py           # regrava o JSON
  python simulation/predicoes.py --check   # falha se o JSON versionado estiver desatualizado

Fatos x hipóteses (regra do projeto):
- Fatos (origin_category "Published"): condições e ΔCO medidos nos testes do
  Saffire IV a VI, NTRS 20240002981 (Tabela 1, p.3; Tabela 2, p.6), conforme
  docs/conhecimento/saffire.md.
- Hipóteses (origin_category "Synthetic"): o modelo abaixo. ΔCO proporcional à
  fração de O₂, um coeficiente por material, ruído log-normal. Pressão,
  espessura e ventilação ficam de fora. Nada disso foi validado.

Só biblioteca padrão. A semente é fixa: o mesmo código gera sempre o mesmo JSON.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import statistics
import sys
from pathlib import Path

SCHEMA_VERSION = 1
SEED = 20240002981
SAMPLES_PER_SCENARIO = 5000
# Hipótese: dispersão do coeficiente entre queimas do mesmo material (log-normal)
COEFFICIENT_SIGMA = 0.20
SCENARIO_O2_PCT = (22.0, 26.0, 31.0)  # dentro da faixa testada no Saffire IV a VI

SAFFIRE_SOURCE = "NTRS 20240002981 (Tabela 1, p.3; Tabela 2, p.6)"

# SMAC de CO usados como limiar. As fontes divergem: ver docs/conhecimento/bass.md
SMAC_CO = {
    "limit_1h_ppm": 425.0,
    "limit_24h_ppm": 100.0,
    "source": "NTRS 20240002981 p.5, citando JSC 20584 Rev. A (2020)",
    "divergence": "NTRS 20210011385 p.16 (BASS-II) cita 55 ppm para 1 h; conferir a revisão vigente da JSC 20584",
}

# Tabela 1 (p.3) e Tabela 2 (p.6) de NTRS 20240002981, via docs/conhecimento/saffire.md
REFERENCE_TESTS = (
    {"test_id": "Saffire IV-1", "material": "SIBAL", "specimen": "SIBAL, 50 cm",
     "pressure_kpa": 100.0, "o2_pct": 22.0, "free_volume_m3": 17.9, "burn_time_s": 130, "delta_co_ppm": 80.0},
    {"test_id": "Saffire V-2", "material": "Algodão", "specimen": "malha de algodão, 50 cm",
     "pressure_kpa": 70.7, "o2_pct": 26.2, "free_volume_m3": 19.0, "burn_time_s": 200, "delta_co_ppm": 83.0},
    {"test_id": "Saffire VI-2", "material": "SIBAL", "specimen": "SIBAL, 50 cm",
     "pressure_kpa": 54.1, "o2_pct": 31.0, "free_volume_m3": 16.7, "burn_time_s": 112, "delta_co_ppm": 120.0},
    {"test_id": "Saffire VI-3", "material": "PMMA", "specimen": "PMMA 2 lados (1 cm), 18 cm",
     "pressure_kpa": 54.6, "o2_pct": 30.3, "free_volume_m3": 16.7, "burn_time_s": 780, "delta_co_ppm": 308.0},
    {"test_id": "Saffire VI-4", "material": "PMMA", "specimen": "PMMA 1 lado (0,5 cm), 18 cm",
     "pressure_kpa": 55.2, "o2_pct": 28.8, "free_volume_m3": 16.7, "burn_time_s": 1200, "delta_co_ppm": 320.0},
)

NOT_IGNITED = (
    {"material": "Nomex", "test": "Saffire VI", "source": "NTRS 20240002981 p.4"},
)

HYPOTHESES = (
    "ΔCO proporcional à fração de O₂ (um coeficiente por material, ajustado nos testes publicados).",
    "Pressão, espessura da amostra, volume livre e ventilação não entram no modelo.",
    f"Dispersão log-normal de {COEFFICIENT_SIGMA:.0%} no coeficiente entre queimas do mesmo material.",
    "O ΔCO de pico é comparado ao SMAC, que é média no tempo de exposição: a comparação é conservadora.",
    "Projeções só dentro da faixa de O₂ testada (22% a 31%); fora dela é extrapolação.",
)

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "predicoes.json"


def fit_coefficients(tests: tuple[dict, ...]) -> dict[str, float]:
    """Coeficiente k (ppm de ΔCO por ponto percentual de O₂), média por material."""
    ratios: dict[str, list[float]] = {}
    for test in tests:
        ratios.setdefault(test["material"], []).append(test["delta_co_ppm"] / test["o2_pct"])
    return {material: statistics.fmean(values) for material, values in ratios.items()}


def percentile(sorted_values: list[float], fraction: float) -> float:
    """Percentil por interpolação linear entre os pontos vizinhos."""
    position = (len(sorted_values) - 1) * fraction
    low = math.floor(position)
    high = math.ceil(position)
    weight = position - low
    return sorted_values[low] * (1 - weight) + sorted_values[high] * weight


def classify(p95_ppm: float) -> str:
    """Classificação pelo cenário desfavorável (p95) contra os SMAC de CO."""
    if p95_ppm > SMAC_CO["limit_1h_ppm"]:
        return "EXCEEDS_SMAC_1H"
    if p95_ppm > SMAC_CO["limit_24h_ppm"]:
        return "EXCEEDS_SMAC_24H"
    return "WITHIN_SMAC"


def project(material: str, coefficient: float, o2_pct: float, rng: random.Random) -> dict:
    samples = sorted(
        coefficient * o2_pct * rng.lognormvariate(0.0, COEFFICIENT_SIGMA)
        for _ in range(SAMPLES_PER_SCENARIO)
    )
    p95 = percentile(samples, 0.95)
    return {
        "material": material,
        "o2_pct": o2_pct,
        "samples": SAMPLES_PER_SCENARIO,
        "co_p05_ppm": round(percentile(samples, 0.05), 1),
        "co_p50_ppm": round(percentile(samples, 0.50), 1),
        "co_p95_ppm": round(p95, 1),
        "prob_exceeds_24h": round(sum(s > SMAC_CO["limit_24h_ppm"] for s in samples) / len(samples), 3),
        "prob_exceeds_1h": round(sum(s > SMAC_CO["limit_1h_ppm"] for s in samples) / len(samples), 3),
        "risk_level": classify(p95),
        "origin_category": "Synthetic",
        "quality_status": "PENDING_VALIDATION",
    }


def fit_check(tests: tuple[dict, ...], coefficients: dict[str, float]) -> list[dict]:
    """Modelo (mediana) contra o medido, nos próprios testes do ajuste (dentro da amostra)."""
    rows = []
    for test in tests:
        predicted = coefficients[test["material"]] * test["o2_pct"]
        rows.append({
            "test_id": test["test_id"],
            "measured_ppm": test["delta_co_ppm"],
            "predicted_ppm": round(predicted, 1),
            "error_pct": round((predicted - test["delta_co_ppm"]) / test["delta_co_ppm"] * 100, 1),
        })
    return rows


def build_report(seed: int = SEED) -> dict:
    rng = random.Random(seed)
    coefficients = fit_coefficients(REFERENCE_TESTS)
    projections = [
        project(material, coefficients[material], o2, rng)
        for material in sorted(coefficients)
        for o2 in SCENARIO_O2_PCT
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_by": "simulation/predicoes.py",
        "seed": seed,
        "smac_co": SMAC_CO,
        "reference_tests": [
            {**test, "origin_category": "Published", "source": SAFFIRE_SOURCE} for test in REFERENCE_TESTS
        ],
        "not_ignited": list(NOT_IGNITED),
        "model": {
            "description": "Monte Carlo do ΔCO por material e fração de O₂, calibrado nos testes publicados do Saffire IV a VI.",
            "coefficients_ppm_per_o2_pct": {m: round(k, 3) for m, k in sorted(coefficients.items())},
            "coefficient_sigma": COEFFICIENT_SIGMA,
            "hypotheses": list(HYPOTHESES),
            "origin_category": "Synthetic",
        },
        "fit_check": fit_check(REFERENCE_TESTS, coefficients),
        "projections": projections,
    }


def render(report: dict) -> str:
    return json.dumps(report, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="só confere se o JSON versionado está atualizado")
    args = parser.parse_args(argv)
    # Console do Windows (cp1252) não imprime ✔/✘ nem acentos sem isso
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")

    content = render(build_report())
    if args.check:
        current = args.output.read_text(encoding="utf-8") if args.output.exists() else ""
        if current != content:
            print(f"✘ {args.output} desatualizado: rode python simulation/predicoes.py", file=sys.stderr)
            return 1
        print(f"✔ {args.output} atualizado")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8", newline="\n")
    print(f"✔ {len(json.loads(content)['projections'])} projeções gravadas em {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
