"""
ApiShip API: поиск городов, расчёт тарифов, список ПВЗ, создание заказа.
Тестовый контур: api.dev.apiship.ru/v1, боевой: api.apiship.ru/v1
"""
import json
import os
import urllib.request
import urllib.parse
import urllib.error
import psycopg2
from psycopg2.extras import RealDictCursor


APISHIP_API = "https://api.apiship.ru/v1"
APISHIP_TOKEN = os.environ.get("APISHIP_TOKEN", "")

FROM_CITY_NAME = "Краснодар"
FROM_ADDRESS = "Краснодар, ул. Красная, 1"

# Основные провайдеры ApiShip (ID из справочника)
DEFAULT_PROVIDERS = [1, 2, 3, 5, 7, 9, 15]  # cdek, boxberry, pickpoint, pochta, dpd, iml, pek


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def apiship_request(path: str, payload: dict = None, method: str = "GET") -> dict:
    """Запрос к ApiShip. Пробуем разные варианты заголовка авторизации."""
    data = json.dumps(payload).encode() if payload else None
    last_err = None
    for auth_header in [
        {"Authorization": APISHIP_TOKEN},
        {"Authorization": f"Bearer {APISHIP_TOKEN}"},
        {"X-API-KEY": APISHIP_TOKEN},
        {"Platform-Token": APISHIP_TOKEN},
    ]:
        req = urllib.request.Request(
            f"{APISHIP_API}{path}",
            data=data,
            headers={
                **auth_header,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            if e.code == 401:
                last_err = e
                continue
            raise
    if last_err:
        raise last_err
    return {}


def search_cities(query: str) -> list:
    """Поиск населённых пунктов по названию через ApiShip.
    Формат фильтра ApiShip: filter=name~Москва (name с префиксом, тильда = LIKE).
    """
    out = []
    seen = set()
    # Пробуем несколько вариантов фильтрации, т.к. формат может различаться
    filter_variants = [
        f"filter=name~{urllib.parse.quote(query)}&limit=15",
        f"filter=name={urllib.parse.quote(query)}&limit=15",
        f"name={urllib.parse.quote(query)}&limit=15",
    ]
    for fv in filter_variants:
        try:
            data = apiship_request(f"/lists/cities?{fv}")
        except urllib.error.HTTPError as e:
            print(f"[APISHIP] cities variant '{fv}' HTTP {e.code}")
            continue
        except Exception as e:
            print(f"[APISHIP] cities variant '{fv}' err: {e}")
            continue
        rows = data.get("rows") or data.get("items") or data.get("data") or []
        if not rows and isinstance(data, list):
            rows = data
        print(f"[APISHIP] cities '{fv}' rows={len(rows)} sample={json.dumps(rows[:1], ensure_ascii=False)[:300]}")
        if rows:
            for c in rows:
                city = c.get("name") or c.get("city") or ""
                region = c.get("regionName") or c.get("region") or ""
                code = str(c.get("id") or c.get("code") or c.get("cityId") or "")
                if not code or code in seen:
                    continue
                seen.add(code)
                out.append({
                    "code": code,
                    "city": city,
                    "region": region,
                    "country": c.get("countryCode", "RU"),
                })
            if out:
                return out
    return out


def calc_tariffs(city_code: str, weight_g: int, from_city_code: str = "") -> list:
    """Расчёт доставки через ApiShip для всех поддерживаемых провайдеров."""
    payload = {
        "from": {"cityId": int(from_city_code) if str(from_city_code).isdigit() else None, "cityName": FROM_CITY_NAME if not from_city_code else None},
        "to": {"cityId": int(city_code) if str(city_code).isdigit() else None},
        "places": [{
            "weight": max(weight_g / 1000.0, 0.1),
            "height": 10,
            "width": 15,
            "length": 20,
        }],
        "providerKeys": None,  # все доступные
    }
    # Удаляем None-поля
    payload["from"] = {k: v for k, v in payload["from"].items() if v is not None}
    payload["to"] = {k: v for k, v in payload["to"].items() if v is not None}

    try:
        result = apiship_request("/calculator", payload, "POST")
    except urllib.error.HTTPError as e:
        raw = e.read().decode() if hasattr(e, "read") else ""
        print(f"[APISHIP] calc HTTP {e.code}: {raw[:300]}")
        return []
    except Exception as e:
        print(f"[APISHIP] calc error: {e}")
        return []

    print(f"[APISHIP] calc raw: {json.dumps(result)[:500]}")
    out = []
    offers = result.get("offers") or result.get("rows") or result.get("data") or []
    for o in offers:
        delivery = o.get("deliveryCost") or o.get("cost") or o.get("totalPrice") or 0
        if not delivery:
            continue
        provider = o.get("providerKey") or o.get("providerName") or "Доставка"
        tariff_name = o.get("tariffName") or o.get("name") or ""
        point_type = o.get("pointTypeTo") or o.get("deliveryType") or ""
        is_pvz = "POSTAMAT" in str(point_type).upper() or "PVZ" in str(point_type).upper() or "TERMINAL" in str(point_type).upper()

        out.append({
            "code": str(o.get("tariffId") or o.get("id") or f"{provider}_{tariff_name}"),
            "name": f"{provider}: {tariff_name}" if tariff_name else str(provider),
            "price": int(float(delivery)),
            "days_min": int(o.get("daysMin", 1)),
            "days_max": int(o.get("daysMax", 7)),
            "provider": str(provider),
            "delivery_to": "pvz" if is_pvz else "courier",
        })
    return sorted(out, key=lambda x: x["price"])


def create_apiship_order(order: dict) -> dict:
    """Создание заказа в ApiShip."""
    phone = order.get("buyer_phone", "").replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+" + phone.lstrip("8").lstrip("+")

    is_pvz = order.get("delivery_type") == "cdek_pvz" or order.get("delivery_to") == "pvz"

    payload = {
        "clientNumber": str(order.get("order_id", "")),
        "providerKey": order.get("provider", "cdek"),
        "tariffId": int(order["delivery_tariff_code"]) if str(order.get("delivery_tariff_code", "")).isdigit() else None,
        "recipient": {
            "name": order.get("buyer_name", ""),
            "phone": phone,
            "email": order.get("buyer_email", ""),
        },
        "addressFrom": {
            "cityName": FROM_CITY_NAME,
            "address": FROM_ADDRESS,
        },
        "addressTo": {
            "cityId": int(order["delivery_city_code"]) if str(order.get("delivery_city_code", "")).isdigit() else None,
            "address": order.get("delivery_address", ""),
            "pointOutId": order.get("cdek_pvz_code") if is_pvz else None,
        },
        "places": [{
            "weight": max(order.get("weight_g", 500) / 1000.0, 0.1),
            "height": order.get("height_cm", 10),
            "width": order.get("width_cm", 15),
            "length": order.get("length_cm", 20),
            "items": [
                {
                    "description": item.get("name", "Товар")[:255],
                    "articul": str(item.get("id", i)),
                    "quantity": int(item.get("qty", 1)),
                    "assessedCost": float(item.get("price", 0)),
                    "cost": float(item.get("price", 0)),
                    "weight": max(order.get("weight_g", 500) / 1000.0 / max(len(order.get("items", [])), 1), 0.1),
                }
                for i, item in enumerate(order.get("items", []))
            ],
        }],
    }
    # Чистим None
    payload["addressTo"] = {k: v for k, v in payload["addressTo"].items() if v is not None}
    if payload["tariffId"] is None:
        payload.pop("tariffId")

    try:
        result = apiship_request("/orders", payload, "POST")
        return result
    except urllib.error.HTTPError as e:
        raw = e.read().decode() if hasattr(e, "read") else ""
        return {"error": f"HTTP {e.code}: {raw[:400]}"}


def handler(event: dict, context) -> dict:
    """Обработчик запросов ApiShip: города, расчёт, ПВЗ, создание заказа."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    if not APISHIP_TOKEN:
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": "APISHIP_TOKEN не настроен"})}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "cities")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    if action == "cities" and len(qs.get("q", "").strip()) < 2:
        return {"statusCode": 200, "headers": headers, "body": json.dumps([])}

    try:
        if action == "debug_cities":
            query = qs.get("q", "Москва")
            q_enc = urllib.parse.quote(query)
            attempts = []
            for path in [
                f"/cities?filter=name~{q_enc}&limit=5",
                f"/cities?name={q_enc}&limit=5",
                f"/lists/settlements?filter=name~{q_enc}&limit=5",
                f"/lists/settlements?name={q_enc}&limit=5",
                f"/suggests/cities?query={q_enc}&limit=5",
                f"/lists/suggests/cities?query={q_enc}",
                f"/lists/regions?limit=3",
                f"/lists/points?filter=cityName~{q_enc}&limit=3",
            ]:
                try:
                    d = apiship_request(path)
                    attempts.append({"path": path, "data": d if isinstance(d, list) else {k: (v if not isinstance(v, list) else v[:2]) for k, v in d.items()}})
                except urllib.error.HTTPError as e:
                    raw = e.read().decode() if hasattr(e, "read") else ""
                    attempts.append({"path": path, "error": f"{e.code}: {raw[:200]}"})
                except Exception as e:
                    attempts.append({"path": path, "error": str(e)[:200]})
            return {"statusCode": 200, "headers": headers, "body": json.dumps(attempts, ensure_ascii=False)}

        if action == "test_auth":
            results = []
            for path in ["/lists/providers", "/lists/cities?limit=1", "/lists/statuses", "/providers"]:
                try:
                    data = apiship_request(path)
                    rows = data.get("rows") or data.get("data") or data
                    count = len(rows) if isinstance(rows, list) else "ok"
                    return {"statusCode": 200, "headers": headers, "body": json.dumps({
                        "ok": True,
                        "url": APISHIP_API,
                        "msg": f"ApiShip подключён ({path}): {count}"
                    }, ensure_ascii=False)}
                except urllib.error.HTTPError as e:
                    raw = e.read().decode() if hasattr(e, "read") else ""
                    results.append(f"{path}={e.code}:{raw[:80]}")
                except Exception as e:
                    results.append(f"{path}=err:{str(e)[:80]}")
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": False, "url": APISHIP_API, "msg": " | ".join(results)})}

        if action == "cities":
            query = qs.get("q", "").strip()
            cities = search_cities(query)
            return {"statusCode": 200, "headers": headers, "body": json.dumps(cities, ensure_ascii=False)}

        if action == "calc":
            city_code = qs.get("city_code", "")
            weight_g = int(qs.get("weight", 500))
            from_city = qs.get("from_city_code", "")
            seller_id = qs.get("seller_id", "")
            if not city_code:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "city_code required"})}

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
                        from_city = str(row["city_code"])
                    cur.close()
                    conn.close()
                except Exception:
                    pass

            tariffs = calc_tariffs(city_code, weight_g, from_city)
            return {"statusCode": 200, "headers": headers, "body": json.dumps(tariffs, ensure_ascii=False)}

        if action == "get_pvz":
            city_code = qs.get("city_code") or body.get("city_code")
            provider = qs.get("provider") or body.get("provider") or ""
            if not city_code:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "city_code required"})}

            params = {"cityId": city_code, "limit": 200}
            if provider:
                params["providerKey"] = provider
            query = urllib.parse.urlencode(params)
            data = apiship_request(f"/lists/points?{query}")
            items = data.get("rows") or data.get("data") or []
            points = []
            for p in items:
                lat = p.get("latitude") or p.get("lat")
                lon = p.get("longitude") or p.get("lon")
                if not lat or not lon:
                    continue
                points.append({
                    "code": str(p.get("id") or p.get("code") or ""),
                    "name": p.get("name") or p.get("address") or "",
                    "address": p.get("address") or "",
                    "work_time": p.get("timetable") or p.get("workTime") or "",
                    "lat": float(lat),
                    "lon": float(lon),
                    "type": p.get("type", ""),
                    "provider": p.get("providerKey", ""),
                    "phones": [p.get("phone")] if p.get("phone") else [],
                })
            return {"statusCode": 200, "headers": headers, "body": json.dumps(points, ensure_ascii=False)}

        if action == "create_order":
            order_id = body.get("order_id")
            if not order_id:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "order_id required"})}
            result = create_apiship_order(body)
            apiship_id = str(result.get("id", "") or result.get("orderId", ""))
            track = result.get("providerNumber") or result.get("track") or ""

            if apiship_id or track:
                try:
                    conn = get_conn()
                    cur = conn.cursor()
                    cur.execute(
                        "UPDATE orders SET cdek_order_uuid=%s, cdek_track_number=%s WHERE id=%s",
                        (apiship_id, track, order_id)
                    )
                    conn.commit()
                    cur.close()
                    conn.close()
                except Exception as e:
                    print(f"[APISHIP] db update error: {e}")

            return {"statusCode": 200, "headers": headers, "body": json.dumps({
                "ok": not result.get("error"),
                "cdek_uuid": apiship_id,
                "track_number": track,
                "errors": [result["error"]] if result.get("error") else [],
                "raw": result,
            }, ensure_ascii=False)}

        if action == "order_status":
            apiship_id = qs.get("uuid") or body.get("uuid")
            info = apiship_request(f"/orders/{apiship_id}")
            return {"statusCode": 200, "headers": headers, "body": json.dumps({
                "cdek_number": info.get("providerNumber", ""),
                "status": info.get("statusName") or info.get("status", ""),
                "track_url": info.get("trackingUrl", ""),
            }, ensure_ascii=False)}

    except urllib.error.HTTPError as e:
        raw = e.read().decode() if hasattr(e, "read") else ""
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"error": f"ApiShip {e.code}: {raw[:400]}"})}
    except Exception as e:
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"error": str(e)})}

    return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "unknown action"})}