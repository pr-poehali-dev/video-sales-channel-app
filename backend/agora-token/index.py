"""
Генерация RTC-токена для Agora с использованием App Certificate.
Токен действует 1 час, после чего клиент должен получить новый.
"""
import os
import time
import json
import hmac
import hashlib
import struct
import base64
import zlib
import random

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def ok(data, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(data)}

def err(msg, status=400):
    return {"statusCode": status, "headers": CORS, "body": json.dumps({"error": msg})}

# ── Agora RTC Token Builder (AccessToken2) ────────────────────────────────────
# Реализация по спецификации Agora AccessToken2

ROLE_PUBLISHER  = 1
ROLE_SUBSCRIBER = 2

SERVICE_RTC = 1
PRIVILEGE_JOIN_CHANNEL       = 1
PRIVILEGE_PUBLISH_AUDIO      = 2
PRIVILEGE_PUBLISH_VIDEO      = 3
PRIVILEGE_PUBLISH_DATA       = 4
PRIVILEGE_SUBSCRIBE_AUDIO    = 5
PRIVILEGE_SUBSCRIBE_VIDEO    = 6
PRIVILEGE_SUBSCRIBE_DATA     = 7

def _pack_uint16(v):
    return struct.pack("<H", v)

def _pack_uint32(v):
    return struct.pack("<I", v)

def _pack_string(s):
    b = s.encode("utf-8")
    return _pack_uint16(len(b)) + b

def _pack_map_uint32(m):
    result = _pack_uint16(len(m))
    for k, v in sorted(m.items()):
        result += _pack_uint16(k) + _pack_uint32(v)
    return result

def build_token(app_id: str, app_cert: str, channel: str, uid, role: int, expire: int) -> str:
    uid_str = str(uid) if uid else "0"
    issued_at = int(time.time())
    expire_at = issued_at + expire

    # Salt — случайное число
    salt = random.randint(1, 2**31 - 1)

    # Привилегии в зависимости от роли
    if role == ROLE_PUBLISHER:
        privileges = {
            PRIVILEGE_JOIN_CHANNEL:   expire_at,
            PRIVILEGE_PUBLISH_AUDIO:  expire_at,
            PRIVILEGE_PUBLISH_VIDEO:  expire_at,
            PRIVILEGE_PUBLISH_DATA:   expire_at,
        }
    else:
        privileges = {
            PRIVILEGE_JOIN_CHANNEL:    expire_at,
            PRIVILEGE_SUBSCRIBE_AUDIO: expire_at,
            PRIVILEGE_SUBSCRIBE_VIDEO: expire_at,
            PRIVILEGE_SUBSCRIBE_DATA:  expire_at,
        }

    # Собираем сообщение для подписи
    msg  = _pack_uint32(salt)
    msg += _pack_uint32(issued_at)
    msg += _pack_uint32(expire_at)
    msg += _pack_string(channel)
    msg += _pack_string(uid_str)
    msg += _pack_map_uint32(privileges)

    # HMAC-SHA256
    signature = hmac.new(
        app_cert.encode("utf-8"),
        app_id.encode("utf-8") + msg,
        hashlib.sha256
    ).digest()

    # Итоговый токин = base64(zlib(VERSION + APP_ID + signature + msg))
    content = b"007" + app_id.encode("utf-8") + signature + msg
    compressed = zlib.compress(content)
    token = base64.b64encode(compressed).decode("utf-8")
    return token


def handler(event: dict, context) -> dict:
    """Генерирует Agora RTC токен с App Certificate для безопасного подключения."""
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

    channel = qs.get("channel") or body.get("channel")
    uid     = qs.get("uid") or body.get("uid") or "0"
    role    = ROLE_PUBLISHER if str(qs.get("role") or body.get("role", "")) == "publisher" else ROLE_SUBSCRIBER

    if not channel:
        return err("channel required")

    token = build_token(app_id, app_cert, channel, uid, role, expire=3600)

    return ok({
        "appId":   app_id,
        "channel": channel,
        "uid":     str(uid),
        "token":   token,
        "expires": int(time.time()) + 3600,
    })
