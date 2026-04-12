"""
Проверка статуса платежа ЮКассы по payment_id.
Возвращает текущий статус: pending, waiting_for_capture, succeeded, canceled.
"""
import json
import os
import urllib.request
import base64


YOOKASSA_URL = "https://api.yookassa.ru/v3/payments"


def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    shop_id = os.environ.get("YOOKASSA_SHOP_ID", "")
    secret_key = os.environ.get("YOOKASSA_SECRET_KEY", "")

    if not shop_id or not secret_key:
        return {"statusCode": 503, "headers": headers, "body": json.dumps({"error": "Платёжный шлюз не настроен"})}

    params = event.get("queryStringParameters") or {}
    payment_id = params.get("payment_id", "")

    if not payment_id:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Укажите payment_id"})}

    credentials = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
    req = urllib.request.Request(
        f"{YOOKASSA_URL}/{payment_id}",
        headers={"Authorization": f"Basic {credentials}"},
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read())

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "payment_id": result.get("id"),
            "status": result.get("status"),
            "paid": result.get("paid", False),
            "amount": result.get("amount", {}),
        }),
    }
