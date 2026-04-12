"""
Создание платежа через ЮКассу (YooKassa) с методом оплаты СБП.
Возвращает ссылку для перехода в приложение банка и идентификатор платежа.
"""
import json
import os
import uuid
import urllib.request
import base64


YOOKASSA_URL = "https://api.yookassa.ru/v3/payments"


def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    shop_id = os.environ.get("YOOKASSA_SHOP_ID", "")
    secret_key = os.environ.get("YOOKASSA_SECRET_KEY", "")

    if not shop_id or not secret_key:
        return {
            "statusCode": 503,
            "headers": headers,
            "body": json.dumps({"error": "Платёжный шлюз не настроен. Добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY."}),
        }

    body = json.loads(event.get("body") or "{}")
    amount = body.get("amount")
    description = body.get("description", "Заказ в LiveShop")
    return_url = body.get("return_url", "https://liveshop.poehali.dev/")

    if not amount or float(amount) <= 0:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Укажите сумму платежа"})}

    idempotence_key = str(uuid.uuid4())
    credentials = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()

    payload = json.dumps({
        "amount": {"value": f"{float(amount):.2f}", "currency": "RUB"},
        "payment_method_data": {"type": "sbp"},
        "confirmation": {"type": "redirect", "return_url": return_url},
        "capture": True,
        "description": description,
    }).encode()

    req = urllib.request.Request(
        YOOKASSA_URL,
        data=payload,
        headers={
            "Authorization": f"Basic {credentials}",
            "Idempotence-Key": idempotence_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())

    confirmation = result.get("confirmation", {})
    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "payment_id": result.get("id"),
            "status": result.get("status"),
            "confirmation_url": confirmation.get("confirmation_url"),
        }),
    }
