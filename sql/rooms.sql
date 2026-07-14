CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^\d{6}$'),
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 20 CHECK (max_members > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);


CREATE VIEW public.room_leaderboard AS
SELECT
  rm.room_id,
  rm.user_id,
  p.username,
  rm.score,
  RANK() OVER (PARTITION BY rm.room_id ORDER BY rm.score DESC) as rank,
  rm.joined_at
FROM public.room_members rm
JOIN public.profiles p ON rm.user_id = p.id
ORDER BY rm.room_id, rm.score DESC;


CREATE INDEX idx_rooms_creator ON public.rooms (creator_id);
CREATE INDEX idx_rooms_code ON public.rooms (code);
CREATE INDEX idx_room_members_room ON public.room_members (room_id);
CREATE INDEX idx_room_members_user ON public.room_members (user_id);
CREATE INDEX idx_room_members_score ON public.room_members (room_id, score DESC);

CREATE SEQUENCE room_code_sequence START WITH 100000 MAXVALUE 999999;
