-- Add default_map_style column to existing preferences table (if not exists)
ALTER TABLE preferences 
ADD COLUMN IF NOT EXISTS default_map_style TEXT DEFAULT 'mapbox://styles/mapbox/dark-v11';

-- Update any existing rows that might have NULL values
UPDATE preferences 
SET default_map_style = 'mapbox://styles/mapbox/dark-v11'
WHERE default_map_style IS NULL;

