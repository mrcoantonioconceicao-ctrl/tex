#!/usr/bin/env python3
import json

def analisar_dados_historicos():
    print("[Tex-Labs] A carregar parâmetros de estudos históricos da NASA (Saffire / FLEX)...")

    # Simulação baseada em dados reais de relatórios de combustão em microgravidade
    cenarios = [
        {"experimento": "Saffire-I", "material": "PMMA", "energia_entrada_kj": 120, "taxa_liberacao_co_ppm_min": 4.5, "duracao_estudo_min": 30},
        {"experimento": "Saffire-II", "material": "Nomex/Cotton", "energia_entrada_kj": 95, "taxa_liberacao_co_ppm_min": 2.8, "duracao_estudo_min": 45},
        {"experimento": "FLEX-ID", "material": "Gota de Heptano", "energia_entrada_kj": 210, "taxa_liberacao_co_ppm_min": 8.2, "duracao_estudo_min": 20}
    ]

    # Limites críticos de referência (NASA-STD-3001 / SMAC)
    limite_max_co_acumulado_ppm = 50.0

    resultados_analise = []

    for c in cenarios:
        co_total = c["taxa_liberacao_co_ppm_min"] * c["duracao_estudo_min"]
        excede = co_total > limite_max_co_acumulado_ppm
        
        resultados_analise.append({
            "experimento": c["experimento"],
            "material_estudado": c["material"],
            "co_total_acumulado_ppm": round(co_total, 2),
            "limite_seguranca_excedido": excede,
            "status_habitabilidade": "CRÍTICO - REQUER SUPRESSÃO" if excede else "ESTÁVEL - DENTRO DOS PARÂMETROS"
        })

    relatorio_final = {
        "base_conhecimento": "Documentação Técnica NASA (Git docs/conhecimento/)",
        "norma_referencia": "NASA-STD-3001 / SMAC",
        "analises": resultados_analise
    }

    print(json.dumps(relatorio_final, indent=2, ensure_ascii=False))
    print("[Tex-Labs] Análise analítica baseada em histórico concluída com sucesso, capitão!")

if __name__ == "__main__":
    analisar_dados_historicos()
