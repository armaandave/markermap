-- Add default folder preference to user preferences
ALTER TABLE preferences
ADD COLUMN IF NOT EXISTS default_folder_id TEXT;

