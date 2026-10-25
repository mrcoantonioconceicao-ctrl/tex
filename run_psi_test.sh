#!/bin/bash
echo "[Tex-Labs] A iniciar a validação do conector PSI e ingestão..."
cd ingestion
npx vitest run test/psi.test.ts
cd ..
echo "[Tex-Labs] Teste do conector PSI concluído, capitão!"
