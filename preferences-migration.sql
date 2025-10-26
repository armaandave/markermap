-- Add preferences table for user favorite colors
CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE,
  favorite_colors TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(user_id);

-- Enable Row Level Security
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access their own preferences
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'preferences' AND policyname = 'Users can view their own preferences') THEN
    CREATE POLICY "Users can view their own preferences" ON preferences
      FOR SELECT USING (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'preferences' AND policyname = 'Users can insert their own preferences') THEN
    CREATE POLICY "Users can insert their own preferences" ON preferences
      FOR INSERT WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'preferences' AND policyname = 'Users can update their own preferences') THEN
    CREATE POLICY "Users can update their own preferences" ON preferences
      FOR UPDATE USING (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'preferences' AND policyname = 'Users can delete their own preferences') THEN
    CREATE POLICY "Users can delete their own preferences" ON preferences
      FOR DELETE USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- Create trigger to automatically update updated_at (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_preferences_updated_at') THEN
    CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


