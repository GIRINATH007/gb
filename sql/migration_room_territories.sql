-- backend/sql/migration_room_territories.sql
-- Run this ONCE in Supabase SQL Editor AFTER territory_tables.sql

-- Step 1: Add room_id to territories table (nullable for backward compat)
ALTER TABLE territories ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_territories_room ON territories (room_id);

-- Step 2: Update find_overlapping_territories to scope by room
CREATE OR REPLACE FUNCTION find_overlapping_territories(
  p_geometry public.geometry,
  p_owner_id UUID,
  p_room_id UUID DEFAULT NULL
) RETURNS TABLE (
  territory_id UUID,
  owner_id UUID,
  overlap_sqm FLOAT,
  overlap_percent FLOAT
) LANGUAGE plpgsql AS $$
DECLARE
  v_new_area FLOAT;
BEGIN
  v_new_area := ST_Area(p_geometry::GEOGRAPHY);

  RETURN QUERY
  SELECT
    t.id,
    t.owner_id,
    ROUND(ST_Area(ST_Intersection(t.geometry, p_geometry)::GEOGRAPHY)::NUMERIC, 2)::FLOAT AS overlap_sqm,
    ROUND(
      (ST_Area(ST_Intersection(t.geometry, p_geometry)::GEOGRAPHY) / v_new_area * 100)::NUMERIC,
      2
    )::FLOAT AS overlap_percent
  FROM territories t
  WHERE
    t.owner_id != p_owner_id
    AND (p_room_id IS NULL OR t.room_id = p_room_id)
    AND ST_Intersects(t.geometry, p_geometry)
  ORDER BY overlap_percent DESC;
END;
$$;

-- Step 3: Update create_territory_from_path to accept room_id
CREATE OR REPLACE FUNCTION create_territory_from_path(
  p_user_id UUID,
  p_session_id UUID,
  p_points JSONB,
  p_buffer_metres FLOAT DEFAULT 20,
  p_room_id UUID DEFAULT NULL
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
  RETURNING id, area_sqm INTO v_territory_id, area_sqm;

  territory_id := v_territory_id;
  area_sqm := v_area_sqm;
  RETURN NEXT;
END;
$$;

-- Step 4: Create room_territories view for map overlay
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

-- Step 5: Create function to get room territory stats per user
CREATE OR REPLACE FUNCTION get_room_territory_stats(
  p_room_id UUID,
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  user_id UUID,
  territory_count BIGINT,
  total_area_sqm FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.owner_id,
    COUNT(t.id)::BIGINT AS territory_count,
    COALESCE(SUM(t.area_sqm), 0)::FLOAT AS total_area_sqm
  FROM territories t
  WHERE t.room_id = p_room_id
    AND (p_user_id IS NULL OR t.owner_id = p_user_id)
  GROUP BY t.owner_id
  ORDER BY total_area_sqm DESC;
END;
$$;
