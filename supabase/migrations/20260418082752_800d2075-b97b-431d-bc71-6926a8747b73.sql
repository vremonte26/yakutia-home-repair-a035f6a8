-- 1. Add moderator role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'moderator';
