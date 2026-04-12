"""
Расчёт стоимости доставки СДЭК до выбранного города покупателя.
Поддерживает: получение токена, поиск городов, расчёт тарифов.
"""
import json
import os
import urllib.request
import urllib.parse


CDEK_API = "https://api.cdek.ru/v2"


def get_token() -> str:
    client_id = os.environ.get("CDEK_CLIENT_ID", "EMscd6r9JnFiQ3bLoyjJY6eM78JrJceI")
    client_secret = os.environ.get("CDEK_CLIENT_SECRET", "PjLZkKBHEiLK3YsjtNrt3TGNG0ahs3kG")
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode()
    req = urllib.request.Request(
        f"{CDEK_API}/oauth/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
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
    payload = json.dumps({
        "from_location": {"code": 44},
        "to_location": {"code": city_code},
        "packages": [{"weight": max(weight_g, 100), "length": 20, "width": 15, "height": 10}],
        "tariff_codes": [136, 137, 138, 139],
    }).encode()
    req = urllib.request.Request(
        f"{CDEK_API}/calculator/tarifflist",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read())
        tariffs = result.get("tariff_codes", [])
        names = {
            136: "Посылка склад-склад",
            137: "Посылка склад-дверь",
            138: "Посылка дверь-склад",
            139: "Посылка дверь-дверь",
        }
        out = []
        for t in tariffs:
            code = t.get("tariff_code")
            if t.get("delivery_sum"):
                out.append({
                    "code": code,
                    "name": names.get(code, t.get("tariff_name", "")),
                    "price": int(t["delivery_sum"]),
                    "days_min": t.get("period_min", 1),
                    "days_max": t.get("period_max", 7),
                })
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
