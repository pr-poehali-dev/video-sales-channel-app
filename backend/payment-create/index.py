"""
Создание платежа через Т-Банк (Tinkoff Acquiring API).
Поддерживает Мультирасчёты (marketplace): автоматически делит платёж между продавцом и площадкой.
Реквизиты продавца определяются по legal_type из его профиля:
  - individual / self_employed → карта (cardNumber)
  - ip / ooo                  → расчётный счёт (bankAccount + bik)
Возвращает PaymentURL для перенаправления покупателя.
"""
import json
import os
import hashlib
import urllib.request
import psycopg2
import psycopg2.extras


TBANK_API = "https://securepay.tinkoff.ru/v2"
SCHEMA = "t_p63706319_video_sales_channel_"


def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn


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
    """Создаёт платёж в Т-Банк с реквизитами продавца по его типу (физлицо/самозанятый → карта, ИП/ООО → счёт)."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    order_id    = body.get("order_id", "")
    amount      = body.get("amount")
    description = body.get("description", "Заказ в СтримБазар")
    return_url  = body.get("return_url", "https://стримбазар.рф/")
    items       = body.get("items", [])
    delivery_cost = float(body.get("delivery_cost", 0))
    email = body.get("email", "").strip()
    phone = body.get("phone", "").strip()

    if not amount or float(amount) <= 0:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Укажите сумму платежа"})}

    amount_kopecks = int(float(amount) * 100)

    # ── Шаг 1: получаем реквизиты продавца из заказа ДО формирования payload ──
    seller_id_val  = ""
    legal_type     = ""
    requisites     = {}
    multimarket_enabled = os.environ.get("TBANK_MULTIMARKET_ENABLED", "false").lower() == "true"

    if order_id:
        try:
            conn = get_conn()
            cur  = conn.cursor()
            cur.execute(
                f'SELECT seller_id, seller_legal_type, seller_requisites FROM "{SCHEMA}".orders WHERE id=%s',
                (order_id,)
            )
            row = cur.fetchone()
            if row:
                seller_id_val = row["seller_id"] or ""
                legal_type    = row["seller_legal_type"] or ""
                requisites    = row["seller_requisites"] or {}
            cur.close()
            conn.close()
        except Exception as e:
            print(f"[PAYMENT] Failed to load seller requisites: {e}")

    # ── Шаг 2: формируем базовый payload ──
    payload = {
        "OrderId": order_id,
        "Amount": amount_kopecks,
        "Description": description,
        "SuccessURL": return_url,
        "FailURL": return_url,
    }

    # Receipt — только если есть email или телефон (Т-Банк требует хотя бы одно)
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

    # ── Шаг 3: мультирасчёты с правильными реквизитами по типу продавца ──
    if seller_id_val and multimarket_enabled and legal_type:
        payout_method = requisites.get("payoutMethod", "")
        card_number   = requisites.get("cardNumber", "")
        bank_account  = requisites.get("bankAccount", "")
        bik           = requisites.get("bik", "")
        corr_account  = requisites.get("corrAccount", "")
        bank_name     = requisites.get("bankName", "")

        # Физлицо и самозанятый — выплата на карту
        if legal_type in ("individual", "self_employed") and card_number:
            shop_entry = {
                "ShopCode": seller_id_val,
                "Amount":   amount_kopecks,
                "Name":     description,
                "PayoutDetails": {
                    "Type":       "Card",
                    "CardNumber": card_number,
                },
            }
            payload["Shops"] = [shop_entry]
            print(f"[PAYMENT] Multimarket: type={legal_type} → Card *{card_number[-4:]}")

        # ИП и ООО — выплата на расчётный счёт
        elif legal_type in ("ip", "ooo") and bank_account and bik:
            shop_entry = {
                "ShopCode": seller_id_val,
                "Amount":   amount_kopecks,
                "Name":     description,
                "PayoutDetails": {
                    "Type":        "Account",
                    "Account":     bank_account,
                    "BankBik":     bik,
                    "CorrAccount": corr_account,
                    "BankName":    bank_name,
                },
            }
            payload["Shops"] = [shop_entry]
            print(f"[PAYMENT] Multimarket: type={legal_type} → Account {bank_account[:6]}... BIK={bik}")

        else:
            print(f"[PAYMENT] Multimarket skipped: type={legal_type} missing requisites (payout={payout_method})")
    else:
        if legal_type:
            print(f"[PAYMENT] Multimarket disabled or no seller. type={legal_type} enabled={multimarket_enabled}")

    # ── Шаг 4: отправляем в Т-Банк ──
    print(f"[PAYMENT] Init payload: {json.dumps(payload, ensure_ascii=False)}")
    result = tbank_request("Init", payload)
    print(f"[PAYMENT] Init result: {json.dumps(result, ensure_ascii=False)}")

    if not result.get("Success"):
        return {
            "statusCode": 400,
            "headers": headers,
            "body": json.dumps({"error": result.get("Message", "Ошибка создания платежа"), "details": result}),
        }

    payment_id  = result.get("PaymentId")
    payment_url = result.get("PaymentURL")

    # ── Шаг 5: сохраняем payment_id в заказ + транзакцию ──
    if order_id and payment_id:
        try:
            conn = get_conn()
            cur  = conn.cursor()

            cur.execute(
                f'UPDATE "{SCHEMA}".orders SET tbank_payment_id=%s, payment_method=\'tbank\' WHERE id=%s',
                (str(payment_id), order_id),
            )

            cur.execute(
                f'SELECT order_total FROM "{SCHEMA}".orders WHERE id=%s',
                (order_id,),
            )
            order_row = cur.fetchone()
            if order_row:
                full_amount     = float(order_row["order_total"] or amount)
                marketplace_fee = 0.0
                seller_payout   = round(full_amount, 2)

                cur.execute(f"""
                    INSERT INTO "{SCHEMA}".transactions
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
                """, (order_id, seller_id_val, full_amount, seller_payout, marketplace_fee, str(payment_id)))

                print(f"[PAYMENT] Transaction saved: order={order_id} legal_type={legal_type} amount={full_amount}")

            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"[PAYMENT] DB save error: {e}")

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "payment_id": payment_id,
            "payment_url": payment_url,
            "status": result.get("Status"),
        }),
    }
