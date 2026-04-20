CREATE TABLE IF NOT EXISTS "t_p63706319_video_sales_channel_".transactions (
  id                  text        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id            text        NOT NULL,
  seller_id           text        NOT NULL DEFAULT '',
  merchant_id         text        NOT NULL DEFAULT '',
  full_amount         numeric     NOT NULL DEFAULT 0,
  seller_amount       numeric     NOT NULL DEFAULT 0,
  marketplace_fee     numeric     NOT NULL DEFAULT 0,
  hold_date           timestamptz NULL,
  status              text        NOT NULL DEFAULT 'hold'
                        CHECK (status IN ('hold','paid','cancelled','refund','error')),
  payment_id          text        NOT NULL DEFAULT '',
  delivery_confirm    text        NOT NULL DEFAULT '',
  error_message       text        NOT NULL DEFAULT '',
  paid_at             timestamptz NULL,
  cancelled_at        timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id   ON "t_p63706319_video_sales_channel_".transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id  ON "t_p63706319_video_sales_channel_".transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status     ON "t_p63706319_video_sales_channel_".transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON "t_p63706319_video_sales_channel_".transactions(created_at);
