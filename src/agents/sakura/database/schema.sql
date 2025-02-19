-- Users and their identities
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_identities (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'discord', 'evm', 'lens'
    identity TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (platform, identity)
);

CREATE INDEX IF NOT EXISTS user_identities_user_id_idx ON user_identities(user_id);

-- Practice tracking
CREATE TABLE IF NOT EXISTS practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- duration in seconds
    date DATE NOT NULL,
    notes TEXT -- optional notes about the practice session
);

CREATE INDEX IF NOT EXISTS practice_sessions_user_date_idx ON practice_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS practice_sessions_active_idx ON practice_sessions(user_id) WHERE end_time IS NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create user by identity
CREATE OR REPLACE FUNCTION get_or_create_user_by_identity(
    p_platform TEXT,
    p_identity TEXT
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to find existing user
    SELECT user_id INTO v_user_id
    FROM user_identities
    WHERE platform = p_platform AND identity = p_identity;

    -- If not found, create new user and identity
    IF v_user_id IS NULL THEN
        INSERT INTO users DEFAULT VALUES
        RETURNING id INTO v_user_id;

        INSERT INTO user_identities (user_id, platform, identity)
        VALUES (v_user_id, p_platform, p_identity);
    END IF;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql; 