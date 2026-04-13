ALTER TABLE "t_p63706319_video_sales_channel_"."streams" ADD COLUMN IF NOT EXISTS thumbnail text NULL;
ALTER TABLE "t_p63706319_video_sales_channel_"."streams" ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
UPDATE "t_p63706319_video_sales_channel_"."streams" SET hidden = true WHERE started_at < now() - interval '1 hour';