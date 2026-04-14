"""
СДЭК API: поиск городов, расчёт тарифов, создание заказа.
Боевой контур: api.cdek.ru. v8
"""
import json
import os
import uuid
import urllib.request
import urllib.parse
import urllib.error
import psycopg2
from psycopg2.extras import RealDictCursor


CDEK_API = "https://api.cdek.ru/v2"

FROM_CITY_CODE = 270
FROM_ADDRESS = "Краснодар, ул. Красная, 1"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_token() -> str:
    client_id = os.environ["CDEK_CLIENT_ID"]
    client_secret = os.environ["CDEK_CLIENT_SECRET"]
    body = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{CDEK_API}/oauth/token?parameters",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())["access_token"]


def cdek_request(path: str, token: str, payload: dict = None, method: str = "GET") -> dict:
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(
        f"{CDEK_API}{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def search_cities(query: str, token: str) -> list:
    params = urllib.parse.urlencode({"city": query, "country_codes": "RU", "size": 10})
    req = urllib.request.Request(
        f"{CDEK_API}/location/cities?{params}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        cities = json.loads(resp.read())
        return [
            {
                "code": c.get("code"),
                "city": c.get("city"),
                "region": c.get("region", ""),
                "country": c.get("country_code", "RU"),
            }
            for c in (cities if isinstance(cities, list) else [])
        ]


def calc_tariffs(city_code: int, weight_g: int, token: str, from_city_code: int = 0) -> list:
    tariff_codes = [136]
    names = {
        136: "Посылка склад-склад (ПВЗ)",
    }
    sender_code = from_city_code or FROM_CITY_CODE
    out = []
    for tariff_code in tariff_codes:
        try:
            result = cdek_request("/calculator/packages", token, {
                "tariff_code": tariff_code,
                "from_location": {"code": sender_code},
                "to_location": {"code": city_code},
                "packages": [{"weight": max(weight_g, 100), "length": 20, "width": 15, "height": 10}],
            }, "POST")
            price = result.get("total_sum") or result.get("delivery_sum")
            if price:
                out.append({
                    "code": tariff_code,
                    "name": names.get(tariff_code, f"Тариф {tariff_code}"),
                    "price": int(price),
                    "days_min": result.get("period_min", 1),
                    "days_max": result.get("period_max", 7),
                })
        except Exception:
            continue
    return sorted(out, key=lambda x: x["price"])


def create_cdek_order(order: dict, token: str) -> dict:
    """
    Создаёт заказ в СДЭК.
    order: {
      order_id, buyer_name, buyer_phone, buyer_email,
      delivery_type (cdek_pvz|cdek_courier),
      delivery_city_code, delivery_address, cdek_pvz_code,
      delivery_tariff_code, delivery_cost,
      goods_total, order_total, weight_g, length_cm, width_cm, height_cm,
      try_on_enabled, nalog_enabled, items
    }
    """
    is_pvz = order.get("delivery_type") == "cdek_pvz"
    tariff_code = order.get("delivery_tariff_code") or (136 if is_pvz else 137)

    # Услуги
    services = []
    if order.get("nalog_enabled"):
        services.append({"code": "NALOG_OBRABOTKA"})  # Наложенный платёж
    if order.get("try_on_enabled"):
        services.append({"code": "PRIMERCA_CHASTIC"})  # Частичная примерка

    # Данные получателя
    phone = order.get("buyer_phone", "").replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+" + phone.lstrip("8").lstrip("+")

    # Место доставки
    delivery_point = {}
    if is_pvz and order.get("cdek_pvz_code"):
        delivery_point = {"delivery_point": order["cdek_pvz_code"]}
    else:
        delivery_point = {
            "to_location": {
                "code": order.get("delivery_city_code"),
                "address": order.get("delivery_address", ""),
            }
        }

    payload = {
        "number": order.get("order_id", str(uuid.uuid4().hex[:12])),
        "tariff_code": tariff_code,
        "from_location": {
            "code": FROM_CITY_CODE,
            "address": FROM_ADDRESS,
        },
        **delivery_point,
        "recipient": {
            "name": order.get("buyer_name", ""),
            "phones": [{"number": phone}],
            **({"email": order["buyer_email"]} if order.get("buyer_email") else {}),
        },
        "packages": [{
            "number": "1",
            "weight": max(order.get("weight_g", 500), 100),
            "length": order.get("length_cm", 20),
            "width": order.get("width_cm", 15),
            "height": order.get("height_cm", 10),
            "items": [
                {
                    "name": item.get("name", "Товар")[:255],
                    "ware_key": item.get("id", str(i)),
                    "payment": {"value": float(item.get("price", 0)) if order.get("nalog_enabled") else 0},
                    "cost": float(item.get("price", 0)),
                    "weight": max(order.get("weight_g", 500), 100),
                    "amount": int(item.get("qty", 1)),
                }
                for i, item in enumerate(order.get("items", []))
            ],
        }],
        **({"services": services} if services else {}),
    }

    result = cdek_request("/orders", token, payload, "POST")
    return result


def handler(event: dict, context) -> dict:
    """Обработчик запросов СДЭК: города, расчёт, создание заказа."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "cities")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # Быстрые проверки без получения токена
    if action == "create_order" and not body.get("order_id"):
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "order_id required"})}
    if action == "order_status" and not (qs.get("uuid") or body.get("uuid")):
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "uuid required"})}
    if action == "cities" and len(qs.get("q", "").strip()) < 2:
        return {"statusCode": 200, "headers": headers, "body": json.dumps([])}

    # Проверка соединения с переданными ключами
    if action == "test_auth":
        client_id = body.get("client_id", "").strip()
        client_secret = body.get("client_secret", "").strip()
        if not client_id or not client_secret:
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "client_id and client_secret required"})}
        results = []
        for token_url, params in [
            (f"{CDEK_API}/oauth/token?parameters", {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}),
            (f"{CDEK_API}/oauth/token", {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}),
        ]:
            try:
                b = urllib.parse.urlencode(params).encode("utf-8")
                req = urllib.request.Request(
                    token_url,
                    data=b,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    token_data = json.loads(resp.read())
                    access_token = token_data.get("access_token", "")
                    if access_token:
                        cities = search_cities("Москва", access_token)
                        return {"statusCode": 200, "headers": headers, "body": json.dumps({
                            "ok": True,
                            "cities_found": len(cities),
                            "msg": f"Подключено! Найдено {len(cities)} городов. URL: {token_url}"
                        })}
                    results.append(f"{token_url}: токен пустой")
            except urllib.error.HTTPError as e:
                raw = e.read().decode()
                results.append(f"{token_url}: {e.code} {raw[:100]}")
            except Exception as e:
                results.append(f"{token_url}: {str(e)[:80]}")
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": False, "msg": " | ".join(results)})}

    try:
        token = get_token()

        # ── Поиск городов ──
        if action == "cities":
            query = qs.get("q", "").strip()
            cities = search_cities(query, token)
            return {"statusCode": 200, "headers": headers, "body": json.dumps(cities, ensure_ascii=False)}

        # ── Расчёт тарифов ──
        if action == "calc":
            city_code = int(qs.get("city_code", 0))
            weight_g = int(qs.get("weight", 500))
            from_city = int(qs.get("from_city_code", 0))
            seller_id = qs.get("seller_id", "")
            if not city_code:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "city_code required"})}
            # Если from_city_code не передан — берём склад по умолчанию из БД
            if not from_city and seller_id:
                try:
                    conn = get_conn()
                    cur = conn.cursor(cursor_factory=RealDictCursor)
                    cur.execute(
                        "SELECT city_code FROM warehouses WHERE seller_id=%s AND is_default=TRUE LIMIT 1",
                        (seller_id,)
                    )
                    row = cur.fetchone()
                    if not row:
                        cur.execute(
                            "SELECT city_code FROM warehouses WHERE seller_id=%s ORDER BY created_at ASC LIMIT 1",
                            (seller_id,)
                        )
                        row = cur.fetchone()
                    if row:
                        from_city = row["city_code"]
                    cur.close()
                    conn.close()
                except Exception:
                    pass
            tariffs = calc_tariffs(city_code, weight_g, token, from_city)
            return {"statusCode": 200, "headers": headers, "body": json.dumps(tariffs)}

        # ── Создание заказа в СДЭК ──
        if action == "create_order":
            order_id = body.get("order_id")
            if not order_id:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "order_id required"})}

            result = create_cdek_order(body, token)

            # Извлекаем UUID и трек-номер из ответа СДЭК
            entity = result.get("entity") or {}
            requests_list = result.get("requests") or []
            cdek_uuid = entity.get("uuid", "")
            track_number = ""

            # Трек-номер может прийти сразу или потребует запроса статуса
            if cdek_uuid:
                try:
                    order_info = cdek_request(f"/orders/{cdek_uuid}", token)
                    track_number = order_info.get("entity", {}).get("cdek_number", "")
                except Exception:
                    pass

            # Сохраняем в БД
            if cdek_uuid or track_number:
                conn = get_conn()
                cur = conn.cursor()
                cur.execute(
                    """UPDATE orders SET cdek_order_uuid=%s, cdek_track_number=%s
                       WHERE id=%s""",
                    (cdek_uuid, track_number, order_id)
                )
                conn.commit()
                cur.close()
                conn.close()

            # Ошибки от СДЭК
            errors = []
            for req in requests_list:
                for e in (req.get("errors") or []):
                    errors.append(e.get("message", ""))

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({
                    "ok": True,
                    "cdek_uuid": cdek_uuid,
                    "track_number": track_number,
                    "errors": errors,
                    "raw": result,
                }, ensure_ascii=False),
            }

        # ── Статус заказа по UUID ──
        if action == "order_status":
            cdek_uuid = qs.get("uuid") or body.get("uuid")
            info = cdek_request(f"/orders/{cdek_uuid}", token)
            entity = info.get("entity", {})
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({
                    "cdek_number": entity.get("cdek_number", ""),
                    "status": (entity.get("statuses") or [{}])[0].get("name", ""),
                    "track_url": f"https://www.cdek.ru/ru/tracking?order_id={entity.get('cdek_number', '')}",
                }, ensure_ascii=False),
            }

    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"error": f"CDEK {e.code}: {raw}"})}
    except Exception as e:
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"error": str(e)})}

    return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "unknown action"})}