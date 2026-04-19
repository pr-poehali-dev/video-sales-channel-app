"""
Создание платежа через Т-Банк (Tinkoff Acquiring API).
Поддерживает Мультирасчёты (marketplace): автоматически делит платёж между продавцом и площадкой.
Возвращает PaymentURL для перенаправления покупателя.
"""
import json
import os
import hashlib
import urllib.request
import psycopg2


TBANK_API = "https://securepay.tinkoff.ru/v2"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def tbank_token(params: dict, password: str) -> str:
    """Генерация подписи запроса к Т-Банк."""
    data = {**params, "Password": password}
    pairs = sorted(data.items())
    values = "".join(str(v) for _, v in pairs if not isinstance(v, (dict, list)))
    return hashlib.sha256(values.encode()).hexdigest()


def tbank_request(method: str, payload: dict) -> dict:
    terminal_key = os.environ.get("TBANK_TERMINAL_KEY", "TinkoffBankTest")
    secret_key = os.environ.get("TBANK_SECRET_KEY", "TinkoffBankTest")
    payload["TerminalKey"] = terminal_key
    payload["Token"] = tbank_token(payload, secret_key)
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{TBANK_API}/{method}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    """Создаёт платёж в Т-Банк. Если в заказе есть seller_id — добавляет Мультирасчёты."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    terminal_key = os.environ.get("TBANK_TERMINAL_KEY", "TinkoffBankTest")
    secret_key = os.environ.get("TBANK_SECRET_KEY", "TinkoffBankTest")

    body = json.loads(event.get("body") or "{}")
    order_id = body.get("order_id", "")
    amount = body.get("amount")
    description = body.get("description", "Заказ в СтримБазар")
    return_url = body.get("return_url", "https://стримбазар.рф/")
    items = body.get("items", [])

    if not amount or float(amount) <= 0:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Укажите сумму платежа"})}

    amount_kopecks = int(float(amount) * 100)

    payload = {
        "OrderId": order_id,
        "Amount": amount_kopecks,
        "Description": description,
        "SuccessURL": return_url,
        "FailURL": return_url,
        "NotificationURL": body.get("notification_url", ""),
        "Receipt": {
            "Email": body.get("email", ""),
            "Phone": body.get("phone", ""),
            "Taxation": "usn_income",
            "Items": [
                {
                    "Name": item.get("name", "Товар")[:128],
                    "Price": int(float(item.get("price", 0)) * 100),
                    "Quantity": int(item.get("qty", 1)),
                    "Amount": int(float(item.get("price", 0)) * 100) * int(item.get("qty", 1)),
                    "Tax": "none",
                    "PaymentMethod": "full_prepayment",
                    "PaymentObject": "commodity",
                }
                for item in items
            ],
        },
    }

    # Мультирасчёты: если передан seller_account — делим платёж
    # platform_fee_pct — процент комиссии площадки (по умолчанию 10%)
    seller_account = body.get("seller_account", "")
    platform_fee_pct = int(body.get("platform_fee_pct", 10))
    if seller_account:
        platform_fee = int(amount_kopecks * platform_fee_pct / 100)
        seller_amount = amount_kopecks - platform_fee
        payload["Shops"] = [
            {
                "ShopCode": seller_account,
                "Amount": seller_amount,
                "Name": description,
            }
        ]

    result = tbank_request("Init", payload)

    if not result.get("Success"):
        return {
            "statusCode": 400,
            "headers": headers,
            "body": json.dumps({"error": result.get("Message", "Ошибка создания платежа"), "details": result}),
        }

    payment_id = result.get("PaymentId")
    payment_url = result.get("PaymentURL")

    # Сохраняем payment_id в заказ
    if order_id and payment_id:
        try:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                "UPDATE orders SET tbank_payment_id = %s, payment_method = 'tbank' WHERE id = %s",
                (str(payment_id), order_id),
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"[PAYMENT] DB update error: {e}")

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "payment_id": payment_id,
            "payment_url": payment_url,
            "status": result.get("Status"),
        }),
    }