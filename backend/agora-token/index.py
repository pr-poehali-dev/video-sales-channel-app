"""
Генерация RTC-токена для Agora через официальную библиотеку agora-token-builder.
Токен действует 1 час.
"""
import os
import time
import json
from agora_token_builder import RtcTokenBuilder

Role_Publisher  = 1
Role_Subscriber = 2

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
    """Генерирует Agora RTC токен для вещателя или зрителя."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    app_id   = os.environ.get("AGORA_APP_ID", "")
    app_cert = os.environ.get("AGORA_APP_CERTIFICATE", "")

    if not app_id:
        return err("AGORA_APP_ID not configured", 500)
    if not app_cert:
        return err("AGORA_APP_CERTIFICATE not configured", 500)

    qs   = event.get("queryStringParameters") or {}
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    channel  = qs.get("channel") or body.get("channel")
    uid      = int(qs.get("uid") or body.get("uid") or 0)
    role_str = qs.get("role") or body.get("role", "subscriber")

    if not channel:
        return err("channel required")

    expire_at = int(time.time()) + 3600
    role = Role_Publisher if role_str == "publisher" else Role_Subscriber

    token = RtcTokenBuilder.buildTokenWithUid(
        app_id, app_cert, channel, uid, role, expire_at
    )

    return ok({
        "appId":   app_id,
        "channel": channel,
        "uid":     str(uid),
        "token":   token,
        "expires": expire_at,
    })