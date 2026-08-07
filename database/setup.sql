-- Daily Story database setup
-- Run against a PostgreSQL database, e.g.:
--   psql "$DATABASE_URL" -f database/setup.sql

CREATE TABLE IF NOT EXISTS users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           TEXT        NOT NULL UNIQUE,
    hashed_password TEXT        NOT NULL,
    name            TEXT,
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

-- Questions asked of users purely for analytics, sentiment, and feedback
-- purposes (currently surfaced during onboarding) — not tied to any specific
-- app feature. The code in src/survey/ is the source of truth;
-- src/survey/sync.ts keeps these rows in step with it (insert new, update
-- changed, leave the rest alone) on every app startup.
CREATE TABLE IF NOT EXISTS survey_questions (
    key         TEXT        PRIMARY KEY,
    question    TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS survey_questions_set_updated_at ON survey_questions;
CREATE TRIGGER survey_questions_set_updated_at
    BEFORE UPDATE ON survey_questions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- The options offered for each survey question (SurveyQuestionOption in code).
CREATE TABLE IF NOT EXISTS survey_question_options (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_key TEXT        NOT NULL REFERENCES survey_questions(key) ON DELETE CASCADE,
    option_key   TEXT        NOT NULL,
    label        TEXT        NOT NULL,
    description  TEXT,
    value        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_key, option_key)
);

DROP TRIGGER IF EXISTS survey_question_options_set_updated_at ON survey_question_options;
CREATE TRIGGER survey_question_options_set_updated_at
    BEFORE UPDATE ON survey_question_options
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Free-form user sentiment, feedback, and preferences that aren't used by the
-- app's functionality (e.g. "why are you learning this language?"). Rows are
-- append-only: answering the same question again inserts a new row rather
-- than overwriting the previous answer, so history is preserved.
CREATE TABLE IF NOT EXISTS user_responses (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_key     TEXT        NOT NULL REFERENCES survey_questions(key),
    answer           JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports "latest answer to question X for user Y" and "latest answer to
-- every question for user Y" lookups.
CREATE INDEX IF NOT EXISTS user_responses_user_question_idx
    ON user_responses (user_id, question_key, created_at DESC);

-- Usage metrics: one row per user per day per (language, level) they read a
-- story and answered quiz questions for. Unlike user_responses, this is NOT
-- append-only — re-attempting the same day's quiz (e.g. after reloading the
-- page) overwrites the counts in place, so the row always reflects only the
-- latest attempt.
CREATE TABLE IF NOT EXISTS user_story_activity (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_date      DATE        NOT NULL,
    language        TEXT        NOT NULL,
    level           TEXT        NOT NULL,
    correct_count   INTEGER     NOT NULL DEFAULT 0,
    incorrect_count INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, story_date, language, level)
);

DROP TRIGGER IF EXISTS user_story_activity_set_updated_at ON user_story_activity;
CREATE TRIGGER user_story_activity_set_updated_at
    BEFORE UPDATE ON user_story_activity
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Supports "this user's activity history, most recent day first" lookups.
CREATE INDEX IF NOT EXISTS user_story_activity_user_date_idx
    ON user_story_activity (user_id, story_date DESC);
