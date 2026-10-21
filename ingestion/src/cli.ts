// CLI de Ingestão - Tex Labs Space Fire
import { ingestNtrsData } from './ntrs';
import { ingestPsiData } from './psi';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const query = args[1] || 'microgravity combustion';

  console.log(`[CLI] A iniciar comando: "${command || 'help'}" com termo: "${query}"`);

  try {
    if (command === 'ingest-ntrs') {
      const count = await ingestNtrsData(query);
      console.log(`[CLI] Sucesso! ${count} registos do NTRS processados.`);
    } else if (command === 'ingest-psi') {
      const count = await ingestPsiData(query);
      console.log(`[CLI] Sucesso! ${count} registos experimentais do PSI processados.`);
    } else {
      console.log(`
Comandos disponíveis:
  npm run cli -- ingest-ntrs [termo]  - Ingerir dados teóricos do NTRS
  npm run cli -- ingest-psi [termo]   - Ingerir dados experimentais do PSI
      `);
    }
  } catch (error) {
    console.error('[CLI Error] Falha na execução da ingestão:', error);
    process.exit(1);
  }
  process.exit(0);
}

main();
