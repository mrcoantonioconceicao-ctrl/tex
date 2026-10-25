import { describe, it, expect } from 'vitest';
import { fetchPsiDataset, ingestPsiData } from '../src/psi';

describe('PSI Connector Tests', () => {
  it('deve exportar as funções de busca e ingestão do PSI', () => {
    expect(typeof fetchPsiDataset).toBe('function');
    expect(typeof ingestPsiData).toBe('function');
  });

  it('deve retornar uma estrutura válida para a consulta de experimentos', async () => {
    const results = await fetchPsiDataset('microgravity combustion', 5);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('experimentId');
      expect(results[0]).toHaveProperty('measurements');
    }
  });
});
