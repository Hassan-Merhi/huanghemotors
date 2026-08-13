import { query } from './db.mjs';

const PHOTO_SLOTS = {
  'site-home-hero': 'home.hero',
  'site-heritage-main': 'home.heritage.main',
  'site-heritage-side': 'home.heritage.side',
  'site-dealership-showroom': 'dealership.showroom',
};

export async function siteContentData() {
  try {
    const [fields, photos] = await Promise.all([
      query('SELECT key,value_en,value_fr FROM site_content ORDER BY sort_order,key'),
      query(`SELECT model_slug,object_key,alt_en,alt_fr,is_primary,sort_order,created_at
        FROM model_images
        WHERE model_slug IN ('site-home-hero','site-heritage-main','site-heritage-side','site-dealership-showroom')
        ORDER BY model_slug,is_primary DESC,sort_order,created_at`),
    ]);
    const media = {};
    for (const photo of photos) {
      const slot = PHOTO_SLOTS[photo.model_slug];
      if (!slot || media[slot]) continue;
      media[slot] = {
        url: `/media/${photo.object_key}`,
        alt_en: photo.alt_en || '',
        alt_fr: photo.alt_fr || '',
      };
    }
    return {
      content: Object.fromEntries(fields.map((row) => [row.key, { en: row.value_en, fr: row.value_fr }])),
      media,
    };
  } catch {
    return { content: {}, media: {} };
  }
}
