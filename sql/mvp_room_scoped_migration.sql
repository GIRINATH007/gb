-- GeoLoop MVP Phase 2 — Room-scoped territory migration (CORRECTED)
-- Run ONCE in Supabase SQL Editor on staging first.
-- Requires: territory_tables.sql, tracking_sessions.sql, rooms.sql, migration_room_territories.sql

-- ============================================================
-- 1. Cleanup orphaned data (room_id IS NULL)
-- ============================================================

CREATE TABLE IF NOT EXISTS territories_orphan_backup AS
SELECT * FROM territories WHERE room_id IS NULL;

DELETE FROM territories WHERE room_id IS NULL;

-- ============================================================
-- 2. Schema constraints
-- ============================================================

-- Add room_id column to tracking_sessions
ALTER TABLE tracking_sessions
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE;

-- Delete orphan data in correct order (child tables first)
DELETE FROM territory_ownership_log
WHERE session_id IN (SELECT id FROM tracking_sessions WHERE room_id IS NULL);

-- Clean up territories with session_id not in tracking_sessions (orphaned refs)
DELETE FROM territories
WHERE session_id IS NOT NULL
  AND session_id NOT IN (SELECT id FROM tracking_sessions);

DELETE FROM territories
WHERE session_id IN (SELECT id FROM tracking_sessions WHERE room_id IS NULL);

DELETE FROM tracking_sessions WHERE room_id IS NULL;

ALTER TABLE tracking_sessions
  ALTER COLUMN room_id SET NOT NULL;

ALTER TABLE territories
  ALTER COLUMN room_id SET NOT NULL;

-- FK constraints (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'territories_owner_id_fkey'
  ) THEN
    ALTER TABLE territories
      ADD CONSTRAINT territories_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'territories_session_id_fkey'
  ) THEN
    ALTER TABLE territories
      ADD CONSTRAINT territories_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.tracking_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE territories
  ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_territories_room_owner
  ON territories (room_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_territories_room_session
  ON territories (room_id, session_id);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_user_room
  ON tracking_sessions (user_id, room_id, created_at DESC);

-- ============================================================
-- 3. Constants (used inside functions)
-- ============================================================
-- MIN_OVERLAP_SQM         = 50
-- MIN_OVERLAP_PERCENT     = 10
-- MIN_TERRITORY_AREA_SQM  = 25
-- BUFFER_METRES           = 20

-- ============================================================
-- 4. create_territory_from_path — room_id required
-- ============================================================

CREATE OR REPLACE FUNCTION create_territory_from_path(
  p_user_id UUID,
  p_session_id UUID,
  p_points JSONB,
  p_room_id UUID,
  p_buffer_metres FLOAT DEFAULT 20
) RETURNS TABLE (
  territory_id UUID,
  area_sqm FLOAT
) LANGUAGE plpgsql AS $$
DECLARE
  v_line          public.geometry;
  v_polygon       public.geometry;
  v_territory_id  UUID;
  v_area_sqm      FLOAT;
BEGIN
  IF p_room_id IS NULL THEN
    RAISE EXCEPTION 'room_id is required';
  END IF;

  SELECT ST_SetSRID(ST_MakeLine(
    ARRAY(
      SELECT ST_MakePoint(
        (point->>'lng')::FLOAT,
        (point->>'lat')::FLOAT
      )
      FROM jsonb_array_elements(p_points) AS point
    )
  ), 4326) INTO v_line;

  v_polygon := ST_Transform(
    ST_Buffer(
      ST_Transform(v_line, 3857),
      p_buffer_metres
    ),
    4326
  );

  INSERT INTO territories (owner_id, session_id, geometry, area_sqm, room_id)
  VALUES (
    p_user_id,
    p_session_id,
    v_polygon,
    ST_Area(v_polygon::GEOGRAPHY),
    p_room_id
  )
  RETURNING territories.id, territories.area_sqm INTO v_territory_id, v_area_sqm;

  territory_id := v_territory_id;
  area_sqm := v_area_sqm;
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 5. sync_room_member_scores — score = SUM(owned area)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_room_member_scores(
  p_room_id UUID,
  p_user_ids UUID[]
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE room_members rm
  SET score = COALESCE((
    SELECT ROUND(SUM(t.area_sqm))::INTEGER
    FROM territories t
    WHERE t.room_id = p_room_id AND t.owner_id = rm.user_id
  ), 0)
  WHERE rm.room_id = p_room_id
    AND rm.user_id = ANY(p_user_ids);
END;
$$;

-- ============================================================
-- 6. complete_room_tracking — atomic pipeline
-- ============================================================

CREATE OR REPLACE FUNCTION complete_room_tracking(
  p_user_id UUID,
  p_room_id UUID,
  p_local_session_id TEXT,
  p_started_at TIMESTAMPTZ,
  p_ended_at TIMESTAMPTZ,
  p_duration_seconds INTEGER,
  p_distance_metres NUMERIC,
  p_points JSONB,
  p_buffer_metres FLOAT DEFAULT 20
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_session_id       UUID;
  v_existing         RECORD;
  v_territory_id     UUID;
  v_territory_area   FLOAT;
  v_new_geom         public.geometry;
  v_victim           RECORD;
  v_intersection     public.geometry;
  v_overlap_sqm      FLOAT;
  v_captures         JSONB := '[]'::JSONB;
  v_affected_users   UUID[] := ARRAY[p_user_id];
  v_user_score       INTEGER;
  v_dump             RECORD;
  v_part_area        FLOAT;
  v_first_part       BOOLEAN;
  v_min_overlap      FLOAT := 50;
  v_min_pct          FLOAT := 10;
  v_min_territory    FLOAT := 25;
BEGIN
  -- Verify room membership
  IF NOT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'NOT_ROOM_MEMBER';
  END IF;

  -- Idempotent: return existing session if local_session_id already saved
  SELECT id INTO v_session_id
  FROM tracking_sessions
  WHERE local_session_id = p_local_session_id;

  IF v_session_id IS NOT NULL THEN
    SELECT t.id, t.area_sqm INTO v_territory_id, v_territory_area
    FROM territories t
    WHERE t.session_id = v_session_id
    LIMIT 1;

    SELECT score INTO v_user_score
    FROM room_members
    WHERE room_id = p_room_id AND user_id = p_user_id;

    RETURN jsonb_build_object(
      'alreadySaved', true,
      'sessionId', v_session_id,
      'territory', CASE WHEN v_territory_id IS NOT NULL THEN
        jsonb_build_object('id', v_territory_id, 'area_sqm', v_territory_area)
      ELSE NULL END,
      'captures', '[]'::JSONB,
      'pointsEarned', COALESCE(ROUND(v_territory_area)::INTEGER, 0),
      'scoreDelta', COALESCE(v_user_score, 0)
    );
  END IF;

  IF p_points IS NULL OR jsonb_array_length(p_points) < 2 THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  -- Insert tracking session
  INSERT INTO tracking_sessions (
    user_id, local_session_id, distance_metres, duration_seconds,
    started_at, ended_at, points, room_id
  ) VALUES (
    p_user_id, p_local_session_id, p_distance_metres, p_duration_seconds,
    p_started_at, p_ended_at, p_points, p_room_id
  )
  RETURNING id INTO v_session_id;

  -- Create new territory from path
  SELECT ct.territory_id, ct.area_sqm
  INTO v_territory_id, v_territory_area
  FROM create_territory_from_path(
    p_user_id, v_session_id, p_points, p_room_id, p_buffer_metres
  ) ct;

  SELECT geometry INTO v_new_geom
  FROM territories WHERE id = v_territory_id;

  -- Partial capture loop over enemy territories in same room
  FOR v_victim IN
    SELECT t.id, t.owner_id, t.session_id, t.geometry, t.area_sqm
    FROM territories t
    WHERE t.room_id = p_room_id
      AND t.owner_id != p_user_id
      AND ST_Intersects(t.geometry, v_new_geom)
    FOR UPDATE
  LOOP
    v_intersection := ST_Intersection(v_victim.geometry, v_new_geom);
    v_overlap_sqm := ST_Area(v_intersection::GEOGRAPHY);

    IF v_overlap_sqm >= v_min_overlap
       AND v_overlap_sqm >= (v_min_pct / 100.0) * v_victim.area_sqm THEN

      -- Shrink victim territory by intersection
      UPDATE territories
      SET
        geometry = ST_Difference(geometry, v_intersection),
        area_sqm = ST_Area(ST_Difference(geometry, v_intersection)::GEOGRAPHY)
      WHERE id = v_victim.id
      RETURNING area_sqm, geometry INTO v_victim.area_sqm, v_victim.geometry;

      -- Log capture
      INSERT INTO territory_ownership_log (
        territory_id, prev_owner_id, new_owner_id, session_id
      ) VALUES (
        v_victim.id, v_victim.owner_id, p_user_id, v_session_id
      );

      v_captures := v_captures || jsonb_build_object(
        'territory_id', v_victim.id,
        'prev_owner_id', v_victim.owner_id,
        'overlap_sqm', v_overlap_sqm
      );

      IF NOT v_victim.owner_id = ANY(v_affected_users) THEN
        v_affected_users := array_append(v_affected_users, v_victim.owner_id);
      END IF;

      -- Delete if remainder too small
      IF v_victim.area_sqm < v_min_territory THEN
        DELETE FROM territories WHERE id = v_victim.id;
      ELSIF ST_NumGeometries(v_victim.geometry) > 1 THEN
        -- Split multipart remainder into separate rows
        v_first_part := TRUE;
        FOR v_dump IN SELECT (ST_Dump(v_victim.geometry)).geom AS geom LOOP
          v_part_area := ST_Area(v_dump.geom::GEOGRAPHY);
          IF v_part_area < v_min_territory THEN
            CONTINUE;
          END IF;
          IF v_first_part THEN
            UPDATE territories
            SET geometry = v_dump.geom, area_sqm = v_part_area
            WHERE id = v_victim.id;
            v_first_part := FALSE;
          ELSE
            INSERT INTO territories (owner_id, session_id, geometry, area_sqm, room_id)
            VALUES (v_victim.owner_id, v_victim.session_id, v_dump.geom, v_part_area, p_room_id);
          END IF;
        END LOOP;
        IF v_first_part THEN
          DELETE FROM territories WHERE id = v_victim.id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Resync scores for all affected users
  PERFORM sync_room_member_scores(p_room_id, v_affected_users);

  SELECT score INTO v_user_score
  FROM room_members
  WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'alreadySaved', false,
    'sessionId', v_session_id,
    'territory', jsonb_build_object('id', v_territory_id, 'area_sqm', v_territory_area),
    'captures', v_captures,
    'pointsEarned', ROUND(v_territory_area)::INTEGER,
    'scoreDelta', COALESCE(v_user_score, 0)
  );
END;
$$;

-- ============================================================
-- 7. Updated room_territories_view
-- ============================================================

CREATE OR REPLACE VIEW room_territories_view AS
SELECT
  t.id,
  t.owner_id,
  t.room_id,
  t.area_sqm,
  t.capture_count,
  t.created_at,
  ST_AsGeoJSON(t.geometry)::jsonb AS geometry
FROM territories t
WHERE t.room_id IS NOT NULL;