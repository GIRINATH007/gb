
ALTER TABLE public.user_stats
ADD COLUMN coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0);


CREATE INDEX idx_user_stats_coins ON public.user_stats (coins DESC);
