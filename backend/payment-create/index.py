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
    delivery_cost = float(body.get("delivery_cost", 0))

    if not amount or float(amount) <= 0:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Укажите сумму платежа"})}

    amount_kopecks = int(float(amount) * 100)
    email = body.get("email", "").strip()
    phone = body.get("phone", "").strip()

    payload = {
        "OrderId": order_id,
        "Amount": amount_kopecks,
        "Description": description,
        "SuccessURL": return_url,
        "FailURL": return_url,
    }

    # Receipt — только если есть email или телефон (Т-Банк требует хотя бы одно)
    # Сумма позиций чека ОБЯЗАНА совпадать с Amount (включая доставку)
    if (email or phone) and items:
        receipt: dict = {"Taxation": "usn_income", "Items": []}
        if email:
            receipt["Email"] = email
        if phone:
            receipt["Phone"] = phone
        for item in items:
            price_kopecks = int(float(item.get("price", 0)) * 100)
            qty = int(item.get("qty", 1))
            receipt["Items"].append({
                "Name": item.get("name", "Товар")[:128],
                "Price": price_kopecks,
                "Quantity": qty,
                "Amount": price_kopecks * qty,
                "Tax": "none",
                "PaymentMethod": "full_prepayment",
                "PaymentObject": "commodity",
            })
        # Доставка как отдельная позиция
        if delivery_cost > 0:
            delivery_kopecks = int(delivery_cost * 100)
            receipt["Items"].append({
                "Name": "Доставка",
                "Price": delivery_kopecks,
                "Quantity": 1,
                "Amount": delivery_kopecks,
                "Tax": "none",
                "PaymentMethod": "full_prepayment",
                "PaymentObject": "service",
            })
        payload["Receipt"] = receipt

    # Мультирасчёты: только если включены явно (требует отдельного договора с Т-Банк)
    seller_account = body.get("seller_account", "")
    multimarket_enabled = os.environ.get("TBANK_MULTIMARKET_ENABLED", "false").lower() == "true"
    if seller_account and multimarket_enabled:
        platform_fee_pct = int(body.get("platform_fee_pct", 10))
        platform_fee = int(amount_kopecks * platform_fee_pct / 100)
        seller_amount = amount_kopecks - platform_fee
        payload["Shops"] = [
            {
                "ShopCode": seller_account,
                "Amount": seller_amount,
                "Name": description,
            }
        ]

    print(f"[PAYMENT] Init payload: {json.dumps(payload, ensure_ascii=False)}")
    result = tbank_request("Init", payload)
    print(f"[PAYMENT] Init result: {json.dumps(result, ensure_ascii=False)}")

    if not result.get("Success"):
        return {
            "statusCode": 400,
            "headers": headers,
            "body": json.dumps({"error": result.get("Message", "Ошибка создания платежа"), "details": result}),
        }

    payment_id = result.get("PaymentId")
    payment_url = result.get("PaymentURL")

    # Сохраняем payment_id в заказ + создаём транзакцию в таблице финансов
    if order_id and payment_id:
        try:
            conn = get_conn()
            cur = conn.cursor()

            # Обновляем заказ
            cur.execute(
                "UPDATE \"t_p63706319_video_sales_channel_\".orders SET tbank_payment_id = %s, payment_method = 'tbank' WHERE id = %s",
                (str(payment_id), order_id),
            )

            # Получаем данные заказа для транзакции
            cur.execute(
                "SELECT seller_id, order_total FROM \"t_p63706319_video_sales_channel_\".orders WHERE id = %s",
                (order_id,),
            )
            order_row = cur.fetchone()
            if order_row:
                seller_id_val = order_row[0] or ""
                full_amount = float(order_row[1] or amount)
                marketplace_fee = round(full_amount * 0.10, 2)
                seller_amount = round(full_amount - marketplace_fee, 2)

                # Upsert транзакции — фиксируем холд
                cur.execute("""
                    INSERT INTO "t_p63706319_video_sales_channel_".transactions
                        (order_id, seller_id, full_amount, seller_amount, marketplace_fee,
                         hold_date, status, payment_id, updated_at)
                    VALUES (%s, %s, %s, %s, %s, now(), 'hold', %s, now())
                    ON CONFLICT (order_id) DO UPDATE SET
                        payment_id      = EXCLUDED.payment_id,
                        full_amount     = EXCLUDED.full_amount,
                        seller_amount   = EXCLUDED.seller_amount,
                        marketplace_fee = EXCLUDED.marketplace_fee,
                        hold_date       = now(),
                        status          = 'hold',
                        updated_at      = now()
                """, (order_id, seller_id_val, full_amount, seller_amount, marketplace_fee, str(payment_id)))
                print(f"[PAYMENT] Transaction logged: order={order_id} fee={marketplace_fee} seller={seller_amount}")

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