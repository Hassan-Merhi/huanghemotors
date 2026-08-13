PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS models (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_fr TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT 'inquire' CHECK (availability IN ('in_stock','low_stock','out_of_stock','coming_soon','inquire')),
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  spec_engine TEXT NOT NULL DEFAULT '',
  spec_transmission TEXT NOT NULL DEFAULT '',
  spec_brakes TEXT NOT NULL DEFAULT '',
  spec_fuel TEXT NOT NULL DEFAULT '',
  spec_colors TEXT NOT NULL DEFAULT '',
  spec_price TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_images (
  id TEXT PRIMARY KEY,
  model_slug TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  alt_en TEXT NOT NULL DEFAULT '',
  alt_fr TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_slug) REFERENCES models(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_model_images_model_sort ON model_images(model_slug, is_primary DESC, sort_order ASC);

CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  model_slug TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);

INSERT INTO models (
  slug, name, description_en, description_fr, availability, published, sort_order
) VALUES
  ('eagle', 'Eagle', 'A practical Huanghe motorcycle range presented for everyday mobility in Lubumbashi.', 'Une gamme de motos Huanghe pratique, présentée pour les déplacements quotidiens à Lubumbashi.', 'inquire', 1, 10),
  ('super', 'Super', 'A Huanghe motorcycle range presented around utility, road presence and dependable day-to-day use.', 'Une gamme de motos Huanghe présentée autour de l’utilité, de la présence sur route et d’un usage quotidien fiable.', 'inquire', 1, 20)
ON CONFLICT(slug) DO NOTHING;
