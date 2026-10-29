-- Migration 002: Add course ratings and reviews
ALTER TABLE courses ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 4.8;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ratings_count INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS course_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating NUMERIC(3,2) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_courses_rating ON courses (rating);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses (category);
CREATE INDEX IF NOT EXISTS idx_courses_difficulty ON courses (difficulty);
