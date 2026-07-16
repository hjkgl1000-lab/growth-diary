import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function query(sql, args = []) {
  const result = await pool.query(sql, args);
  return result.rows;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS children (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    birthdate TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'white',
    created_at TEXT NOT NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL,
    record_date TEXT NOT NULL,
    content TEXT,
    author TEXT,
    created_at TEXT NOT NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    url TEXT NOT NULL,
    file_id TEXT,
    width INTEGER,
    height INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  const rows = await query('SELECT COUNT(*)::int as cnt FROM children');
  if (rows[0].cnt === 0) {
    const now = new Date().toISOString();
    await query(
      'INSERT INTO children (id, name, birthdate, color, created_at) VALUES ($1,$2,$3,$4,$5)',
      [randomUUID(), '유빈', '2023-01-01', 'white', now]
    );
    await query(
      'INSERT INTO children (id, name, birthdate, color, created_at) VALUES ($1,$2,$3,$4,$5)',
      [randomUUID(), '해인', '2023-01-01', 'black', now]
    );
  }
}

export { query, withTransaction, init, randomUUID };
