CREATE TABLE IF NOT EXISTS "t_p63706319_video_sales_channel_"."seller_reviews" (
  id text NOT NULL PRIMARY KEY,
  seller_id text NOT NULL,
  user_id text NOT NULL,
  user_name text NOT NULL,
  user_avatar text NOT NULL DEFAULT '',
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);