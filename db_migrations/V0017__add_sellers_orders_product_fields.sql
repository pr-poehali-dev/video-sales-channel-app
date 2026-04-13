-- Добавляем поля к товарам для доставки и опций
ALTER TABLE t_p63706319_video_sales_channel_.products
  ADD COLUMN IF NOT EXISTS weight_g integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS length_cm integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS width_cm integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS height_cm integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cdek_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nalog_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fitting_enabled boolean NOT NULL DEFAULT false;

-- Таблица продавцов (расширенный профиль)
CREATE TABLE IF NOT EXISTS t_p63706319_video_sales_channel_.sellers (
  user_id text NOT NULL PRIMARY KEY,
  legal_type text NOT NULL DEFAULT 'individual',  -- 'individual' | 'ip' | 'ooo'
  legal_name text NOT NULL DEFAULT '',
  inn text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bik text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  cdek_id text NOT NULL DEFAULT '',
  agreed_offer boolean NOT NULL DEFAULT false,
  agreed_pd boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Таблица заказов
CREATE TABLE IF NOT EXISTS t_p63706319_video_sales_channel_.orders (
  id text NOT NULL PRIMARY KEY,
  buyer_id text NOT NULL DEFAULT '',
  buyer_name text NOT NULL DEFAULT '',
  buyer_phone text NOT NULL DEFAULT '',
  buyer_email text NOT NULL DEFAULT '',
  delivery_type text NOT NULL DEFAULT 'cdek_pvz',  -- 'cdek_pvz' | 'cdek_courier'
  delivery_city_code integer NULL,
  delivery_city_name text NOT NULL DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  delivery_tariff_code integer NULL,
  delivery_tariff_name text NOT NULL DEFAULT '',
  delivery_cost numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]',
  goods_total numeric NOT NULL DEFAULT 0,
  order_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new',  -- 'new' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  payment_method text NOT NULL DEFAULT '',
  cdek_order_uuid text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
