#!/bin/bash
echo "[Tex-Labs] A iniciar o teste de carga e resiliência dos conectores (NTRS & PSI)..."

cd ingestion

# Executar os testes unitários focados na resiliência e retry dos conectores
npx vitest run test/ntrs.test.ts test/psi.test.ts

cd ..
echo "[Tex-Labs] Teste de carga e resiliência concluído, capitão!"
