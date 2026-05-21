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
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;



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
