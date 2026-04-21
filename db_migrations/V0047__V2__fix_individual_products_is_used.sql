UPDATE t_p63706319_video_sales_channel_.products p
SET is_used = true
FROM t_p63706319_video_sales_channel_.sellers s
WHERE p.seller_id = s.user_id
  AND s.legal_type = 'individual'
  AND p.is_used = false;