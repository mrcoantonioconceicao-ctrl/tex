#!/usr/bin/env python3
import sqlite3
import random
import json
from datetime import datetime

DB_PATH = "tex_labs_mission.db"

def executar_simulacao_monte_carlo():
    print("[Tex-Labs Preditivo] A iniciar simulação estocástica (Monte Carlo) para cenários espaciais...")
    
    # Parâmetros de simulação baseados nas restrições de volume da Cygnus (~17-19 m³)
    materiais_alvo = ["PMMA Espesso", "Nomex/Cotton", "Algodão-Fibra de Vidro (SIBAL)", "Gotícula de Heptano"]
    
    resultados_simulacao = []
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Criar tabela para predições se não existir
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prepredicoes_avancadas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material TEXT,
            oxigenio_pct REAL,
            pressao_kpa REAL,
            co_projetado_ppm REAL,
            risco_tripulacao TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    for material in materiais_alvo:
        # Variação estocástica de oxigênio (21% a 31%) e pressão baseada nos testes Saffire IV-VI
        o2_ambient = round(random.uniform(21.0, 31.0), 2)
        pressao_ambient = round(random.uniform(50.0, 101.3), 1)
        
        # Modelo preditivo simplificado de acumulação de CO com base na concentração de O2
        taxa_base_co = 4.0 if "PMMA" in material else 2.5
        co_projetado = round(taxa_base_co * o2_ambient * random.uniform(1.2, 1.8), 2)
        
        # Limite de 1 hora SMAC para CO é 425 ppm (e 24h é 100 ppm)
        if co_projetado > 425.0:
            risco = "ALTO RISCO - EXcede SMAC 1h"
        elif co_projetado > 100.0:
            risco = "MODERADO - Excede SMAC 24h"
        else:
            risco = "SEGURO - Dentro dos limites"
            
        resultados_simulacao.append({
            "material": material,
            "o2_pct": o2_ambient,
            "pressao_kpa": pressao_ambient,
            "co_projetado_ppm": co_projetado,
            "status_risco": risco
        })
        
        cursor.execute("""
            INSERT INTO prepredicoes_avancadas (material, oxigenio_pct, pressao_kpa, co_projetado_ppm, risco_tripulacao)
            VALUES (?, ?, ?, ?, ?)
        """, (material, o2_ambient, pressao_ambient, co_projetado, risco))

    conn.commit()
    conn.close()
    
    print("\n[Tex-Labs Preditivo] Resultados da Simulação Preditiva Avançada:")
    print(json.dumps(resultados_simulacao, indent=2, ensure_ascii=False))
    
    # Guardar relatório de predição
    with open("relatorio_predicoes_avancadas.json", "w", encoding="utf-8") as f:
        json.dump(resultados_simulacao, f, indent=2, ensure_ascii=False)
        
    print("\n[Tex-Labs Preditivo] Simulação concluída e gravada com sucesso, capitão!")

if __name__ == "__main__":
    executar_simulacao_monte_carlo()
