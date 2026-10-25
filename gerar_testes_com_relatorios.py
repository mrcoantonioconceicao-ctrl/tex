#!/usr/bin/env python3
import os
import json
import sqlite3
import random
from datetime import datetime

DB_PATH = "tex_labs_mission.db"
DIRETORIO_RELATORIOS = "relatorios_testes"

def garantir_ambiente():
    os.makedirs(DIRETORIO_RELATORIOS, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS testes_relatorios_automaticos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teste_id TEXT,
            material TEXT,
            co_ppm REAL,
            status_seguranca TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def executar_e_gerar_relatorios():
    print("[Tex-Labs Engine] A iniciar bateria de testes com emissão automática de relatórios...")
    
    # Conjunto de cenários de teste diversificados baseados em Saffire e ACME
    cenarios_teste = [
        {"id": "TEST-SAF-001", "material": "PMMA 2-Sided", "taxa_base": 4.5, "o2": 28.0},
        {"id": "TEST-SAF-002", "material": "Cotton Jersey", "taxa_base": 2.2, "o2": 26.2},
        {"id": "TEST-SAF-003", "material": "SIBAL Fabric", "taxa_base": 2.0, "o2": 22.0},
        {"id": "TEST-ACME-004", "material": "Metanol (CH3OH)", "taxa_base": 3.8, "o2": 30.5},
        {"id": "TEST-ACME-005", "material": "Heptano (C7H16)", "taxa_base": 5.0, "o2": 25.0}
    ]
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    for cenario in cenarios_teste:
        t_id = cenario["id"]
        mat = cenario["material"]
        o2 = cenario["o2"]
        
        # Simulação do teste individual com variação estocástica realista
        co_gerado = round(cenario["taxa_base"] * o2 * random.uniform(1.1, 1.4), 2)
        
        # Avaliação com base na norma NASA SMAC (1h = 425 ppm, 24h = 100 ppm)
        if co_gerado > 425.0:
            status = "CRÍTICO - EXCEDEU SMAC 1H"
        elif co_gerado > 100.0:
            status = "ALERTA - EXCEDEU SMAC 24H"
        else:
            status = "ESTÁVEL - DENTRO DOS PARÂMETROS"
            
        # Inserir na base de dados
        cursor.execute("""
            INSERT INTO testes_relatorios_automaticos (teste_id, material, co_ppm, status_seguranca)
            VALUES (?, ?, ?, ?)
        """, (t_id, mat, co_gerado, status))
        conn.commit()
        
        # Gerar relatório individual em Markdown para cada teste executado
        nome_ficheiro_relatorio = os.path.join(DIRETORIO_RELATORIOS, f"relatorio_{t_id.lower()}.md")
        conteudo_relatorio = f"""# Relatório Individual de Teste - {t_id}
**Sistema:** Tex Labs / NASA Microgravity Corpus  
**Data e Hora:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  

## 1. Parâmetros de Teste
- **Material Avaliado:** {mat}
- **Concentração de Oxigénio ($O_2$):** {o2}%
- **CO Projetado Acumulado:** {co_gerado} ppm

## 2. Diagnóstico de Segurança (Norma NASA-STD-3001 / SMAC)
- **Estado Operacional:** `{status}`
- **Análise Técnica:** {"O nível de monóxido de carbono ultrapassou os limiares críticos de exposição em ambiente confinado, exigindo acionamento imediato de sistemas de filtragem e supressão." if "CRÍTICO" in status or "ALERTA" in status else "O material manteve a emissão de gases de combustão abaixo dos limiares de toxicidade agudo-prolongada."}

---
*Relatório gerado automaticamente pelo motor de testes do Tex Labs, capitão!*
"""
        with open(nome_ficheiro_relatorio, "w", encoding="utf-8") as f:
            f.write(conteudo_relatorio)
            
        print(f"[Tex-Labs Testes] Teste {t_id} executado -> Relatório gerado em '{nome_ficheiro_relatorio}'")

    conn.close()
    print("\n[Tex-Labs Engine] Todos os testes executados e relatórios individuais gerados com sucesso!")

if __name__ == "__main__":
    garantir_ambiente()
    executar_e_gerar_relatorios()
