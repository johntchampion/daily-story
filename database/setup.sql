-- Daily Story database setup
-- Run against a PostgreSQL database, e.g.:
--   psql "$DATABASE_URL" -f database/setup.sql

CREATE TABLE IF NOT EXISTS users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           TEXT        NOT NULL UNIQUE,
    hashed_password TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_logged_in  TIMESTAMPTZ,
    preferred_language TEXT,
    preferred_level    TEXT
);

-- Case-insensitive lookups by email (login).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

-- Keep updated_at current on every row update.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Free-form user sentiment, feedback, and preferences that aren't used by the
-- app's functionality (e.g. "why are you learning this language?"). Rows are
-- append-only: answering the same question again inserts a new row rather
-- than overwriting the previous answer, so history is preserved.
CREATE TABLE IF NOT EXISTS user_responses (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_key     TEXT        NOT NULL,
    question         TEXT        NOT NULL,
    possible_answers JSONB,
    answer           JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports "latest answer to question X for user Y" and "latest answer to
-- every question for user Y" lookups.
CREATE INDEX IF NOT EXISTS user_responses_user_question_idx
    ON user_responses (user_id, question_key, created_at DESC);
