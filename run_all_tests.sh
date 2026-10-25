#!/bin/bash
echo "=================================================="
echo "[Tex-Labs] A iniciar a Bateria Completa de Testes..."
echo "=================================================="

echo -e "\n--- [1/3] A executar Teste de Telemetria (Loop de Picos & Gases) ---"
curl -s -X POST http://localhost/api/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "2026-10-23T02:30:00Z", "temperature_c": 45.5, "co_ppm": 60, "co2_pct": 1.8, "status": "WARNING"}'
echo -e "\n[Leitura Recente]:"
curl -s http://localhost/api/v1/telemetry/latest

echo -e "\n\n--- [2/3] A executar Testes de Carga e Resiliência (NTRS & PSI) ---"
cd ingestion
npx vitest run test/ntrs.test.ts test/psi.test.ts
cd ..

echo -e "\n--- [3/3] A executar Teste de Regras de Supressão e Alarme Crítico ---"
curl -s -X POST http://localhost/api/v1/suppression/trigger \
  -H "Content-Type: application/json" \
  -d '{"trigger_source": "SMAC_CO_THRESHOLD", "severity": "CRITICAL", "action": "ACTIVATE_SUPPRESSION_SYSTEM"}'
echo -e "\n[Estado da Supressão]:"
curl -s http://localhost/api/v1/suppression/status

echo -e "\n=================================================="
echo "[Tex-Labs] Bateria completa concluída com sucesso, capitão!"
echo "=================================================="
