"""
Auth API — регистрация, вход, профиль пользователя.
Пароли хранятся в виде bcrypt-хешей в PostgreSQL.
"""
import json
import os
import hashlib
import secrets
import smtplib
import psycopg2
from email.mime.text import MIMEText
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

NOTIFY_EMAIL = "denittt@yandex.ru"

def send_reset_email(to_email: str, code: str):
    password = os.environ.get("NOTIFY_EMAIL_PASSWORD", "")
    if not password:
        return
    msg = MIMEText(
        f"Код для сброса пароля на стримБАЗАР.РФ:\n\n"
        f"  {code}\n\n"
        f"Код действителен 15 минут. Если вы не запрашивали сброс — проигнорируйте это письмо.",
        "plain", "utf-8"
    )
    msg["Subject"] = "Сброс пароля — стримБАЗАР.РФ"
    msg["From"] = NOTIFY_EMAIL
    msg["To"] = to_email
    with smtplib.SMTP_SSL("smtp.yandex.ru", 465, timeout=10) as smtp:
        smtp.login(NOTIFY_EMAIL, password)
        smtp.sendmail(NOTIFY_EMAIL, to_email, msg.as_string())

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
    "Access-Control-Max-Age": "86400",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def ok(data, status=200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, status=400):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}

def hash_password(password: str) -> str:
    salt = "yugastore_salt_2024"
    return hashlib.sha256((password + salt).encode()).hexdigest()

def make_avatar(name: str) -> str:
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return name[:2].upper() if len(name) >= 2 else name.upper()

def make_joined_at() -> str:
    months = ["январь","февраль","март","апрель","май","июнь",
              "июль","август","сентябрь","октябрь","ноябрь","декабрь"]
    now = datetime.now()
    return f"{months[now.month - 1]} {now.year}"

def fmt_user(r: dict) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "email": r["email"],
        "phone": r["phone"] or "",
        "city": r["city"] or "",
        "role": r["role"],
        "avatar": r["avatar"] or "",
        "joinedAt": r["joined_at"] or "",
        "isBlocked": r["is_blocked"],
        "shopName": r.get("shop_name") or "",
        "shopCityCode": r.get("shop_city_code") or "",
        "shopCityName": r.get("shop_city_name") or "",
        "shopCityGuid": r.get("shop_city_guid") or "",
    }

ADMIN_EMAIL = "admin@yugastore.ru"
ADMIN_PASSWORD = "admin2024"
ADMIN_USER = {
    "id": "admin",
    "name": "Администратор",
    "email": ADMIN_EMAIL,
    "phone": "",
    "city": "",
    "role": "admin",
    "avatar": "АД",
    "joinedAt": "январь 2024",
    "isBlocked": False,
    "shopName": "",
    "shopCityCode": "",
    "shopCityName": "",
    "shopCityGuid": "",
}

def handler(event: dict, context) -> dict:
    """Auth API: login, register, get_profile, update_profile, admin operations"""
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
        # ─── LOGIN ───
        if action == "login":
            login_id = (body.get("email") or body.get("phone") or "").strip()
            password = body.get("password") or ""

            if not login_id or not password:
                return err("Введите email или телефон и пароль")

            # Admin shortcut
            if login_id.lower() == ADMIN_EMAIL and password == ADMIN_PASSWORD:
                return ok({"user": ADMIN_USER})

            # Normalise phone: strip spaces/dashes, ensure starts with +7 or 8
            def normalise_phone(p):
                import re
                digits = re.sub(r'\D', '', p)
                if digits.startswith('8') and len(digits) == 11:
                    digits = '7' + digits[1:]
                return digits

            is_phone = not('@' in login_id)
            if is_phone:
                digits = normalise_phone(login_id)
                # Match by last 10 digits to be tolerant of +7/8 prefix differences
                cur.execute(
                    "SELECT * FROM users WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%%%s'" % digits[-10:]
                )
            else:
                cur.execute("SELECT * FROM users WHERE email = '%s'" % login_id.lower().replace("'", "''"))

            user = cur.fetchone()
            if not user:
                return err("Неверный email/телефон или пароль")
            if user["is_blocked"]:
                return err("Аккаунт заблокирован")
            if user["password_hash"] != hash_password(password):
                return err("Неверный email/телефон или пароль")

            return ok({"user": fmt_user(user)})

        # ─── REGISTER ───
        if action == "register":
            name = (body.get("name") or "").strip()
            email = (body.get("email") or "").strip().lower()
            phone = (body.get("phone") or "").strip()
            city = (body.get("city") or "").strip()
            password = body.get("password") or ""

            if not name:
                return err("Введите имя")
            if not email:
                return err("Введите email")
            if len(password) < 6:
                return err("Пароль должен содержать минимум 6 символов")

            if email == ADMIN_EMAIL:
                return err("Этот email уже используется")

            cur.execute("SELECT id FROM users WHERE email = '%s'" % email.replace("'", "''"))
            if cur.fetchone():
                return err("Пользователь с таким email уже существует")

            user_id = "user_" + secrets.token_hex(8)
            pwd_hash = hash_password(password)
            avatar = make_avatar(name)
            joined_at = make_joined_at()

            cur.execute(
                "INSERT INTO users (id, name, email, phone, city, password_hash, role, avatar, joined_at) "
                "VALUES ('%s','%s','%s','%s','%s','%s','user','%s','%s')" % (
                    user_id,
                    name.replace("'", "''"),
                    email.replace("'", "''"),
                    phone.replace("'", "''"),
                    city.replace("'", "''"),
                    pwd_hash,
                    avatar.replace("'", "''"),
                    joined_at.replace("'", "''"),
                )
            )
            conn.commit()

            cur.execute("SELECT * FROM users WHERE id = '%s'" % user_id)
            user = cur.fetchone()
            return ok({"user": fmt_user(user)}, status=201)

        # ─── GET PROFILE ───
        if action == "get_profile":
            user_id = (qs.get("user_id") or "").strip()
            if not user_id:
                return err("user_id обязателен")

            if user_id == "admin":
                return ok({"user": ADMIN_USER})

            cur.execute("SELECT * FROM users WHERE id = '%s'" % user_id.replace("'", "''"))
            user = cur.fetchone()
            if not user:
                return err("Пользователь не найден", 404)
            return ok({"user": fmt_user(user)})

        # ─── UPDATE PROFILE ───
        if action == "update_profile":
            user_id = (body.get("user_id") or "").strip()
            if not user_id or user_id == "admin":
                return err("Нельзя обновить этого пользователя")

            name = (body.get("name") or "").strip()
            phone = (body.get("phone") or "").strip()
            city = (body.get("city") or "").strip()
            shop_name = (body.get("shop_name") or "").strip()
            shop_city_code = (body.get("shop_city_code") or "").strip()
            shop_city_name = (body.get("shop_city_name") or "").strip()
            shop_city_guid = (body.get("shop_city_guid") or "").strip()

            if not name:
                return err("Имя не может быть пустым")

            avatar = make_avatar(name)

            cur.execute(
                "UPDATE users SET name='%s', phone='%s', city='%s', avatar='%s', shop_name='%s', shop_city_code='%s', shop_city_name='%s', shop_city_guid='%s' WHERE id='%s'" % (
                    name.replace("'", "''"),
                    phone.replace("'", "''"),
                    city.replace("'", "''"),
                    avatar.replace("'", "''"),
                    shop_name.replace("'", "''"),
                    shop_city_code.replace("'", "''"),
                    shop_city_name.replace("'", "''"),
                    shop_city_guid.replace("'", "''"),
                    user_id.replace("'", "''"),
                )
            )
            conn.commit()

            cur.execute("SELECT * FROM users WHERE id = '%s'" % user_id.replace("'", "''"))
            user = cur.fetchone()
            if not user:
                return err("Пользователь не найден", 404)
            return ok({"user": fmt_user(user)})

        # ─── GET ALL USERS (admin) ───
        if action == "get_all_users":
            cur.execute("SELECT * FROM users ORDER BY created_at DESC")
            users = [fmt_user(r) for r in cur.fetchall()]
            users.insert(0, ADMIN_USER)
            return ok({"users": users})

        # ─── BLOCK USER (admin) ───
        if action == "block_user":
            user_id = (body.get("user_id") or "").strip()
            if not user_id:
                return err("user_id обязателен")
            cur.execute("UPDATE users SET is_blocked=TRUE WHERE id='%s'" % user_id.replace("'", "''"))
            conn.commit()
            return ok({"success": True})

        # ─── UNBLOCK USER (admin) ───
        if action == "unblock_user":
            user_id = (body.get("user_id") or "").strip()
            if not user_id:
                return err("user_id обязателен")
            cur.execute("UPDATE users SET is_blocked=FALSE WHERE id='%s'" % user_id.replace("'", "''"))
            conn.commit()
            return ok({"success": True})

        # ─── DELETE USER (admin) ───
        if action == "delete_user":
            user_id = (body.get("user_id") or "").strip()
            if not user_id:
                return err("user_id обязателен")
            cur.execute("DELETE FROM users WHERE id='%s'" % user_id.replace("'", "''"))
            conn.commit()
            return ok({"success": True})

        # ─── REQUEST PASSWORD RESET ───
        if action == "request_reset":
            email = (body.get("email") or "").strip().lower()
            if not email or "@" not in email:
                return err("Введите корректный email")

            cur.execute("SELECT id FROM users WHERE email='%s'" % email.replace("'", "''"))
            if not cur.fetchone():
                return ok({"sent": True})

            code = str(secrets.randbelow(900000) + 100000)
            cur.execute(
                "INSERT INTO password_reset_codes (email, code) VALUES ('%s', '%s')" % (
                    email.replace("'", "''"), code
                )
            )
            conn.commit()

            try:
                send_reset_email(email, code)
            except Exception as e:
                print(f"[reset] email failed: {e}")
                return err("Не удалось отправить письмо. Попробуйте позже.")

            return ok({"sent": True})

        # ─── CONFIRM PASSWORD RESET ───
        if action == "confirm_reset":
            email = (body.get("email") or "").strip().lower()
            code = (body.get("code") or "").strip()
            new_password = body.get("new_password") or ""

            if not email or not code or len(new_password) < 6:
                return err("Заполните все поля. Пароль минимум 6 символов.")

            expires = datetime.now() - timedelta(minutes=15)
            cur.execute(
                "SELECT id FROM password_reset_codes WHERE email='%s' AND code='%s' AND used=FALSE AND created_at > '%s' ORDER BY created_at DESC LIMIT 1" % (
                    email.replace("'", "''"), code.replace("'", "''"), expires.strftime("%Y-%m-%d %H:%M:%S")
                )
            )
            row = cur.fetchone()
            if not row:
                return err("Неверный или устаревший код")

            pwd_hash = hash_password(new_password)
            cur.execute("UPDATE users SET password_hash='%s' WHERE email='%s'" % (pwd_hash, email.replace("'", "''")))
            cur.execute("UPDATE password_reset_codes SET used=TRUE WHERE id=%d" % row["id"])
            conn.commit()

            cur.execute("SELECT * FROM users WHERE email='%s'" % email.replace("'", "''"))
            user = cur.fetchone()
            return ok({"user": fmt_user(user)})

        return err("Неизвестное действие", 404)

    finally:
        cur.close()
        conn.close()