-- Обновляем товары: from_city_code = название города (для обратной совместимости с apiship)
UPDATE products SET from_city_code = 'Ставрополь' WHERE from_city_name = 'Ставрополь';
UPDATE products SET from_city_code = 'Ипатово'    WHERE from_city_name = 'Ипатово';
UPDATE products SET from_city_code = 'Краснодар'  WHERE from_city_name = 'Краснодар';