CREATE TABLE public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  missions_completed INTEGER NOT NULL DEFAULT 0 CHECK (missions_completed >= 0),
  distance_travelled NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (distance_travelled >= 0),
  energy INTEGER NOT NULL DEFAULT 100 CHECK (energy >= 0),
  loop_points INTEGER NOT NULL DEFAULT 0 CHECK (loop_points >= 0),
  global_rank INTEGER CHECK (global_rank IS NULL OR global_rank > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
