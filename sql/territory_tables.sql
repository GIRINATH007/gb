-- backend/sql/territory_tables.sql
-- Run this BEFORE the functions above

CREATE TABLE IF NOT EXISTS territories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL,
  session_id      UUID,
  geometry        public.geometry(POLYGON, 4326) NOT NULL,
  area_sqm        FLOAT NOT NULL DEFAULT 0,
  capture_count   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB DEFAULT '{}'
);

-- CRITICAL: GIST index makes overlap queries fast
-- Without this, every query scans ALL rows
CREATE INDEX IF NOT EXISTS idx_territories_geometry
  ON territories USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_territories_owner
  ON territories (owner_id);

CREATE TABLE IF NOT EXISTS territory_ownership_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id    UUID NOT NULL REFERENCES territories(id),
  prev_owner_id   UUID REFERENCES auth.users(id),
  new_owner_id    UUID NOT NULL REFERENCES auth.users(id),
  session_id      UUID REFERENCES tracking_sessions(id),
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ownership_log_territory
  ON territory_ownership_log (territory_id);