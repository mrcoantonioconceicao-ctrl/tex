#!/bin/bash
echo "[Tex-Labs] A procurar por definições de rotas e endpoints no backend..."

# Procurar por ficheiros de rotas, express, fastify ou equivalentes
if [ -d "backend" ]; then
    cd backend
fi

echo "--- Ficheiros de rotas ou servidores encontrados ---"
find . -name "*.ts" -o -name "*.js" | xargs grep -E "app\.|router\.|get\(|post\(" -n 2>/dev/null

echo -e "\n[Tex-Labs] Inspeção de rotas concluída, capitão!"
