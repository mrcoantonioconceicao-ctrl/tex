.PHONY: all db pipeline sim tests clean

all: db pipeline sim tests
@echo "=================================================="
@echo "[Tex-Labs] Suíte completa executada com sucesso via Make, capitão!"
@echo "=================================================="

db:
python3 implementar_sistema_completo.py

pipeline:
python3 pipeline_ingestao_continua.py

sim:
python3 simulacao_preditiva_avancada.py

tests:
python3 gerar_testes_com_relatorios.py

clean:
rm -f tex_labs_mission.db Relatorio_Tecnico_NASA_Tex_Labs.md dashboard_sync.json relatorio_predicoes_avancadas.json
rm -rf relatorios_testes/
