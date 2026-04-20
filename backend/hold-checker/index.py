"""
Cron-функция: проверяет транзакции со статусом 'hold' старше 7 дней.
Если продавец не поменял статус заказа на 'shipped'/'delivered' — отправляет Cancel в Т-Банк
и переводит транзакцию в статус 'cancelled'.
Запускать раз в сутки через cron/scheduler.
"""
import json
import os
import hashlib
import urllib.request
import psycopg2

SCHEMA = "t_p63706319_video_sales_channel_"
TBANK_API = "https://securepay.tinkoff.ru/v2"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def tbank_token(params: dict, password: str) -> str:
    data = {**params, "Password": password}
    pairs = sorted(data.items())
    values = "".join(str(v) for _, v in pairs if not isinstance(v, (dict, list)))
    return hashlib.sha256(values.encode()).hexdigest()


def tbank_cancel(payment_id: str) -> dict:
    terminal_key = os.environ.get("TBANK_TERMINAL_KEY", "TinkoffBankTest")
    secret_key   = os.environ.get("TBANK_SECRET_KEY", "TinkoffBankTest")
    payload = {"PaymentId": payment_id, "TerminalKey": terminal_key}
    payload["Token"] = tbank_token(payload, secret_key)
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{TBANK_API}/Cancel",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"Success": False, "error": str(e)}


def handler(event: dict, context) -> dict:
    """
    Авто-проверка просроченных холдов (7 суток).
    Отменяет платёж в Т-Банке и обновляет статус транзакции/заказа.
    """
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    conn = get_conn()
    cur = conn.cursor()

    try:
        # Ищем все холды старше 7 дней с непустым payment_id
        cur.execute(f"""
            SELECT t.id, t.order_id, t.payment_id, t.full_amount,
                   o.seller_status
            FROM "{SCHEMA}".transactions t
            LEFT JOIN "{SCHEMA}".orders o ON o.id = t.order_id
            WHERE t.status = 'hold'
              AND t.hold_date IS NOT NULL
              AND t.hold_date < now() - INTERVAL '7 days'
              AND t.payment_id != ''
        """)
        expired = cur.fetchall()
        print(f"[HOLD-CHECKER] Просроченных холдов: {len(expired)}")

        cancelled = []
        skipped   = []

        for row in expired:
            txn_id, order_id, payment_id, full_amount, seller_status = row

            # Если продавец успел сменить статус — пропускаем
            if seller_status in ("shipped", "delivered"):
                skipped.append(order_id)
                print(f"[HOLD-CHECKER] Пропускаем {order_id} — статус продавца: {seller_status}")
                continue

            print(f"[HOLD-CHECKER] Отменяем платёж {payment_id} для заказа {order_id}")
            result = tbank_cancel(payment_id)
            print(f"[HOLD-CHECKER] Ответ Т-Банк: {json.dumps(result, ensure_ascii=False)}")

            if result.get("Success"):
                cur.execute(f"""
                    UPDATE "{SCHEMA}".transactions
                    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
                    WHERE id = '{txn_id}'
                """)
                cur.execute(f"""
                    UPDATE "{SCHEMA}".orders
                    SET status = 'cancelled'
                    WHERE id = '{order_id}'
                """)
                cancelled.append(order_id)
            else:
                error_msg = result.get("Message", result.get("error", "unknown"))
                cur.execute(f"""
                    UPDATE "{SCHEMA}".transactions
                    SET error_message = '{error_msg.replace("'", "''")}', updated_at = now()
                    WHERE id = '{txn_id}'
                """)
                print(f"[HOLD-CHECKER] Ошибка отмены {order_id}: {error_msg}")

        conn.commit()

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "checked": len(expired),
                "cancelled": cancelled,
                "skipped": skipped,
            }),
        }

    finally:
        cur.close()
        conn.close()
