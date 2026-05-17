-- db/schema.sql
-- Create the knowledge_entries table

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: In Neon PostgreSQL, you can run this script directly in the Neon SQL Editor.
