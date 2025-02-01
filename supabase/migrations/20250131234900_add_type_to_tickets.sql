-- Add type column to tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS type text;

-- Update existing tickets to have a default type
UPDATE tickets 
SET type = 'general' 
WHERE type IS NULL; 