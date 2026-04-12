
CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  price         NUMERIC NOT NULL,
  category      TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  images        TEXT[] NOT NULL DEFAULT '{}',
  seller_id     TEXT NOT NULL,
  seller_name   TEXT NOT NULL,
  seller_avatar TEXT NOT NULL DEFAULT '',
  in_stock      INT NOT NULL DEFAULT 99,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS streams (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  seller_id     TEXT NOT NULL,
  seller_name   TEXT NOT NULL,
  seller_avatar TEXT NOT NULL DEFAULT '',
  is_live       BOOLEAN NOT NULL DEFAULT FALSE,
  viewers       INT NOT NULL DEFAULT 0,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  duration_sec  INT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  stream_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  user_avatar TEXT NOT NULL DEFAULT '',
  text        TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  user_avatar TEXT NOT NULL DEFAULT '',
  rating      INT NOT NULL,
  text        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_streams_seller  ON streams(seller_id);
CREATE INDEX IF NOT EXISTS idx_streams_live    ON streams(is_live);
CREATE INDEX IF NOT EXISTS idx_chat_stream     ON chat_messages(stream_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
