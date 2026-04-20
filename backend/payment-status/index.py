"""
Проверка статуса платежа Т-Банк по payment_id.
Возвращает статус: NEW, FORM_SHOWED, AUTHORIZING, 3DS_CHECKING, AUTHORIZED, CONFIRMING, CONFIRMED, REVERSING, PARTIAL_REVERSED, REVERSED, REFUNDING, PARTIAL_REFUNDED, REFUNDED, CANCELED, REJECTED.
При статусе CONFIRMED — обновляет статус заказа в БД на 'paid'.
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
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    """Проверяет статус платежа и обновляет заказ в БД при успешной оплате."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    terminal_key = os.environ.get("TBANK_TERMINAL_KEY", "TinkoffBankTest")
    secret_key = os.environ.get("TBANK_SECRET_KEY", "TinkoffBankTest")

    params = event.get("queryStringParameters") or {}
    payment_id = params.get("payment_id", "")
    order_id = params.get("order_id", "")

    if not payment_id:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Укажите payment_id"})}

    result = tbank_request("GetState", {"PaymentId": payment_id})

    status = result.get("Status", "")
    paid = status == "CONFIRMED"

    # При успешной оплате — обновляем статус заказа и транзакцию
    if paid and order_id:
        try:
            conn = get_conn()
            cur = conn.cursor()

            # Обновляем заказ
            cur.execute(
                "UPDATE \"t_p63706319_video_sales_channel_\".orders SET status = 'paid' WHERE id = %s AND status = 'new'",
                (order_id,),
            )

            # Переводим транзакцию в статус paid
            cur.execute("""
                UPDATE "t_p63706319_video_sales_channel_".transactions
                SET status = 'paid', paid_at = now(), updated_at = now()
                WHERE order_id = %s AND status = 'hold'
            """, (order_id,))

            if cur.rowcount == 0:
                # Транзакции не было — создаём (резервный путь)
                tbank_amount = result.get("Amount", 0)
                full_amount = float(tbank_amount) / 100 if tbank_amount else 0
                marketplace_fee = round(full_amount * 0.10, 2)
                seller_amount = round(full_amount - marketplace_fee, 2)
                cur.execute("""
                    INSERT INTO "t_p63706319_video_sales_channel_".transactions
                        (order_id, full_amount, seller_amount, marketplace_fee,
                         hold_date, status, payment_id, paid_at, updated_at)
                    VALUES (%s, %s, %s, %s, now(), 'paid', %s, now(), now())
                    ON CONFLICT (order_id) DO UPDATE SET
                        status = 'paid', paid_at = now(), updated_at = now()
                """, (order_id, full_amount, seller_amount, marketplace_fee, payment_id))
                print(f"[PAYMENT-STATUS] Transaction created on confirm: order={order_id} fee={marketplace_fee}")

            conn.commit()
            cur.close()
            conn.close()
            print(f"[PAYMENT-STATUS] Transaction paid: order={order_id}")
        except Exception as e:
            print(f"[PAYMENT-STATUS] DB update error: {e}")

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "payment_id": payment_id,
            "status": status,
            "paid": paid,
            "amount": result.get("Amount", 0),
        }),
    }