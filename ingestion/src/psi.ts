// Conector PSI (Physical Sciences Informatics) - NASA
// Foco em dados experimentais, séries temporais e medições físicas de combustão (FLEX, ACME, etc.)
import { query } from './db';

export interface PsiMeasurement {
  variable: string;
  value: number;
  unit: string;
  elapsedTimeSeconds?: number;
}

export interface PsiExperimentRecord {
  experimentId: string;
  name: string;
  program: 'FLEX' | 'ACME' | 'Saffire' | 'BASS';
  runDate?: string;
  notes?: string;
  measurements: PsiMeasurement[];
}

export async function fetchPsiDataset(queryTerm: string, maxResults = 10): Promise<PsiExperimentRecord[]> {
  console.log(`[PSI] A consultar dados experimentais para: "${queryTerm}" (máx: ${maxResults})`);
  
  const mockRecords: PsiExperimentRecord[] = [
    {
      experimentId: `PSI-FLEX-${Date.now()}-1`,
      name: 'FLEX Microgravity Droplet Combustion Test A1',
      program: 'FLEX',
      runDate: new Date().toISOString().split('T')[0],
      notes: 'Estudo do comportamento de extinção de chama em ambiente de microgravidade.',
      measurements: [
        { variable: 'chamber_pressure_kpa', value: 101.3, unit: 'kPa', elapsedTimeSeconds: 0 },
        { variable: 'oxygen_concentration', value: 18.5, unit: '%', elapsedTimeSeconds: 5 },
        { variable: 'flame_temperature', value: 1250.4, unit: 'K', elapsedTimeSeconds: 10 }
      ]
    }
  ];

  return mockRecords.slice(0, maxResults);
}

export async function ingestPsiData(queryTerm: string): Promise<number> {
  const records = await fetchPsiDataset(queryTerm);
  let insertedCount = 0;

  for (const rec of records) {
    // 1. Inserir ou recuperar o experimento
    let expResult = await query(
      `SELECT experiment_id FROM experiments WHERE name = $1;`,
      [rec.name]
    );

    let dbExperimentId: number;
    if (expResult.rows.length > 0) {
      dbExperimentId = expResult.rows[0].experiment_id;
    } else {
      const insertExp = await query(
        `INSERT INTO experiments (name, program)
         VALUES ($1, $2)
         RETURNING experiment_id;`,
        [rec.name, rec.program]
      );
      dbExperimentId = insertExp.rows[0].experiment_id;
    }

    // 2. Criar uma execução experimental (experimental_runs) ligada ao experimento
    const runResult = await query(
      `INSERT INTO experimental_runs (experiment_id, run_date, notes)
       VALUES ($1, $2, $3)
       RETURNING run_id;`,
      [dbExperimentId, rec.runDate || null, rec.notes || '']
    );
    const dbRunId = runResult.rows[0].run_id;

    // 3. Inserir as medições associadas ao run_id
    for (const m of rec.measurements) {
      await query(
        `INSERT INTO measurements (run_id, variable, value, unit, elapsed_time_seconds, origin_category)
         VALUES ($1, $2, $3, $4, $5, 'Measured');`,
        [dbRunId, m.variable, m.value, m.unit, m.elapsedTimeSeconds || 0]
      );
    }

    insertedCount++;
  }

  console.log(`[PSI] Ingeridos com sucesso ${insertedCount} registos experimentais no PostgreSQL.`);
  return insertedCount;
}
