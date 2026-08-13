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
  public_quantity INTEGER,
  stock_source TEXT NOT NULL DEFAULT 'manual',
  stock_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_images (
  id TEXT PRIMARY KEY,
  model_slug TEXT NOT NULL REFERENCES models(slug) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  alt_en TEXT NOT NULL DEFAULT '',
  alt_fr TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_images_model_sort ON model_images(model_slug, is_primary DESC, sort_order ASC);

CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  model_slug TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  model_slug TEXT REFERENCES models(slug) ON DELETE SET NULL,
  language TEXT NOT NULL DEFAULT 'en',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','closed','spam')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_rate_limits (
  identity_hash TEXT PRIMARY KEY,
  window_started_at BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mototrack_mapping (
  model_slug TEXT PRIMARY KEY REFERENCES models(slug) ON DELETE CASCADE,
  external_key TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mototrack_sync_log (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mototrack_sync_created ON mototrack_sync_log(created_at DESC);

INSERT INTO models (slug,name,description_en,description_fr,availability,published,sort_order) VALUES
  ('eagle','Eagle','A practical Huanghe motorcycle range presented for everyday mobility in Lubumbashi.','Une gamme de motos Huanghe pratique, présentée pour les déplacements quotidiens à Lubumbashi.','inquire',1,10),
  ('super','Super','A Huanghe motorcycle range presented around utility, road presence and dependable day-to-day use.','Une gamme de motos Huanghe présentée autour de l’utilité, de la présence sur route et d’un usage quotidien fiable.','inquire',1,20)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO site_settings(key,value) VALUES
  ('whatsapp_number',''),
  ('show_public_quantity','0')
ON CONFLICT(key) DO NOTHING;

INSERT INTO mototrack_mapping(model_slug,external_key,enabled) VALUES
  ('eagle','eagle',1),
  ('super','super',1)
ON CONFLICT(model_slug) DO NOTHING;
