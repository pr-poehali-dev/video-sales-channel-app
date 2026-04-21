UPDATE t_p63706319_video_sales_channel_.products p
SET seller_name = s.legal_name
FROM t_p63706319_video_sales_channel_.sellers s
WHERE p.seller_id = s.user_id
  AND p.seller_name != s.legal_name;