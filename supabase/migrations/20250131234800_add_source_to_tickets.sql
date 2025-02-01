-- Add source column to tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS source text;

-- Update existing tickets to have a default source
UPDATE tickets 
SET source = 'web' 
WHERE source IS NULL; 