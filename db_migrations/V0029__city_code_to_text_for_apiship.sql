-- Changes city_code fields from INTEGER to TEXT to support ApiShip cityGuid (UUID format)
ALTER TABLE warehouses ALTER COLUMN city_code TYPE TEXT USING city_code::TEXT;
ALTER TABLE products ALTER COLUMN from_city_code TYPE TEXT USING from_city_code::TEXT;