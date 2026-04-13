"""
Генерация токена для Agora RTC.
Используется временный токен (без сертификата) — для production нужен App Certificate.
"""
import os
import time
import json

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def ok(data, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(data)}

def err(msg, status=400):
    return {"statusCode": status, "headers": CORS, "body": json.dumps({"error": msg})}

def handler(event: dict, context) -> dict:
    """Генерирует временный токен для подключения к Agora каналу."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    app_id = os.environ.get("AGORA_APP_ID", "")
    if not app_id:
        return err("AGORA_APP_ID not configured", 500)

    qs = event.get("queryStringParameters") or {}
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    channel = qs.get("channel") or body.get("channel")
    uid = qs.get("uid") or body.get("uid", "0")

    if not channel:
        return err("channel required")

    # Без App Certificate используем пустой токен — Agora разрешает это в тестовом режиме
    # Для продакшена нужно добавить App Certificate и использовать RtcTokenBuilder
    return ok({
        "appId": app_id,
        "channel": channel,
        "uid": str(uid),
        "token": None,  # None = без токена (тестовый режим)
        "expires": int(time.time()) + 3600,
    })
