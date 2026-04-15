-- Статус заказа со стороны продавца
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_status text NOT NULL DEFAULT 'new_order';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_comment text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_status_updated_at timestamp with time zone;

-- seller_id берём из items
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id text NOT NULL DEFAULT '';

-- Индексы
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_status);