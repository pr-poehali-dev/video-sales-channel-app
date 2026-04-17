-- Обновляем существующие склады: city_code = название города, city_guid = ФИАС UUID
UPDATE warehouses SET city_code = 'Ставрополь', city_guid = '2a1c7bdb-05ea-492f-9e1c-b3999f79dcbc' WHERE city_name = 'Ставрополь';
UPDATE warehouses SET city_code = 'Ипатово',    city_guid = '589a16ac-fb2e-46f9-b59a-98c18d34d908' WHERE city_name = 'Ипатово';