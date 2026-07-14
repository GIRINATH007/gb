-- Phase 2 migration: extend tracking_sessions with elevation, pace, and splits.
-- Apply manually via the Supabase SQL editor AFTER tracking_sessions.sql.

ALTER TABLE public.tracking_sessions
  ADD COLUMN IF NOT EXISTS elevation_gain_metres  NUMERIC(8, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_pace_seconds_per_km INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS splits                 JSONB         DEFAULT '[]'::jsonb;

-- splits element shape:
-- {
--   "km": 1,
--   "split_seconds": 312,
--   "avg_pace_seconds_per_km": 312,
--   "elevation_gain_metres": 4.2
-- }
