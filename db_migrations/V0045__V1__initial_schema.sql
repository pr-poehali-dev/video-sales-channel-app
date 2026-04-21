
-- users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'buyer',
    shop_name TEXT,
    shop_city_code TEXT,
    shop_city_name TEXT,
    shop_city_guid TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- sellers
CREATE TABLE IF NOT EXISTS sellers (
    user_id TEXT PRIMARY KEY,
    legal_type TEXT,
    user_type TEXT,
    legal_name TEXT,
    inn TEXT,
    bank_account TEXT,
    bank_name TEXT,
    bik TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    agreed_offer BOOLEAN DEFAULT FALSE,
    agreed_pd BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    ogrn TEXT,
    legal_address TEXT,
    corr_account TEXT,
    phone_for_tax TEXT,
    payout_method TEXT,
    card_number TEXT,
    passport_series TEXT,
    passport_number TEXT,
    product_category TEXT,
    is_draft BOOLEAN DEFAULT FALSE,
    draft_saved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT,
    description TEXT,
    images TEXT[] DEFAULT '{}',
    seller_id TEXT NOT NULL,
    seller_name TEXT,
    seller_avatar TEXT,
    in_stock INTEGER DEFAULT 1,
    weight_g INTEGER DEFAULT 500,
    length_cm INTEGER DEFAULT 20,
    width_cm INTEGER DEFAULT 15,
    height_cm INTEGER DEFAULT 10,
    cdek_enabled BOOLEAN DEFAULT TRUE,
    nalog_enabled BOOLEAN DEFAULT FALSE,
    fitting_enabled BOOLEAN DEFAULT FALSE,
    from_city_code TEXT,
    from_city_name TEXT,
    video_url TEXT,
    wholesale_price NUMERIC,
    retail_markup_pct INTEGER DEFAULT 0,
    moderation_status TEXT DEFAULT 'pending',
    moderation_comment TEXT,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- streams
CREATE TABLE IF NOT EXISTS streams (
    id TEXT PRIMARY KEY,
    title TEXT,
    seller_id TEXT,
    seller_name TEXT,
    seller_avatar TEXT,
    is_live BOOLEAN DEFAULT FALSE,
    viewers INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_sec INTEGER DEFAULT 0,
    video_url TEXT,
    thumbnail TEXT,
    hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    buyer_id TEXT,
    buyer_name TEXT,
    buyer_phone TEXT,
    buyer_email TEXT,
    delivery_type TEXT,
    delivery_city_code INTEGER,
    delivery_city_name TEXT,
    delivery_address TEXT,
    delivery_tariff_code TEXT,
    delivery_tariff_name TEXT,
    delivery_cost NUMERIC DEFAULT 0,
    items JSONB DEFAULT '[]',
    goods_total NUMERIC DEFAULT 0,
    order_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'new',
    payment_method TEXT,
    seller_id TEXT,
    seller_legal_type TEXT,
    seller_requisites JSONB DEFAULT '{}',
    seller_status TEXT DEFAULT 'new_order',
    seller_comment TEXT,
    seller_status_updated_at TIMESTAMP,
    cdek_track_number TEXT,
    cdek_order_uuid TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    stream_id TEXT,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    text TEXT,
    sent_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- chat_bans
CREATE TABLE IF NOT EXISTS chat_bans (
    id TEXT PRIMARY KEY,
    stream_id TEXT,
    user_id TEXT,
    banned_by TEXT,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (stream_id, user_id)
);

-- reviews
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    rating INTEGER,
    text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- seller_reviews
CREATE TABLE IF NOT EXISTS seller_reviews (
    id TEXT PRIMARY KEY,
    seller_id TEXT,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    rating INTEGER,
    text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- stream_frames
CREATE TABLE IF NOT EXISTS stream_frames (
    stream_id TEXT PRIMARY KEY,
    frame_data TEXT,
    seq INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- webrtc_signals
CREATE TABLE IF NOT EXISTS webrtc_signals (
    id TEXT PRIMARY KEY,
    stream_id TEXT,
    viewer_id TEXT,
    type TEXT,
    payload TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    seller_id TEXT,
    name TEXT,
    city_code INTEGER,
    city_guid TEXT,
    city_name TEXT,
    address TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
