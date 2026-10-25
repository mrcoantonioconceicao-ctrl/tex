#!/bin/bash
echo "[Tex-Labs] A iniciar o Teste 3: Regras de Supressão e Alarme Crítico..."

# Simulação de disparo de alarme por exceder o limite de CO / Temperatura crítica
curl -s -X POST http://localhost/api/v1/suppression/trigger \
  -H "Content-Type: application/json" \
  -d '{"trigger_source": "SMAC_CO_THRESHOLD", "severity": "CRITICAL", "action": "ACTIVATE_SUPPRESSION_SYSTEM"}'

echo -e "\n[Tex-Labs] A verificar o estado atual do sistema e das regras de supressão..."
curl -s http://localhost/api/v1/suppression/status

echo -e "\n[Tex-Labs] Teste de regras de supressão concluído, capitão!"
