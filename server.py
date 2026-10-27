from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import os

app = FastAPI(title="Tex Labs API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    conn = sqlite3.connect("tex_labs_mission.db")
    conn.row_factory = sqlite3.Row
    conn.text_factory = str  # Garante UTF-8 estrito e evita caracteres corrompidos
    return conn

@app.get("/api/v1/telemetry/latest")
def get_latest_telemetry():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 1;")
        row = cursor.fetchone()
        conn.close()
        if not row:
            return {"status": "empty", "message": "Nenhum dado de telemetria encontrado."}
        return dict(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Relatório gerado por simulation/predicoes.py (make simulate); é o mesmo que o painel exibe
PREDICTIONS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "src", "data", "predicoes.json")

@app.get("/api/v1/simulation/summary")
def get_simulation_summary():
    if os.path.exists(PREDICTIONS_PATH):
        with open(PREDICTIONS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Relatório de predição não encontrado.")

@app.get("/api/v1/metrics")
def get_metrics():
    return {"status": "active", "standard": "NASA-STD-3001 / SMAC", "dataSource": "Historical Saffire/ACME/BASS/FLEX"}

@app.get("/api/v1/mcp/context")
def get_mcp_context():
    return {"context": "Tex Labs Local Engine", "status": "synced"}
