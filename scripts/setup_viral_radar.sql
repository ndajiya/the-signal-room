-- Viral Candidates Table
CREATE TABLE viral_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_platform TEXT DEFAULT 'instagram',
    source_url TEXT NOT NULL,
    submitted_by_whatsapp TEXT NOT NULL,
    owner_note TEXT,
    creator_username TEXT,
    caption TEXT,
    thumbnail_url TEXT,
    content_type TEXT,
    visible_likes INTEGER,
    visible_comments INTEGER,
    visible_views INTEGER,
    posted_at TIMESTAMP WITH TIME ZONE,
    raw_metadata JSONB,
    viral_score INTEGER,
    linkedin_transfer_score INTEGER,
    brand_relevance_score INTEGER,
    hook_score INTEGER,
    comment_potential_score INTEGER,
    format_repeatability_score INTEGER,
    topic_heat_score INTEGER,
    status TEXT DEFAULT 'received',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LinkedIn Drafts Table
CREATE TABLE linkedin_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES viral_candidates(id),
    draft_title TEXT,
    linkedin_post TEXT,
    angle TEXT,
    tone TEXT,
    target_audience TEXT,
    content_pillars TEXT[],
    status TEXT DEFAULT 'draft',
    approved_by_owner BOOLEAN DEFAULT FALSE,
    linkedin_post_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings Table (if not exists)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access to anon role (dashboard uses anon key)
-- In a production environment with sensitive data, you should restrict this further
-- or use service_role key for backend operations.
CREATE POLICY "Allow anon all access to settings" ON settings
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Approved Owners Table
CREATE TABLE approved_owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
