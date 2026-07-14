CREATE TABLE public.visited_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT visited_cities_city_country_not_empty CHECK (
    length(trim(city)) > 0
    AND length(trim(country)) > 0
  ),
  CONSTRAINT visited_cities_user_city_country_unique UNIQUE (user_id, city, country)
);

CREATE INDEX idx_visited_cities_user_id ON public.visited_cities (user_id);

CREATE INDEX idx_visited_cities_user_id_visited_at ON public.visited_cities (user_id, visited_at DESC);
