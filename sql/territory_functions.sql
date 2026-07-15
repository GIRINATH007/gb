-- backend/sql/territory_functions.sql
-- Run this ONCE in Supabase SQL Editor

-- ============================================================
-- FUNCTION 1: Create a territory from a GPS path
-- ============================================================
-- Takes an array of GPS points, converts them to a line,
-- then buffers that line into a polygon (20m wide by default).
-- The buffer width = how far from the path the territory extends.

CREATE OR REPLACE FUNCTION create_territory_from_path(
  p_user_id UUID,
  p_session_id UUID,
  p_points JSONB,              -- [{"lat": 48.85, "lng": 2.35}, ...]
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
  -- Step 1: Convert JSON lat/lng array into a PostGIS LineString
  -- ST_SetSRID tells PostGIS these are GPS coordinates (4326)
  SELECT ST_SetSRID(ST_MakeLine(
    ARRAY(
      SELECT ST_MakePoint(
        (point->>'lng')::FLOAT,   -- ST_MakePoint takes (longitude, latitude)
        (point->>'lat')::FLOAT
      )
      FROM jsonb_array_elements(p_points) AS point
    )
  ), 4326) INTO v_line;

  -- Step 2: Buffer the line into a polygon
  -- ST_Transform(4326) → (UTM) converts to metres for accurate buffer
  -- ST_Transform back to 4326 after buffering
  -- Buffer = 20m radius around the path by default
  v_polygon := ST_Transform(
    ST_Buffer(
      ST_Transform(v_line, 3857),    -- 3857 = Web Mercator (in metres)
      p_buffer_metres
    ),
    4326
  );

  -- Step 3: Insert the territory
  INSERT INTO territories (owner_id, session_id, geometry, area_sqm)
  VALUES (
    p_user_id,
    p_session_id,
    v_polygon,
    ST_Area(v_polygon::GEOGRAPHY)    -- ::GEOGRAPHY gives area in sq metres
  )
  RETURNING territories.id, territories.area_sqm INTO v_territory_id, v_area_sqm;

  -- Return the result
  territory_id := v_territory_id;
  area_sqm := v_area_sqm;
  RETURN NEXT;
END;
$$;

-- ============================================================
-- FUNCTION 2: Find overlapping territories
-- ============================================================
-- Given a new territory geometry, find all existing territories
-- (by other users) that it overlaps with.

CREATE OR REPLACE FUNCTION find_overlapping_territories(
  p_geometry public.geometry,
  p_owner_id UUID                -- exclude own territories
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
    ROUND(ST_Area(ST_Intersection(t.geometry, p_geometry)::GEOGRAPHY)::NUMERIC, 2) AS overlap_sqm,
    ROUND(
      (ST_Area(ST_Intersection(t.geometry, p_geometry)::GEOGRAPHY) / v_new_area * 100)::NUMERIC,
      2
    ) AS overlap_percent
  FROM territories t
  WHERE
    t.owner_id != p_owner_id          -- skip own territories
    AND ST_Intersects(t.geometry, p_geometry)  -- PostGIS spatial index check
  ORDER BY overlap_percent DESC;
END;
$$;

-- ============================================================
-- FUNCTION 3: Transfer territory ownership atomically
-- ============================================================
-- Updates owner + logs the change in one transaction.
-- This prevents race conditions when two players capture
-- the same territory simultaneously.

CREATE OR REPLACE FUNCTION capture_territory(
  p_territory_id UUID,
  p_new_owner_id UUID,
  p_session_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_old_owner_id UUID;
BEGIN
  -- Lock the row so no concurrent transaction can capture it
  SELECT owner_id INTO v_old_owner_id
  FROM territories
  WHERE id = p_territory_id
  FOR UPDATE;                        -- row-level lock

  -- Log the ownership change
  INSERT INTO territory_ownership_log (
    territory_id, prev_owner_id, new_owner_id, session_id
  ) VALUES (
    p_territory_id, v_old_owner_id, p_new_owner_id, p_session_id
  );

  -- Update ownership
  UPDATE territories
  SET
    owner_id = p_new_owner_id,
    capture_count = capture_count + 1
  WHERE id = p_territory_id;

  RETURN TRUE;
END;
$$;