-- Apply manually via the Supabase SQL editor.
-- Creates the tracking_sessions table and the add_tracking_stats helper function.
--
-- local_session_id is UNIQUE so that "Try Again" retries on the client never
-- insert duplicate rows or double-credit stats. The service layer detects the
-- unique-violation (Postgres code 23505) and returns the existing row instead.

CREATE TABLE public.tracking_sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  local_session_id TEXT         UNIQUE,
  distance_metres  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (distance_metres >= 0),
  duration_seconds INTEGER      NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  points           JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Atomically credits distance, loop points, energy, and elevation to user stats.
-- Call via supabase.rpc('add_tracking_stats', { p_user_id, p_distance, p_loop_points, p_elevation_gain }).
-- p_elevation_gain defaults to 0 for backwards compatibility with existing callers.
CREATE OR REPLACE FUNCTION public.add_tracking_stats(
  p_user_id        UUID,
  p_distance       NUMERIC,
  p_loop_points    INT,
  p_elevation_gain NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.user_stats
  SET
    distance_travelled = distance_travelled + p_distance,
    loop_points        = loop_points + p_loop_points,
    energy             = energy + FLOOR(p_distance / 100),
    updated_at         = NOW()
  WHERE user_id = p_user_id;
END;
$$;
