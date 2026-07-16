CREATE TABLE public.route_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  local_session_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  distance_metres NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (distance_metres >= 0),
  -- === REMOVED (temporary): Splits/pace/elevation ===
  -- elevation_gain_metres NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (elevation_gain_metres >= 0),
  -- avg_pace_seconds_per_km INTEGER CHECK (avg_pace_seconds_per_km IS NULL OR avg_pace_seconds_per_km >= 0),
  -- splits JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_route_sessions_user ON public.route_sessions (user_id);
CREATE INDEX idx_route_sessions_local_id ON public.route_sessions (local_session_id);
