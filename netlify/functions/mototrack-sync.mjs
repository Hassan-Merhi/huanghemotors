import { runMotoTrackSync } from '../lib/api.mjs';

export default async () => {
  if (!process.env.MOTOTRACK_URL) return;
  try { await runMotoTrackSync(false); }
  catch (error) { console.error(JSON.stringify({ event: 'mototrack_sync_error', message: error?.message || String(error) })); }
};

export const config = {
  schedule: '*/15 * * * *',
};
