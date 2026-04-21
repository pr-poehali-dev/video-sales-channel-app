-- Добавляем user_type в sellers и is_draft флаг
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ DEFAULT NULL;

-- Синхронизируем user_type из существующего legal_type
UPDATE sellers SET user_type = legal_type WHERE user_type IS NULL;
