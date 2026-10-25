import os
import sqlite3
import glob

DB_PATH = "tex_labs_mission.db"
KNOWLEDGE_DIR = "docs/conhecimento"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS base_conhecimento_simulacao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT,
            conteudo TEXT,
            fonte TEXT,
            data_insercao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def injetar_markdowns():
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    arquivos = glob.glob(os.path.join(KNOWLEDGE_DIR, "*.md"))
    print(f"[Tex-Labs Ingestão] A processar {len(arquivos)} ficheiros da pasta de conhecimento...")
    
    for arq in arquivos:
        nome_arquivo = os.path.basename(arq)
        with open(arq, "r", encoding="utf-8") as f:
            conteudo = f.read()
            
        # Inserir ou atualizar na base de dados
        cursor.execute("""
            INSERT INTO base_conhecimento_simulacao (titulo, conteudo, fonte)
            VALUES (?, ?, ?)
        """, (nome_arquivo, conteudo, arq))
        print(f" -> Indexado com sucesso: {nome_arquivo}")
        
    conn.commit()
    conn.close()
    print("[Tex-Labs Ingestão] Concluído! Toda a documentação histórica foi indexada na base de dados de simulação.")

if __name__ == "__main__":
    injetar_markdowns()
