import { getDatabase } from '@netlify/database';

export function database() {
  return getDatabase();
}

export async function query(sql, params = []) {
  return database().sql.unsafe(sql, params);
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function exec(sql, params = []) {
  await query(sql, params);
}
