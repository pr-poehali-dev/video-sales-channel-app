"""
Store API — товары, эфиры, чат, отзывы, загрузка изображений в S3.
Все данные общие для всех пользователей через PostgreSQL.
"""
import json
import os
import uuid
import base64
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
    )

CDN_BASE = f"https://cdn.poehali.dev/projects/{os.environ.get('AWS_ACCESS_KEY_ID','')}/bucket"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
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

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs     = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    body   = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # ─────────── UPLOAD IMAGE ───────────
        if action == "upload_image":
            data_url = body.get("data_url", "")
            if not data_url.startswith("data:image/"):
                return err("invalid image data")
            # Парсим data URL
            header, encoded = data_url.split(",", 1)
            ext = header.split("/")[1].split(";")[0]  # jpeg, png, webp
            img_bytes = base64.b64decode(encoded)
            key = f"products/{uuid.uuid4().hex}.{ext}"
            s3 = get_s3()
            s3.put_object(
                Bucket="files",
                Key=key,
                Body=img_bytes,
                ContentType=f"image/{ext}",
            )
            url = f"{CDN_BASE}/{key}"
            return ok({"url": url})

        # ─────────── PRODUCTS ───────────
        if action == "get_products":
            seller_id = qs.get("seller_id")
            if seller_id:
                cur.execute("SELECT * FROM products WHERE seller_id=%s ORDER BY created_at DESC", (seller_id,))
            else:
                cur.execute("SELECT * FROM products ORDER BY created_at DESC")
            rows = cur.fetchall()
            return ok([_fmt_product(r) for r in rows])

        if action == "add_product":
            pid = f"prod_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO products (id,name,price,category,description,images,seller_id,seller_name,seller_avatar,in_stock)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (pid, body["name"], body["price"], body.get("category",""),
                  body.get("description",""), body.get("images",[]),
                  body["seller_id"], body["seller_name"], body.get("seller_avatar",""),
                  body.get("in_stock",99)))
            conn.commit()
            return ok(_fmt_product(cur.fetchone()), 201)

        if action == "update_product":
            pid = body.get("id") or qs.get("id")
            fields, vals = [], []
            for f in ("name","price","category","description","images","in_stock"):
                if f in body:
                    fields.append(f"{f}=%s")
                    vals.append(body[f])
            if not fields:
                return err("nothing to update")
            vals.append(pid)
            cur.execute(f"UPDATE products SET {', '.join(fields)} WHERE id=%s RETURNING *", vals)
            conn.commit()
            row = cur.fetchone()
            return ok(_fmt_product(row)) if row else err("not found", 404)

        if action == "delete_product":
            pid = body.get("id") or qs.get("id")
            cur.execute("UPDATE products SET in_stock=0 WHERE id=%s", (pid,))
            conn.commit()
            # Физически удаляем
            cur.execute("DELETE FROM products WHERE id=%s", (pid,))
            conn.commit()
            return ok({"ok": True})

        # ─────────── STREAMS ───────────
        if action == "get_streams":
            seller_id = qs.get("seller_id")
            if seller_id:
                cur.execute("SELECT * FROM streams WHERE seller_id=%s ORDER BY started_at DESC", (seller_id,))
            else:
                cur.execute("SELECT * FROM streams ORDER BY is_live DESC, started_at DESC")
            rows = cur.fetchall()
            return ok([_fmt_stream(r) for r in rows])

        if action == "add_stream":
            sid = f"stream_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO streams (id,title,seller_id,seller_name,seller_avatar,is_live,viewers)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (sid, body["title"], body["seller_id"], body["seller_name"],
                  body.get("seller_avatar",""), True, 0))
            conn.commit()
            return ok(_fmt_stream(cur.fetchone()), 201)

        if action == "update_stream":
            sid = body.get("id") or qs.get("id")
            is_live = body.get("is_live")
            duration = body.get("duration_sec")
            if is_live is False:
                cur.execute("""
                    UPDATE streams SET is_live=FALSE, ended_at=NOW(), duration_sec=%s
                    WHERE id=%s RETURNING *
                """, (duration, sid))
            else:
                fields, vals = [], []
                for f in ("title","viewers","is_live"):
                    if f in body:
                        fields.append(f"{f}=%s")
                        vals.append(body[f])
                if not fields:
                    return err("nothing to update")
                vals.append(sid)
                cur.execute(f"UPDATE streams SET {', '.join(fields)} WHERE id=%s RETURNING *", vals)
            conn.commit()
            row = cur.fetchone()
            return ok(_fmt_stream(row)) if row else err("not found", 404)

        # ─────────── CHAT ───────────
        if action == "get_chat":
            sid = qs.get("stream_id")
            if not sid:
                return err("stream_id required")
            cur.execute("""
                SELECT * FROM chat_messages WHERE stream_id=%s
                ORDER BY sent_at ASC LIMIT 200
            """, (sid,))
            rows = cur.fetchall()
            return ok([_fmt_chat(r) for r in rows])

        if action == "add_chat":
            mid = f"msg_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO chat_messages (id,stream_id,user_id,user_name,user_avatar,text)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (mid, body["stream_id"], body["user_id"], body["user_name"],
                  body.get("user_avatar",""), body["text"]))
            conn.commit()
            return ok(_fmt_chat(cur.fetchone()), 201)

        # ─────────── REVIEWS ───────────
        if action == "get_reviews":
            pid = qs.get("product_id")
            if not pid:
                return err("product_id required")
            cur.execute("SELECT * FROM reviews WHERE product_id=%s ORDER BY created_at DESC", (pid,))
            rows = cur.fetchall()
            # avg + count
            cur.execute("SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM reviews WHERE product_id=%s", (pid,))
            stat = cur.fetchone()
            return ok({
                "reviews": [_fmt_review(r) for r in rows],
                "avg": float(stat["avg"]) if stat["avg"] else 0,
                "count": int(stat["cnt"]),
            })

        if action == "add_review":
            # один отзыв на пользователя на товар
            cur.execute("SELECT id FROM reviews WHERE product_id=%s AND user_id=%s",
                        (body["product_id"], body["user_id"]))
            if cur.fetchone():
                return err("already reviewed", 409)
            rid = f"rev_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO reviews (id,product_id,user_id,user_name,user_avatar,rating,text)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (rid, body["product_id"], body["user_id"], body["user_name"],
                  body.get("user_avatar",""), int(body["rating"]), body.get("text","")))
            conn.commit()
            return ok(_fmt_review(cur.fetchone()), 201)

        return err("unknown action", 404)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()


def _fmt_product(r):
    return {
        "id":           r["id"],
        "name":         r["name"],
        "price":        float(r["price"]),
        "category":     r["category"],
        "description":  r["description"],
        "images":       list(r["images"] or []),
        "sellerId":     r["seller_id"],
        "sellerName":   r["seller_name"],
        "sellerAvatar": r["seller_avatar"],
        "inStock":      r["in_stock"],
        "createdAt":    r["created_at"].strftime("%d %B %Y") if r["created_at"] else "",
    }

def _fmt_stream(r):
    return {
        "id":           r["id"],
        "title":        r["title"],
        "sellerId":     r["seller_id"],
        "sellerName":   r["seller_name"],
        "sellerAvatar": r["seller_avatar"],
        "isLive":       r["is_live"],
        "viewers":      r["viewers"],
        "startedAt":    r["started_at"].strftime("%d %b %Y, %H:%M") if r["started_at"] else "",
        "endedAt":      r["ended_at"].isoformat() if r["ended_at"] else None,
        "duration":     r["duration_sec"],
    }

def _fmt_chat(r):
    return {
        "id":         r["id"],
        "streamId":   r["stream_id"],
        "userId":     r["user_id"],
        "userName":   r["user_name"],
        "userAvatar": r["user_avatar"],
        "text":       r["text"],
        "sentAt":     r["sent_at"].strftime("%H:%M") if r["sent_at"] else "",
    }

def _fmt_review(r):
    return {
        "id":         r["id"],
        "productId":  r["product_id"],
        "userId":     r["user_id"],
        "userName":   r["user_name"],
        "userAvatar": r["user_avatar"],
        "rating":     r["rating"],
        "text":       r["text"],
        "createdAt":  r["created_at"].strftime("%d %B %Y") if r["created_at"] else "",
    }