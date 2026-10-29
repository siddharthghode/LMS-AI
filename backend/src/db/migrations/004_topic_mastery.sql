-- Migration 004: Topic Mastery tracking (FR-A8)
CREATE TABLE IF NOT EXISTS user_topic_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    mastery_score NUMERIC(5,2) DEFAULT 0, -- 0 to 100%
    quizzes_evaluated INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_topic_mastery ON user_topic_mastery(user_id, topic);
