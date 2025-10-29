-- Add share_tags column to folder_shares table
-- Run this in your Supabase SQL Editor

ALTER TABLE folder_shares ADD COLUMN IF NOT EXISTS share_tags BOOLEAN DEFAULT true;

-- This column determines whether markers shared with this user should include their tags
-- true = share markers with their tags (tags will appear in shared user's tag list)
-- false = share markers without tags

