ALTER TABLE "t_p63706319_video_sales_channel_".sellers
  ADD COLUMN IF NOT EXISTS ogrn text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS legal_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS corr_account text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_for_tax text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_method text NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS card_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS passport_series text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS passport_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_category text NOT NULL DEFAULT '';
