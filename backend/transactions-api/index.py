"""
API для управления таблицей transactions (финансовый учёт сделок маркетплейса).
Действия:
  GET  ?action=list            — список транзакций (только для admin)
  GET  ?action=get&order_id=X  — транзакция по заказу
  POST action=create           — создать/обновить транзакцию при оплате
  POST action=update_status    — сменить статус (paid/cancelled/refund)
  GET  ?action=report&from=YYYY-MM-DD&to=YYYY-MM-DD — отчёт по комиссиям для бухгалтерии
"""
import json
import os
import psycopg2
from datetime import datetime, timezone

SCHEMA = "t_p63706319_video_sales_channel_"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
        "Content-Type": "application/json",
    }


def ok(data):
    return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(data, default=str)}


def err(msg, code=400):
    return {"statusCode": code, "headers": cors_headers(), "body": json.dumps({"error": msg})}


def handler(event: dict, context) -> dict:
    """Управление финансовыми транзакциями маркетплейса."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── GET: список всех транзакций (для отчёта/админки) ─────────────────
        if method == "GET" and action == "list":
            page = int(params.get("page", 1))
            limit = int(params.get("limit", 50))
            status_filter = params.get("status", "")
            offset = (page - 1) * limit

            where = ""
            if status_filter:
                where = f"WHERE status = '{status_filter}'"

            cur.execute(f"""
                SELECT id, order_id, seller_id, merchant_id,
                       full_amount, seller_amount, marketplace_fee,
                       hold_date, status, payment_id, delivery_confirm,
                       error_message, paid_at, cancelled_at, created_at, updated_at
                FROM "{SCHEMA}".transactions
                {where}
                ORDER BY created_at DESC
                LIMIT {limit} OFFSET {offset}
            """)
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]

            cur.execute(f'SELECT COUNT(*) FROM "{SCHEMA}".transactions {where}')
            total = cur.fetchone()[0]

            return ok({"transactions": rows, "total": total, "page": page, "limit": limit})

        # ── GET: транзакция по order_id ───────────────────────────────────────
        if method == "GET" and action == "get":
            order_id = params.get("order_id", "")
            if not order_id:
                return err("Укажите order_id")

            cur.execute(f"""
                SELECT id, order_id, seller_id, merchant_id,
                       full_amount, seller_amount, marketplace_fee,
                       hold_date, status, payment_id, delivery_confirm,
                       error_message, paid_at, cancelled_at, created_at, updated_at
                FROM "{SCHEMA}".transactions
                WHERE order_id = '{order_id}'
                LIMIT 1
            """)
            row = cur.fetchone()
            if not row:
                return ok({"transaction": None})

            cols = [d[0] for d in cur.description]
            return ok({"transaction": dict(zip(cols, row))})

        # ── GET: отчёт по комиссиям за период ────────────────────────────────
        if method == "GET" and action == "report":
            from_date = params.get("from", "")
            to_date = params.get("to", "")

            date_filter = "WHERE status IN ('paid', 'refund')"
            if from_date:
                date_filter += f" AND created_at >= '{from_date}'"
            if to_date:
                date_filter += f" AND created_at <= '{to_date} 23:59:59'"

            cur.execute(f"""
                SELECT
                    id, order_id, seller_id,
                    full_amount, seller_amount, marketplace_fee,
                    status, payment_id, created_at, paid_at
                FROM "{SCHEMA}".transactions
                {date_filter}
                ORDER BY created_at DESC
            """)
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]

            cur.execute(f"""
                SELECT
                    COUNT(*) as total_orders,
                    COALESCE(SUM(full_amount), 0) as total_turnover,
                    COALESCE(SUM(marketplace_fee), 0) as total_fee,
                    COALESCE(SUM(seller_amount), 0) as total_seller_payout
                FROM "{SCHEMA}".transactions
                {date_filter}
            """)
            summary_row = cur.fetchone()
            summary = {
                "total_orders": summary_row[0],
                "total_turnover": float(summary_row[1]),
                "total_fee": float(summary_row[2]),
                "total_seller_payout": float(summary_row[3]),
            }

            return ok({"rows": rows, "summary": summary, "from": from_date, "to": to_date})

        # ── POST: создать транзакцию при оплате ──────────────────────────────
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            action_post = body.get("action", action)

            if action_post == "create":
                order_id    = body.get("order_id", "")
                seller_id   = body.get("seller_id", "")
                merchant_id = body.get("merchant_id", "")
                full_amount = float(body.get("full_amount", 0))
                payment_id  = body.get("payment_id", "")
                status      = body.get("status", "hold")
                error_msg   = body.get("error_message", "")

                if not order_id:
                    return err("Укажите order_id")

                fee_pct         = 0.0
                marketplace_fee = 0.0
                seller_amount   = round(full_amount, 2)
                hold_date       = datetime.now(timezone.utc).isoformat()

                # upsert — обновляем если уже есть
                cur.execute(f"""
                    INSERT INTO "{SCHEMA}".transactions
                        (order_id, seller_id, merchant_id, full_amount, seller_amount,
                         marketplace_fee, hold_date, status, payment_id, error_message, updated_at)
                    VALUES (
                        '{order_id}', '{seller_id}', '{merchant_id}', {full_amount}, {seller_amount},
                        {marketplace_fee}, '{hold_date}', '{status}', '{payment_id}',
                        '{error_msg.replace("'", "''")}', now()
                    )
                    ON CONFLICT (order_id) DO UPDATE SET
                        status          = EXCLUDED.status,
                        payment_id      = EXCLUDED.payment_id,
                        full_amount     = EXCLUDED.full_amount,
                        seller_amount   = EXCLUDED.seller_amount,
                        marketplace_fee = EXCLUDED.marketplace_fee,
                        error_message   = EXCLUDED.error_message,
                        updated_at      = now()
                """)
                conn.commit()
                return ok({"ok": True, "marketplace_fee": marketplace_fee, "seller_amount": seller_amount})

            if action_post == "update_status":
                order_id   = body.get("order_id", "")
                new_status = body.get("status", "")
                delivery_confirm = body.get("delivery_confirm", "")

                if not order_id or not new_status:
                    return err("Укажите order_id и status")

                extra = ""
                if new_status == "paid":
                    extra = ", paid_at = now()"
                elif new_status in ("cancelled", "refund"):
                    extra = ", cancelled_at = now()"

                deliver_sql = ""
                if delivery_confirm:
                    deliver_sql = f", delivery_confirm = '{delivery_confirm.replace(chr(39), chr(39)*2)}'"

                cur.execute(f"""
                    UPDATE "{SCHEMA}".transactions
                    SET status = '{new_status}', updated_at = now() {extra} {deliver_sql}
                    WHERE order_id = '{order_id}'
                """)
                conn.commit()
                return ok({"ok": True})

        return err("Неизвестное действие")

    finally:
        cur.close()
        conn.close()