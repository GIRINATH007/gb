CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    otp_type TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_email_type 
ON otp_codes(email, otp_type);

CREATE INDEX IF NOT EXISTS idx_otp_expires_at 
ON otp_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_otp_email_type_verified 
ON otp_codes(email, otp_type, verified);