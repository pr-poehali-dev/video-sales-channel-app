CREATE TABLE IF NOT EXISTS stream_frames (
    stream_id TEXT PRIMARY KEY,
    frame_data TEXT NOT NULL,
    seq INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
