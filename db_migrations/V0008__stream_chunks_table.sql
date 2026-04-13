CREATE TABLE IF NOT EXISTS stream_chunks (
    id SERIAL PRIMARY KEY,
    stream_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_stream_seq ON stream_chunks(stream_id, seq);
