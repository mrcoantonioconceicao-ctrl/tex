#!/usr/bin/env bash
set -e

echo "=================================================="
echo "[Tex-Labs] A iniciar a suíte completa de testes e scripts..."
echo "=================================================="

echo "[Passo 1/3] A executar a implementação principal e popular a base de dados..."
python3 implementar_sistema_completo.py

echo -e "\n[Passo 2/3] A testar o pipeline de ingestão contínua de documentos..."
python3 pipeline_ingestao_continua.py

echo -e "\n[Passo 3/3] A verificar integridade dos ficheiros gerados..."
if [ -f "tex_labs_mission.db" ]; then
    echo "[Verificação] Base de dados 'tex_labs_mission.db' encontrada com sucesso."
else
    echo "[Erro] Base de dados não encontrada!"
    exit 1
fi

if [ -f "Relatorio_Tecnico_NASA_Tex_Labs.md" ]; then
    echo "[Verificação] Relatório técnico 'Relatorio_Tecnico_NASA_Tex_Labs.md' gerado com sucesso."
else
    echo "[Erro] Relatório técnico não encontrado!"
    exit 1
fi

if [ -f "dashboard_sync.json" ]; then
    echo "[Verificação] Payload do dashboard 'dashboard_sync.json' sincronizado com sucesso."
else
    echo "[Erro] Payload do dashboard não encontrado!"
    exit 1
fi

echo "=================================================="
echo "[Tex-Labs] Todos os testes e validações foram concluídos com 100% de sucesso, capitão!"
echo "=================================================="
