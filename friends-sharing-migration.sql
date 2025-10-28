-- Friends and Folder Sharing Migration
-- Run this in your Supabase SQL Editor
-- This migration works with Google OAuth authentication

-- IMPORTANT: After running this migration, you need to call the /api/users/backfill endpoint
-- to populate the users table with existing accounts

-- Create users table for extended user metadata
-- Note: We use TEXT for user_id instead of UUID to match Google OAuth IDs
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  email TEXT NOT NULL,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create friendships table
-- Note: We don't use foreign keys because user_id uses TEXT (Google OAuth IDs)
-- The app handles referential integrity through application logic
CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Create folder_shares table
-- Note: We don't use foreign keys because user_id uses TEXT (Google OAuth IDs)
CREATE TABLE IF NOT EXISTS folder_shares (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  folder_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  shared_with_id TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(folder_id, shared_with_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_folder_shares_folder_id ON folder_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_shares_owner_id ON folder_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_folder_shares_shared_with ON folder_shares(shared_with_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_shares ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Note: Since we're using Google OAuth, authentication is handled in the app
CREATE POLICY "Enable all operations for users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- Friendships table policies
-- Note: Authentication and authorization handled in API routes
CREATE POLICY "Enable all operations for friendships" ON friendships
  FOR ALL USING (true) WITH CHECK (true);

-- Folder shares table policies
-- Note: Authentication and authorization handled in API routes
CREATE POLICY "Enable all operations for folder_shares" ON folder_shares
  FOR ALL USING (true) WITH CHECK (true);

-- Update folders table to support sharing
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS owner_id TEXT;

-- Note: Folders table already has RLS policies from the original migration
-- The app will handle filtering folders to show user's own + shared folders

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for new tables
-- Drop existing triggers first to avoid errors if re-running migration
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_folder_shares_updated_at ON folder_shares;
CREATE TRIGGER update_folder_shares_updated_at BEFORE UPDATE ON folder_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

