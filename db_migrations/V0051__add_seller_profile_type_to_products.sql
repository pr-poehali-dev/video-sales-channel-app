ALTER TABLE "t_p63706319_video_sales_channel_".products
ADD COLUMN IF NOT EXISTS seller_profile_type VARCHAR(20) NOT NULL DEFAULT 'individual';

UPDATE "t_p63706319_video_sales_channel_".products p
SET seller_profile_type = s.profile_type
FROM "t_p63706319_video_sales_channel_".sellers s
WHERE s.user_id = p.seller_id;