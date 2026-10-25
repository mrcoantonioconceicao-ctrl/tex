#!/usr/bin/env python3
import os
import json
import sqlite3
from datetime import datetime

# Diretórios de trabalho
DIRETORIO_ENTRADA = "docs/novos_documentos"
DB_PATH = "tex_labs_mission.db"

def garantir_infraestrutura():
    os.makedirs(DIRETORIO_ENTRADA, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS simulacoes_historicas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            experimento TEXT,
            material TEXT,
            co_acumulado_ppm REAL,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def processar_novos_documentos():
    print(f"[Tex-Labs Pipeline] A vasculhar diretório de entrada: '{DIRETORIO_ENTRADA}'...")
    
    if not os.path.exists(DIRETORIO_ENTRADA):
        print("[Tex-Labs Pipeline] Diretório não encontrado.")
        return

    ficheiros = [f for f in os.listdir(DIRETORIO_ENTRADA) if f.endswith(".json")]
    
    if not ficheiros:
        print("[Tex-Labs Pipeline] Nenhum novo documento JSON encontrado para ingestão.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    novos_registos_inseridos = 0

    for ficheiro in ficheiros:
        caminho_ficheiro = os.path.join(DIRETORIO_ENTRADA, ficheiro)
        print(f"[Tex-Labs Pipeline] A processar ficheiro: {ficheiro}...")
        
        try:
            with open(caminho_ficheiro, "r", encoding="utf-8") as f:
                dados = json.load(f)
                
            # Formato esperado no JSON: {"experimento": "...", "material": "...", "taxa_co_min": X, "duracao": Y}
            experimento = dados.get("experimento", "Desconhecido")
            material = dados.get("material", "Desconhecido")
            taxa_co = float(dados.get("taxa_co_min", 0.0))
            duracao = float(dados.get("duracao_min", 0.0))
            
            co_total = taxa_co * duracao
            limite_max = 50.0 # Norma NASA-STD-3001 / SMAC
            
            status = "CRÍTICO - REQUER SUPRESSÃO" if co_total > limite_max else "ESTÁVEL - DENTRO DOS PARÂMETROS"

            # Inserir na base de dados
            cursor.execute("""
                INSERT INTO simulacoes_historicas (experimento, material, co_acumulado_ppm, status)
                VALUES (?, ?, ?, ?)
            """, (experimento, material, co_total, status))
            
            conn.commit()
            novos_registos_inseridos += 1
            print(f"[Tex-Labs Pipeline] Sucesso: {experimento} ({material}) inserido na base de dados!")
            
            # Opcional: mover ficheiro processado para evitar duplicados
            os.rename(caminho_ficheiro, caminho_ficheiro + ".processado")
            
        except Exception as e:
            print(f"[Tex-Labs Pipeline Erro] Falha ao processar {ficheiro}: {e}")

    conn.close()
    print(f"[Tex-Labs Pipeline] Ingestão concluída. {novos_registos_inseridos} novos registos integrados na base de dados, capitão!")

if __name__ == "__main__":
    garantir_infraestrutura()
    processar_novos_documentos()
