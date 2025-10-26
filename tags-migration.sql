-- Add tags column to markers table
ALTER TABLE markers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create an index for better performance when querying by tags
CREATE INDEX IF NOT EXISTS idx_markers_tags ON markers USING GIN (tags);

-- Create a function to help with tag queries
CREATE OR REPLACE FUNCTION array_contains_tag(tags_array TEXT[], tag_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN tag_value = ANY(tags_array);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add a comment to the tags column
COMMENT ON COLUMN markers.tags IS 'Array of tags for organizing and categorizing markers';

