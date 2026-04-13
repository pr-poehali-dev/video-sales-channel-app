"""
Расчёт стоимости доставки СДЭК до выбранного города покупателя.
Поддерживает: получение токена, поиск городов, расчёт тарифов.
"""
import json
import os
import urllib.request
import urllib.parse


CDEK_API = "https://api.edu.cdek.ru/v2"


def get_token() -> str:
    client_id = os.environ.get("CDEK_CLIENT_ID", "EMscd6r9JnFiQ3bLoyjJY6eM78JrJceI")
    client_secret = os.environ.get("CDEK_CLIENT_SECRET", "PjLZkKBHEiLK3YsjtNrt3TGNG0ahs3kG")
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


def calc_tariffs(city_code: int, weight_g: int, token: str) -> list:
    tariff_codes = [136, 137, 138, 139]
    names = {
        136: "Посылка склад-склад",
        137: "Посылка склад-дверь",
        138: "Посылка дверь-склад",
        139: "Посылка дверь-дверь",
    }
    out = []
    for tariff_code in tariff_codes:
        try:
            payload = json.dumps({
                "tariff_code": tariff_code,
                "from_location": {"code": 270},
                "to_location": {"code": city_code},
                "packages": [{"weight": max(weight_g, 100), "length": 20, "width": 15, "height": 10}],
            }).encode()
            req = urllib.request.Request(
                f"{CDEK_API}/calculator/packages",
                data=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
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


def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "cities")

    if action == "debug_token":
        client_id = os.environ.get("CDEK_CLIENT_ID", "EMscd6r9JnFiQ3bLoyjJY6eM78JrJceI")
        client_secret = os.environ.get("CDEK_CLIENT_SECRET", "PjLZkKBHEiLK3YsjtNrt3TGNG0ahs3kG")
        body = urllib.parse.urlencode({
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }).encode("utf-8")
        token_url = f"{CDEK_API}/oauth/token?parameters"
        req = urllib.request.Request(
            token_url,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True, "raw": raw.decode(), "url": token_url})}
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": e.code, "reason": e.reason, "body": raw, "url": token_url, "client_id": client_id})}

    try:
        token = get_token()

        if action == "cities":
            query = params.get("q", "").strip()
            if len(query) < 2:
                return {"statusCode": 200, "headers": headers, "body": json.dumps([])}
            cities = search_cities(query, token)
            return {"statusCode": 200, "headers": headers, "body": json.dumps(cities)}

        if action == "calc":
            city_code = int(params.get("city_code", 0))
            weight_g = int(params.get("weight", 500))
            if not city_code:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "city_code required"})}
            tariffs = calc_tariffs(city_code, weight_g, token)
            return {"statusCode": 200, "headers": headers, "body": json.dumps(tariffs)}

    except Exception as e:
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": str(e)})}

    return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "unknown action"})}