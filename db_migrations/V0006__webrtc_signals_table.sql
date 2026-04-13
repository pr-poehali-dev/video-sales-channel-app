CREATE TABLE IF NOT EXISTS webrtc_signals (
    id TEXT PRIMARY KEY,
    stream_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'offer','answer','ice-broadcaster','ice-viewer'
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signals_stream ON webrtc_signals(stream_id);
CREATE INDEX IF NOT EXISTS idx_signals_viewer ON webrtc_signals(stream_id, viewer_id);
