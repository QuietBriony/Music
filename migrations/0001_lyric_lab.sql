CREATE TABLE IF NOT EXISTS lyric_drafts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  seed TEXT NOT NULL DEFAULT '',
  settings_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  reroll INTEGER NOT NULL DEFAULT 0,
  active_view TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lyric_drafts_updated_at
  ON lyric_drafts(updated_at DESC);
