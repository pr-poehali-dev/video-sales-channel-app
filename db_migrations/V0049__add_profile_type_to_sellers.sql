-- Меняем PRIMARY KEY sellers с user_id на (user_id, profile_type)
-- profile_type: 'individual' (физлицо) | 'legal' (юрлицо: самозанятый/ИП/ООО)

ALTER TABLE t_p63706319_video_sales_channel_.sellers
  ADD COLUMN IF NOT EXISTS profile_type VARCHAR(20) NOT NULL DEFAULT 'individual';

-- Обновляем существующие записи: individual -> individual, остальные -> legal
UPDATE t_p63706319_video_sales_channel_.sellers
  SET profile_type = CASE
    WHEN legal_type = 'individual' THEN 'individual'
    ELSE 'legal'
  END;

-- Создаём новый уникальный индекс на (user_id, profile_type)
ALTER TABLE t_p63706319_video_sales_channel_.sellers DROP CONSTRAINT IF EXISTS sellers_pkey;
ALTER TABLE t_p63706319_video_sales_channel_.sellers ADD PRIMARY KEY (user_id, profile_type);
