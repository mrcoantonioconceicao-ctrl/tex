// Módulo de Ligação ao PostgreSQL - Tex Labs Space Fire
import pkg from 'pg';
const { Pool } = pkg;

// Configuração da pool com base no ambiente local do Termux
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/tex_space_fire'
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Log opcional de debug de queries se necessário
  return res;
}

export default pool;
