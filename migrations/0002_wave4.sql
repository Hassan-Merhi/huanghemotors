PRAGMA foreign_keys = ON;

ALTER TABLE models ADD COLUMN public_quantity INTEGER;
ALTER TABLE models ADD COLUMN stock_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE models ADD COLUMN stock_updated_at TEXT;

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO site_settings(key,value) VALUES
  ('whatsapp_number',''),
  ('show_public_quantity','0')
ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  model_slug TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','closed','spam')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(model_slug) REFERENCES models(slug) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_rate_limits (
  identity_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mototrack_mapping (
  model_slug TEXT PRIMARY KEY,
  external_key TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(model_slug) REFERENCES models(slug) ON DELETE CASCADE
);
INSERT INTO mototrack_mapping(model_slug,external_key,enabled) VALUES
  ('eagle','eagle',1),
  ('super','super',1)
ON CONFLICT(model_slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS mototrack_sync_log (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mototrack_sync_created ON mototrack_sync_log(created_at DESC);
