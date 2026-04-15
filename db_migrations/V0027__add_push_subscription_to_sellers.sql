-- Push-подписки продавцов для Web Push уведомлений
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS push_subscription jsonb;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

-- Индекс для быстрого поиска продавцов с подпиской
CREATE INDEX IF NOT EXISTS idx_sellers_push ON sellers(user_id) WHERE push_subscription IS NOT NULL;