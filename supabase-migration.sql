-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#ffffff',
  icon TEXT NOT NULL DEFAULT 'folder',
  visible BOOLEAN NOT NULL DEFAULT true,
  parent_id TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create markers table
CREATE TABLE IF NOT EXISTS markers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  color TEXT NOT NULL DEFAULT '#ffffff',
  address TEXT,
  images TEXT[],
  custom_fields JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create preferences table
CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE,
  favorite_colors TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_markers_user_id ON markers(user_id);
CREATE INDEX IF NOT EXISTS idx_markers_folder_id ON markers(folder_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access their own data
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own markers" ON markers
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own markers" ON markers
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own markers" ON markers
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own markers" ON markers
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own preferences" ON preferences
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own preferences" ON preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own preferences" ON preferences
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own preferences" ON preferences
  FOR DELETE USING (auth.uid()::text = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markers_updated_at BEFORE UPDATE ON markers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


