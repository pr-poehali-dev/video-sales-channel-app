ALTER TABLE "t_p63706319_video_sales_channel_".orders
  ADD COLUMN IF NOT EXISTS seller_legal_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seller_requisites jsonb NOT NULL DEFAULT '{}'::jsonb;