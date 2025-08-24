-- Fix user_settings table to ensure unique user_id
-- This prevents duplicate entries that might cause sync issues

-- Add unique constraint on user_id if it doesn't exist
ALTER TABLE public.user_settings 
ADD CONSTRAINT unique_user_settings_user_id UNIQUE (user_id);

-- Remove any duplicate entries (keep the most recent one)
WITH duplicates AS (
    SELECT id, user_id, 
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
    FROM public.user_settings
)
DELETE FROM public.user_settings 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);