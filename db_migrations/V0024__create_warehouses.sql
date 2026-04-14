CREATE TABLE IF NOT EXISTS warehouses (
  id          TEXT PRIMARY KEY,
  seller_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  city_code   INT NOT NULL,
  city_name   TEXT NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS warehouses_seller_id_idx ON warehouses(seller_id);
