
DROP TABLE IF EXISTS public.signup_sessions;


CREATE TABLE public.signup_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  username text NOT NULL,
  otp_verified boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);


CREATE INDEX idx_signup_sessions_email ON public.signup_sessions(email);

