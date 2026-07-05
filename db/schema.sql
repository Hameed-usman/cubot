-- =============================================================
-- Cubot — Autonomous University Knowledge Intelligence System
-- Production-Grade Database Schema
-- Run via: npm run setup-db
-- =============================================================

-- ─── Core Knowledge Entries Table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id              UUID PRIMARY KEY,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'general'
);

-- Ensure all new columns exist if table was already created
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS source_url      TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS source_type     TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS page_type       TEXT NOT NULL DEFAULT 'general';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS breadcrumb      TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS content_hash    TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS chunk_index     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS total_chunks    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS parent_page_id  UUID;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS search_vector   tsvector;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS last_scraped_at       TIMESTAMP WITH TIME ZONE;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
-- Persistent Pinecone mapping — critical for sync, audit, orphan detection, and re-embedding
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS pinecone_vector_id    TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS pinecone_namespace     TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS embedding_model        TEXT DEFAULT 'gemini-embedding-001';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS pinecone_synced_at     TIMESTAMP WITH TIME ZONE;



-- ─── Full-Text Search Index ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_knowledge_fts
    ON knowledge_entries USING gin(search_vector);

-- ─── Supporting Indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_knowledge_category
    ON knowledge_entries(category);

CREATE INDEX IF NOT EXISTS idx_knowledge_page_type
    ON knowledge_entries(page_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_source_url
    ON knowledge_entries(source_url);

CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash
    ON knowledge_entries(content_hash);

CREATE INDEX IF NOT EXISTS idx_knowledge_parent_page_id
    ON knowledge_entries(parent_page_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_source_type
    ON knowledge_entries(source_type);

-- ─── Auto-Update Trigger for search_vector ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.page_type, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_search_vector ON knowledge_entries;
CREATE TRIGGER trg_knowledge_search_vector
    BEFORE INSERT OR UPDATE ON knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_search_vector();

-- ─── Auto-Update Trigger for updated_at ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_updated_at ON knowledge_entries;
CREATE TRIGGER trg_knowledge_updated_at
    BEFORE UPDATE ON knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Crawl Statistics Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crawl_stats (
    id                  SERIAL PRIMARY KEY,
    run_id              UUID NOT NULL,
    pages_crawled       INTEGER NOT NULL DEFAULT 0,
    pages_failed        INTEGER NOT NULL DEFAULT 0,
    pages_updated       INTEGER NOT NULL DEFAULT 0,
    pages_skipped       INTEGER NOT NULL DEFAULT 0,
    documents_processed INTEGER NOT NULL DEFAULT 0,
    chunks_created      INTEGER NOT NULL DEFAULT 0,
    embeddings_created  INTEGER NOT NULL DEFAULT 0,
    duration_seconds    INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'failed'
    error_log           TEXT,
    started_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_crawl_stats_run_id
    ON crawl_stats(run_id);

CREATE INDEX IF NOT EXISTS idx_crawl_stats_started_at
    ON crawl_stats(started_at DESC);

-- ─── Failed Pages Log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crawl_failed_pages (
    id          SERIAL PRIMARY KEY,
    run_id      UUID NOT NULL,
    url         TEXT NOT NULL,
    error       TEXT,
    status_code INTEGER,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_failed_pages_run_id
    ON crawl_failed_pages(run_id);

-- ─── Production RAG Observability & Queue Tables ──────────────────────────────

CREATE TABLE IF NOT EXISTS crawl_queue (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url         TEXT NOT NULL,
    depth       INTEGER NOT NULL DEFAULT 0,
    priority    INTEGER NOT NULL DEFAULT 10,
    status      TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error       TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_status_priority ON crawl_queue(status, priority);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_queue_url_unique ON crawl_queue(url);

CREATE TABLE IF NOT EXISTS crawl_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status              TEXT NOT NULL DEFAULT 'running',  -- 'running', 'paused', 'completed', 'failed'
    pages_crawled       INTEGER NOT NULL DEFAULT 0,
    pages_failed        INTEGER NOT NULL DEFAULT 0,
    pages_updated       INTEGER NOT NULL DEFAULT 0,
    pages_skipped       INTEGER NOT NULL DEFAULT 0,
    documents_processed INTEGER NOT NULL DEFAULT 0,
    chunks_created      INTEGER NOT NULL DEFAULT 0,
    embeddings_created  INTEGER NOT NULL DEFAULT 0,
    duration_seconds    INTEGER NOT NULL DEFAULT 0,
    error_log           TEXT,
    started_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS scraped_pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url             TEXT NOT NULL UNIQUE,
    title           TEXT,
    crawl_depth     INTEGER DEFAULT 0,
    parent_url      TEXT,
    content_hash    TEXT,
    chunk_count     INTEGER DEFAULT 0,
    pinecone_sync_status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'failed'
    crawl_status    TEXT DEFAULT 'success', -- 'success', 'failed', 'archived'
    last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scraped_pages_url ON scraped_pages(url);
CREATE INDEX IF NOT EXISTS idx_scraped_pages_status ON scraped_pages(crawl_status);

CREATE TABLE IF NOT EXISTS document_chunks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraped_page_id     UUID REFERENCES scraped_pages(id) ON DELETE CASCADE,
    chunk_index         INTEGER NOT NULL,
    text_content        TEXT NOT NULL,
    embedding_version   TEXT DEFAULT 'text-embedding-3-small',
    pinecone_id         TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_page ON document_chunks(scraped_page_id);

CREATE TABLE IF NOT EXISTS failed_urls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID,
    url             TEXT NOT NULL,
    error_category  TEXT NOT NULL, -- '404', 'timeout', 'robots', 'parser', 'duplicate', 'other'
    error_details   TEXT,
    status_code     INTEGER,
    attempted_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_failed_urls_category ON failed_urls(error_category);

CREATE TABLE IF NOT EXISTS retrieval_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query           TEXT NOT NULL,
    intent          TEXT,
    confidence      TEXT,
    response_length INTEGER,
    retrieval_ms    INTEGER,
    total_ms        INTEGER,
    cache_hit       BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS retrieved_chunks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retrieval_log_id    UUID REFERENCES retrieval_logs(id) ON DELETE CASCADE,
    pinecone_id         TEXT NOT NULL,
    similarity_score    FLOAT NOT NULL,
    source_url          TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retrieved_chunks_log ON retrieved_chunks(retrieval_log_id);

-- ─── Missing Required Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    persona VARCHAR(20),
    language VARCHAR(20),
    response_source VARCHAR(20),
    is_unanswered BOOLEAN DEFAULT false,
    feedback VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unanswered_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    question_text TEXT NOT NULL,
    language VARCHAR(20),
    persona VARCHAR(20),
    tier_reached VARCHAR(10),
    resolved BOOLEAN DEFAULT false,
    resolved_entry_id UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed admin_config
INSERT INTO admin_config (key, value) VALUES
('sync_schedule_hours', '12'),
('voice_enabled', 'true'),
('widget_enabled', 'true'),
('kiosk_active', 'true')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    request_count INT DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    session_id UUID NOT NULL,
    feedback VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
