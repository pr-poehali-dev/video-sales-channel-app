import json
import os
import psycopg2
import psycopg2.extras
import urllib.request
import urllib.parse
import base64
import hashlib
import hmac
import time
import struct

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}

def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    psycopg2.extras.register_default_jsonb(conn)
    return conn

def ok(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}

def get_vapid_keys():
    """Получить VAPID ключи из env"""
    pub = os.environ.get("VAPID_PUBLIC_KEY", "")
    priv = os.environ.get("VAPID_PRIVATE_KEY", "")
    return pub, priv

def send_web_push(subscription: dict, payload: dict, vapid_private: str, vapid_public: str, contact_email: str = "admin@bazar.ru") -> bool:
    """Отправить Web Push через pywebpush-совместимый метод"""
    try:
        from py_vapid import Vapid
        from pywebpush import webpush, WebPushException
        
        endpoint = subscription.get("endpoint", "")
        keys = subscription.get("keys", {})
        
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {
                    "p256dh": keys.get("p256dh", ""),
                    "auth": keys.get("auth", ""),
                }
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=vapid_private,
            vapid_claims={"sub": f"mailto:{contact_email}"},
        )
        return True
    except Exception as e:
        print(f"[PUSH] send error: {e}")
        return False

def handler(event: dict, context) -> dict:
    """Управление Web Push уведомлениями продавцов — сохранение подписки и отправка"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    body = {}
    raw_body = event.get("body", "")
    if raw_body:
        try:
            body = json.loads(raw_body)
        except Exception:
            pass

    action = qs.get("action") or body.get("action", "")
    vapid_public, vapid_private = get_vapid_keys()

    # ── Получить публичный VAPID ключ (нужен фронтенду для подписки)
    if action == "get_vapid_key":
        if not vapid_public:
            return err("VAPID keys not configured", 503)
        return ok({"publicKey": vapid_public})

    # ── Сохранить подписку продавца
    if action == "save_subscription":
        user_id = body.get("user_id") or qs.get("user_id")
        subscription = body.get("subscription")
        if not user_id or not subscription:
            return err("user_id and subscription required")
        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            UPDATE sellers SET push_subscription = %s, push_enabled = true
            WHERE user_id = %s
        """, (json.dumps(subscription), user_id))
        conn.commit()
        conn.close()
        print(f"[PUSH] subscription saved for seller {user_id}")
        return ok({"ok": True})

    # ── Удалить подписку (отписаться)
    if action == "delete_subscription":
        user_id = body.get("user_id") or qs.get("user_id")
        if not user_id:
            return err("user_id required")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("UPDATE sellers SET push_subscription = NULL, push_enabled = false WHERE user_id = %s", (user_id,))
        conn.commit()
        conn.close()
        return ok({"ok": True})

    # ── Отправить push продавцу (вызывается из store-api при новом заказе)
    if action == "notify_seller":
        seller_id = body.get("seller_id")
        payload = body.get("payload", {})
        if not seller_id:
            return err("seller_id required")
        if not vapid_private or not vapid_public:
            return err("VAPID keys not configured", 503)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT push_subscription, push_enabled FROM sellers WHERE user_id = %s", (seller_id,))
        row = cur.fetchone()
        conn.close()

        if not row or not row["push_subscription"] or not row["push_enabled"]:
            print(f"[PUSH] seller {seller_id} has no subscription or push disabled")
            return ok({"ok": False, "reason": "no subscription"})

        sub = row["push_subscription"]
        if isinstance(sub, str):
            sub = json.loads(sub)

        success = send_web_push(sub, payload, vapid_private, vapid_public)
        return ok({"ok": success})

    return err("unknown action", 404)
