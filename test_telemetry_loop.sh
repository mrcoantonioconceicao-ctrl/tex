#!/bin/bash
echo "[Tex-Labs] A simular picos de telemetria e eventos críticos..."

# Enviar um payload de telemetria simulando anomalia térmica e gases
curl -s -X POST http://localhost/api/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "2026-10-23T02:30:00Z", "temperature_c": 45.5, "co_ppm": 60, "co2_pct": 1.8, "status": "WARNING"}'

echo -e "\n[Tex-Labs] A verificar a última leitura de telemetria no endpoint..."
curl -s http://localhost/api/v1/telemetry/latest

echo -e "\n[Tex-Labs] Teste de loop de telemetria concluído, capitão!"
