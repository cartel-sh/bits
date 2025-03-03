-- Add stats tracking columns to vanishing_channels if they don't exist
DO $$ 
BEGIN 
    -- Add messages_deleted column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'vanishing_channels' 
        AND column_name = 'messages_deleted'
    ) THEN
        ALTER TABLE vanishing_channels 
        ADD COLUMN messages_deleted BIGINT DEFAULT 0;
    END IF;

    -- Add last_deletion column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'vanishing_channels' 
        AND column_name = 'last_deletion'
    ) THEN
        ALTER TABLE vanishing_channels 
        ADD COLUMN last_deletion TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'vanishing_channels' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE vanishing_channels 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'vanishing_channels' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE vanishing_channels 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$; 