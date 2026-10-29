-- Migration 003: Add pricing_tier column to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(50) DEFAULT 'free';
CREATE INDEX IF NOT EXISTS idx_courses_pricing_tier ON courses (pricing_tier);
