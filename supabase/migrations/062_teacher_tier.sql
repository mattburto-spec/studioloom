-- Migration 062: Add tier to teacher_profiles
-- Part of Dimensions3 Phase A — makes all new routes tier-aware from day one.
-- During beta, checkTierAccess() returns allowed:true for everyone.

ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';

-- Index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_tier ON teacher_profiles(tier);

COMMENT ON COLUMN teacher_profiles.tier IS 'Subscription tier: free | pro | school. During beta all teachers get full access.';
