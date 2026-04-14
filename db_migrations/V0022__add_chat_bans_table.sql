CREATE TABLE t_p63706319_video_sales_channel_.chat_bans (
  id          TEXT PRIMARY KEY,
  stream_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  banned_by   TEXT NOT NULL,
  reason      TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stream_id, user_id)
);