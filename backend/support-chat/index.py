"""
Support Chat API — чат поддержки между пользователями и администратором.
"""
import json
import os
import uuid
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor

NOTIFY_TO = "denittt@yandex.ru"
NOTIFY_FROM = "denittt@yandex.ru"

def send_email_notify(user_name: str, text: str, chat_id: str):
    password = os.environ.get("NOTIFY_EMAIL_PASSWORD", "")
    if not password:
        return
    try:
        msg = MIMEText(
            f"Новое сообщение в чате поддержки\n\n"
            f"От: {user_name}\n"
            f"Сообщение: {text}\n\n"
            f"Chat ID: {chat_id}",
            "plain", "utf-8"
        )
        msg["Subject"] = f"💬 Новое сообщение от {user_name}"
        msg["From"] = NOTIFY_FROM
        msg["To"] = NOTIFY_TO
        with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=10) as smtp:
            smtp.login(NOTIFY_FROM, password)
            smtp.sendmail(NOTIFY_FROM, NOTIFY_TO, msg.as_string())
    except Exception as e:
        print(f"[email] notify failed: {e}")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data, status=200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, status=400):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}

def fmt_chat(r):
    return {
        "id": r["id"],
        "userId": r["user_id"],
        "userName": r["user_name"],
        "userAvatar": r["user_avatar"],
        "lastMessage": r["last_message"],
        "lastMessageAt": r["last_message_at"].isoformat() if r["last_message_at"] else None,
        "unreadAdmin": r["unread_admin"],
        "unreadUser": r["unread_user"],
        "status": r["status"],
        "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
    }

def fmt_msg(r):
    return {
        "id": r["id"],
        "chatId": r["chat_id"],
        "senderRole": r["sender_role"],
        "senderName": r["sender_name"],
        "text": r["text"],
        "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
    }

def handler(event: dict, context) -> dict:
    """Чат поддержки: получение/отправка сообщений для пользователей и администратора."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Получить или создать чат для пользователя
        if action == "get_or_create_chat":
            user_id = body.get("user_id") or qs.get("user_id")
            user_name = body.get("user_name", "Пользователь")
            user_avatar = body.get("user_avatar", "")
            if not user_id:
                return err("user_id required")

            cur.execute("SELECT * FROM support_chats WHERE user_id=%s ORDER BY created_at DESC LIMIT 1", (user_id,))
            row = cur.fetchone()
            if row:
                return ok(fmt_chat(row))

            chat_id = f"chat_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO support_chats (id, user_id, user_name, user_avatar)
                VALUES (%s, %s, %s, %s) RETURNING *
            """, (chat_id, user_id, user_name, user_avatar))
            conn.commit()
            return ok(fmt_chat(cur.fetchone()), 201)

        # Получить сообщения чата
        if action == "get_messages":
            chat_id = qs.get("chat_id") or body.get("chat_id")
            reader_role = qs.get("role", "user")
            if not chat_id:
                return err("chat_id required")

            # Сбрасываем счётчик непрочитанных
            if reader_role == "admin":
                cur.execute("UPDATE support_chats SET unread_admin=0 WHERE id=%s", (chat_id,))
            else:
                cur.execute("UPDATE support_chats SET unread_user=0 WHERE id=%s", (chat_id,))
            conn.commit()

            cur.execute("SELECT * FROM support_messages WHERE chat_id=%s ORDER BY created_at ASC", (chat_id,))
            rows = cur.fetchall()
            return ok([fmt_msg(r) for r in rows])

        # Отправить сообщение
        if action == "send_message":
            chat_id = body.get("chat_id")
            sender_role = body.get("sender_role", "user")  # "user" | "admin"
            sender_name = body.get("sender_name", "")
            text = body.get("text", "").strip()
            if not chat_id or not text:
                return err("chat_id and text required")

            msg_id = f"msg_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO support_messages (id, chat_id, sender_role, sender_name, text)
                VALUES (%s, %s, %s, %s, %s) RETURNING *
            """, (msg_id, chat_id, sender_role, sender_name, text))

            # Обновляем чат: последнее сообщение + счётчик непрочитанных
            if sender_role == "admin":
                cur.execute("""
                    UPDATE support_chats
                    SET last_message=%s, last_message_at=NOW(), unread_user=unread_user+1
                    WHERE id=%s
                """, (text[:100], chat_id))
            else:
                cur.execute("""
                    UPDATE support_chats
                    SET last_message=%s, last_message_at=NOW(), unread_admin=unread_admin+1, status='open'
                    WHERE id=%s
                """, (text[:100], chat_id))

            conn.commit()
            saved = cur.fetchone()

            # Уведомление на почту при сообщении от пользователя
            if sender_role == "user":
                send_email_notify(sender_name or "Пользователь", text, chat_id)

            return ok(fmt_msg(saved), 201)

        # Получить все чаты (для админа)
        if action == "get_all_chats":
            cur.execute("SELECT * FROM support_chats ORDER BY last_message_at DESC")
            rows = cur.fetchall()
            return ok([fmt_chat(r) for r in rows])

        # Закрыть/открыть чат (для админа)
        if action == "set_status":
            chat_id = body.get("chat_id")
            status = body.get("status", "closed")
            if not chat_id:
                return err("chat_id required")
            cur.execute("UPDATE support_chats SET status=%s WHERE id=%s RETURNING *", (status, chat_id))
            conn.commit()
            row = cur.fetchone()
            return ok(fmt_chat(row)) if row else err("not found", 404)

        return err("unknown action", 404)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()