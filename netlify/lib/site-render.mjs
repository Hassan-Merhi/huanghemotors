import { query } from './db.mjs';

export async function siteContentData() {
  try {
    const fields = await query('SELECT key,value_en,value_fr FROM site_content ORDER BY sort_order,key');
    return { content: Object.fromEntries(fields.map((row) => [row.key, { en: row.value_en, fr: row.value_fr }])) };
  } catch {
    return { content: {} };
  }
}
