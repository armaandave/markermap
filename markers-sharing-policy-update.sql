-- Update markers RLS policy to allow viewing markers in shared folders
-- Run this in your Supabase SQL Editor

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own markers" ON markers;

-- Create a new policy that allows users to view their own markers OR markers in folders shared with them
-- Since we're using Google OAuth, authentication is handled in the app
CREATE POLICY "Users can view their own markers or shared markers" ON markers
  FOR SELECT USING (
    user_id IN (
      SELECT user_id FROM auth.users WHERE auth.uid()::text = user_id
    ) OR
    EXISTS (
      SELECT 1 FROM folder_shares
      INNER JOIN folders ON folders.id = folder_shares.folder_id
      WHERE folder_shares.shared_with_id IN (
        SELECT user_id FROM auth.users WHERE auth.uid()::text = user_id
      )
      AND markers.folder_id = folders.id
    )
  );

-- Note: Since Google OAuth is used instead of Supabase Auth, these policies will allow all reads
-- The app will handle proper authorization when querying markers

