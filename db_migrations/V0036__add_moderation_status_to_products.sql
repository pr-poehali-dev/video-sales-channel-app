ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_comment TEXT DEFAULT '';

-- Все существующие товары автоматически одобрены
UPDATE products SET moderation_status = 'approved' WHERE moderation_status = 'approved';