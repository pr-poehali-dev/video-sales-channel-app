-- Добавляем поля для трек-номера и дополнительных данных СДЭК в таблицу orders
ALTER TABLE t_p63706319_video_sales_channel_.orders
  ADD COLUMN IF NOT EXISTS cdek_track_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cdek_pvz_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS declared_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS try_on_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nalog_enabled boolean NOT NULL DEFAULT false;
