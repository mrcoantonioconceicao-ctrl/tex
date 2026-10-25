#!/bin/bash
echo "[Tex-Labs] A entrar no diretório ingestion e a instalar a dependência em falta (zod)..."
cd ingestion
npm install zod
echo "[Tex-Labs] A executar novamente os testes de ingestão..."
npm test
cd ..
echo "[Tex-Labs] Processo concluído, capitão!"
