"""
Store API — товары, эфиры, чат, отзывы, загрузка изображений в S3.
Все данные общие для всех пользователей через PostgreSQL.
"""
import json
import os
import uuid
import re
import base64
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

# ── Автофильтр матов ─────────────────────────────────────────────────────────
_BAD_WORDS = [
    "хуй","хуя","хуе","хуи","хуём","хую","хуйня","хуйло","хуйню",
    "пизд","пизда","пизду","пиздец","пиздёж","пиздить","пиздатый",
    "ёбан","ёбаный","ёб твою","ёб","еб","ебать","ебёт","ебут","ебал","ебла",
    "ёбаный","ёблан",
    "блядь","блядина","блядство","бляд","блять",
    "мудак","мудила","мудило",
    "залупа","залупу",
    "сука","суки","суку","сукин",
    "пидор","пидорас","пидрила",
    "шлюха","шлюхи","шлюху",
    "долбоёб","долбоеб","долбоёбы",
    "дрочить","дрочит","дрочун",
    "выёбываться","выёбывается",
    "нахуй","нахуе","похуй","похую","похуй",
    "заебал","заебала","заебали","заебись",
    "ёбнуть","ёбнул","ёбнулся",
    "блядский","пиздатый","пиздливый",
]

def _contains_bad_words(text: str) -> bool:
    t = text.lower()
    t = re.sub(r"[0@]", "о", t)
    t = re.sub(r"[3]", "е", t)
    t = re.sub(r"[4]", "ч", t)
    t = re.sub(r"[6]", "б", t)
    t = re.sub(r"[!1]", "и", t)
    for w in _BAD_WORDS:
        if w in t:
            return True
    return False

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

def _fmt_warehouse(r) -> dict:
    return {
        "id": r["id"],
        "sellerId": r["seller_id"],
        "name": r["name"],
        "cityCode": r["city_code"],
        "cityName": r["city_name"],
        "address": r["address"],
        "isDefault": r["is_default"],
        "createdAt": str(r["created_at"]),
    }

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

        # ─────────── UPLOAD VIDEO ───────────
        # Принимаем base64 data_url — браузер кодирует видео и отправляет
        # Таймаут функции должен быть 120+ секунд для больших файлов
        if action == "upload_video":
            data_url = body.get("data_url", "")
            if not data_url.startswith("data:video/"):
                return err("invalid video data")
            header, encoded = data_url.split(",", 1)
            mime = header.split(";")[0].replace("data:", "")
            ext = mime.split("/")[1].split("+")[0]
            video_bytes = base64.b64decode(encoded)
            key = f"streams/{uuid.uuid4().hex}.{ext}"
            s3 = get_s3()
            s3.put_object(Bucket="files", Key=key, Body=video_bytes, ContentType=mime)
            cdn_url = f"{CDN_BASE}/{key}"
            stream_id = body.get("stream_id")
            if stream_id:
                cur.execute("UPDATE streams SET video_url=%s WHERE id=%s", (cdn_url, stream_id))
                conn.commit()
            return ok({"url": cdn_url})

        # ─────────── PRESIGNED URL для загрузки видео ───────────
        if action == "get_video_upload_url":
            stream_id = body.get("stream_id") or qs.get("stream_id")
            mime = body.get("mime", "video/webm")
            ext = mime.split("/")[1].split(";")[0]
            key = f"streams/{uuid.uuid4().hex}.{ext}"
            s3 = get_s3()
            presigned = s3.generate_presigned_url(
                "put_object",
                Params={"Bucket": "files", "Key": key, "ContentType": mime},
                ExpiresIn=3600,
            )
            cdn_url = f"{CDN_BASE}/{key}"
            return ok({"upload_url": presigned, "cdn_url": cdn_url, "key": key, "stream_id": stream_id})

        # ─────────── Сохранить video_url у стрима ───────────
        if action == "set_video_url":
            stream_id = body.get("stream_id")
            video_url = body.get("video_url")
            if not stream_id or not video_url:
                return err("stream_id and video_url required")
            cur.execute("UPDATE streams SET video_url=%s WHERE id=%s", (video_url, stream_id))
            conn.commit()
            return ok({"ok": True})

        # ─────────── SELLERS ───────────
        if action == "get_seller_profile":
            user_id = qs.get("user_id") or body.get("user_id")
            if not user_id:
                return err("user_id required")
            cur.execute("SELECT * FROM sellers WHERE user_id=%s", (user_id,))
            row = cur.fetchone()
            return ok(_fmt_seller(row) if row else None)

        if action == "save_seller_profile":
            user_id = body.get("user_id")
            if not user_id:
                return err("user_id required")
            cur.execute("SELECT user_id FROM sellers WHERE user_id=%s", (user_id,))
            exists = cur.fetchone()
            fields = ["legal_type","legal_name","inn","bank_account","bank_name","bik",
                      "contact_phone","contact_email","cdek_id","agreed_offer","agreed_pd"]
            if exists:
                set_parts = [f"{f}=%s" for f in fields if f in body]
                vals = [body[f] for f in fields if f in body]
                if set_parts:
                    vals.append(user_id)
                    cur.execute(f"UPDATE sellers SET {', '.join(set_parts)} WHERE user_id=%s", vals)
            else:
                cur.execute("""
                    INSERT INTO sellers (user_id,legal_type,legal_name,inn,bank_account,bank_name,bik,
                                        contact_phone,contact_email,cdek_id,agreed_offer,agreed_pd)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (user_id,
                      body.get("legal_type","individual"), body.get("legal_name",""),
                      body.get("inn",""), body.get("bank_account",""), body.get("bank_name",""),
                      body.get("bik",""), body.get("contact_phone",""), body.get("contact_email",""),
                      body.get("cdek_id",""), body.get("agreed_offer",False), body.get("agreed_pd",False)))
            conn.commit()
            cur.execute("SELECT * FROM sellers WHERE user_id=%s", (user_id,))
            return ok(_fmt_seller(cur.fetchone()))

        # ─────────── ORDERS ───────────
        if action == "create_order":
            oid = f"order_{uuid.uuid4().hex[:12]}"
            items = body.get("items", [])
            goods_total = sum(i.get("price",0) * i.get("qty",1) for i in items)
            delivery_cost = float(body.get("delivery_cost", 0))
            order_total = goods_total + delivery_cost
            cur.execute("""
                INSERT INTO orders (id,buyer_id,buyer_name,buyer_phone,buyer_email,
                    delivery_type,delivery_city_code,delivery_city_name,delivery_address,
                    delivery_tariff_code,delivery_tariff_name,delivery_cost,
                    items,goods_total,order_total,status,payment_method)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
            """, (oid, body.get("buyer_id",""), body.get("buyer_name",""),
                  body.get("buyer_phone",""), body.get("buyer_email",""),
                  body.get("delivery_type","cdek_pvz"),
                  body.get("delivery_city_code"), body.get("delivery_city_name",""),
                  body.get("delivery_address",""), body.get("delivery_tariff_code"),
                  body.get("delivery_tariff_name",""), delivery_cost,
                  json.dumps(items, ensure_ascii=False), goods_total, order_total,
                  "new", body.get("payment_method","")))
            conn.commit()
            return ok({"ok": True, "order_id": oid, "order_total": order_total}, 201)

        if action == "get_orders":
            buyer_id = qs.get("buyer_id") or body.get("buyer_id")
            if buyer_id:
                cur.execute("SELECT * FROM orders WHERE buyer_id=%s ORDER BY created_at DESC", (buyer_id,))
            else:
                cur.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100")
            rows = cur.fetchall()
            return ok([_fmt_order(r) for r in rows])

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
            safe_images = _clean_images(body.get("images", []))
            cur.execute("""
                INSERT INTO products (id,name,price,category,description,images,seller_id,seller_name,seller_avatar,
                    in_stock,weight_g,length_cm,width_cm,height_cm,cdek_enabled,nalog_enabled,fitting_enabled,
                    from_city_code,from_city_name)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (pid, body["name"], body["price"], body.get("category",""),
                  body.get("description",""), safe_images,
                  body["seller_id"], body["seller_name"], body.get("seller_avatar",""),
                  body.get("in_stock",1),
                  body.get("weight_g",500), body.get("length_cm",20),
                  body.get("width_cm",15), body.get("height_cm",10),
                  body.get("cdek_enabled",True), body.get("nalog_enabled",False),
                  body.get("fitting_enabled",False),
                  body.get("from_city_code",0), body.get("from_city_name","")))
            conn.commit()
            return ok(_fmt_product(cur.fetchone()), 201)

        if action == "update_product":
            pid = body.get("id") or qs.get("id")
            fields, vals = [], []
            for f in ("name","price","category","description","images","in_stock",
                      "weight_g","length_cm","width_cm","height_cm",
                      "cdek_enabled","nalog_enabled","fitting_enabled",
                      "from_city_code","from_city_name"):
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

        # ─────────── THUMBNAIL ───────────
        if action == "upload_thumbnail":
            stream_id = body.get("stream_id")
            data_url  = body.get("data_url", "")
            if not stream_id or not data_url.startswith("data:image/"):
                return err("stream_id and image data_url required")
            header, encoded = data_url.split(",", 1)
            ext = header.split("/")[1].split(";")[0]
            img_bytes = base64.b64decode(encoded)
            key = f"thumbnails/{stream_id}.{ext}"
            s3 = get_s3()
            s3.put_object(Bucket="files", Key=key, Body=img_bytes, ContentType=f"image/{ext}")
            url = f"{CDN_BASE}/{key}"
            cur.execute("UPDATE streams SET thumbnail=%s WHERE id=%s", (url, stream_id))
            conn.commit()
            return ok({"url": url})

        # ─────────── STREAMS ───────────
        if action == "get_streams":
            seller_id = qs.get("seller_id")
            if seller_id:
                cur.execute("SELECT * FROM streams WHERE seller_id=%s AND hidden=false ORDER BY started_at DESC", (seller_id,))
            else:
                cur.execute("SELECT * FROM streams WHERE hidden=false ORDER BY is_live DESC, started_at DESC")
            rows = cur.fetchall()
            return ok([_fmt_stream(r) for r in rows])

        if action == "add_stream":
            cur.execute(
                "UPDATE streams SET is_live=FALSE, ended_at=NOW() WHERE seller_id=%s AND is_live=TRUE",
                (body["seller_id"],)
            )
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

        if action == "delete_stream":
            sid = body.get("id") or qs.get("id")
            if not sid:
                return err("id required")
            cur.execute("UPDATE streams SET hidden=TRUE WHERE id=%s", (sid,))
            conn.commit()
            return ok({"ok": True})

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
            # Проверка блокировки
            cur.execute("""
                SELECT 1 FROM chat_bans
                WHERE stream_id=%s AND user_id=%s
            """, (body["stream_id"], body["user_id"]))
            if cur.fetchone():
                return err("Вы заблокированы в этом эфире", 403)
            # Фильтр матов
            text = body["text"]
            if _contains_bad_words(text):
                return err("Сообщение содержит недопустимые слова", 400)
            mid = f"msg_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO chat_messages (id,stream_id,user_id,user_name,user_avatar,text)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
            """, (mid, body["stream_id"], body["user_id"], body["user_name"],
                  body.get("user_avatar",""), text))
            conn.commit()
            return ok(_fmt_chat(cur.fetchone()), 201)

        # ─────────── CHAT MODERATION ───────────
        if action == "ban_user":
            bid = f"ban_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO chat_bans (id, stream_id, user_id, banned_by, reason)
                VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT (stream_id, user_id) DO UPDATE SET banned_by=EXCLUDED.banned_by, reason=EXCLUDED.reason
            """, (bid, body["stream_id"], body["user_id"],
                  body.get("banned_by","admin"), body.get("reason","")))
            conn.commit()
            return ok({"ok": True})

        if action == "unban_user":
            cur.execute("""
                DELETE FROM chat_bans WHERE stream_id=%s AND user_id=%s
            """, (body["stream_id"], body["user_id"]))
            conn.commit()
            return ok({"ok": True})

        if action == "get_bans":
            sid = qs.get("stream_id")
            if not sid:
                return err("stream_id required")
            cur.execute("""
                SELECT * FROM chat_bans WHERE stream_id=%s ORDER BY created_at DESC
            """, (sid,))
            rows = cur.fetchall()
            return ok([{
                "userId": r["user_id"],
                "bannedBy": r["banned_by"],
                "reason": r["reason"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else "",
            } for r in rows])

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

        # ─────────── SELLER REVIEWS ───────────
        if action == "get_seller_reviews":
            seller_id = qs.get("seller_id")
            if not seller_id:
                return err("seller_id required")
            cur.execute("SELECT * FROM seller_reviews WHERE seller_id=%s ORDER BY created_at DESC", (seller_id,))
            rows = cur.fetchall()
            cur.execute("SELECT ROUND(AVG(rating),1) as avg, COUNT(*) as cnt FROM seller_reviews WHERE seller_id=%s", (seller_id,))
            stat = cur.fetchone()
            return ok({
                "reviews": [_fmt_seller_review(r) for r in rows],
                "avg": float(stat["avg"]) if stat["avg"] else 0,
                "count": int(stat["cnt"]),
            })

        if action == "add_seller_review":
            cur.execute("SELECT id FROM seller_reviews WHERE seller_id=%s AND user_id=%s",
                        (body["seller_id"], body["user_id"]))
            if cur.fetchone():
                return err("already reviewed", 409)
            rid = f"srev_{uuid.uuid4().hex}"
            cur.execute("""
                INSERT INTO seller_reviews (id,seller_id,user_id,user_name,user_avatar,rating,text)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (rid, body["seller_id"], body["user_id"], body["user_name"],
                  body.get("user_avatar",""), int(body["rating"]), body.get("text","")))
            conn.commit()
            return ok(_fmt_seller_review(cur.fetchone()), 201)

        # ─────────── MJPEG + AUDIO STREAMING ───────────
        # Вещатель шлёт jpeg-кадры и pcm-аудио, зритель получает их через polling
        # Работает в любом браузере включая Яндекс и Safari
        if action == "push_frame":
            stream_id  = body.get("stream_id")
            frame_data = body.get("frame")    # base64 jpeg
            audio_data = body.get("audio")    # base64 pcm (опционально)
            seq        = body.get("seq", 0)
            if not all([stream_id, frame_data]):
                return err("stream_id, frame required")
            cur.execute(
                """INSERT INTO stream_frames (stream_id, frame_data, seq, updated_at)
                   VALUES (%s, %s, %s, NOW())
                   ON CONFLICT (stream_id) DO UPDATE
                   SET frame_data=EXCLUDED.frame_data, seq=EXCLUDED.seq, updated_at=NOW()""",
                (stream_id, frame_data, int(seq))
            )
            # Аудио-чанк храним отдельно (всегда перезаписываем)
            if audio_data:
                cur.execute(
                    """INSERT INTO stream_frames (stream_id, frame_data, seq, updated_at)
                       VALUES (%s||'_audio', %s, %s, NOW())
                       ON CONFLICT (stream_id) DO UPDATE
                       SET frame_data=EXCLUDED.frame_data, seq=EXCLUDED.seq, updated_at=NOW()""",
                    (stream_id, audio_data, int(seq))
                )
            conn.commit()
            return ok({"ok": True})

        if action == "get_frame":
            stream_id  = qs.get("stream_id") or body.get("stream_id")
            client_seq = int(qs.get("seq", "-1") or "-1")
            if not stream_id:
                return err("stream_id required")
            cur.execute(
                "SELECT frame_data, seq FROM stream_frames WHERE stream_id=%s",
                (stream_id,)
            )
            row = cur.fetchone()
            if not row:
                return ok({"frame": None, "audio": None, "seq": -1})
            if row["seq"] <= client_seq:
                return ok({"frame": None, "audio": None, "seq": row["seq"]})
            # Берём аудио для этого же seq
            cur.execute(
                "SELECT frame_data FROM stream_frames WHERE stream_id=%s",
                (stream_id + "_audio",)
            )
            arow = cur.fetchone()
            return ok({
                "frame": row["frame_data"],
                "audio": arow["frame_data"] if arow else None,
                "seq": row["seq"]
            })

        # ─────────── WEBRTC SIGNALING ───────────
        # Вещатель отправляет offer, зритель отвечает answer, оба обмениваются ICE
        if action == "signal_send":
            stream_id = body.get("stream_id")
            viewer_id = body.get("viewer_id")
            sig_type  = body.get("type")   # offer | answer | ice-broadcaster | ice-viewer
            payload   = body.get("payload")
            if not all([stream_id, viewer_id, sig_type, payload]):
                return err("stream_id, viewer_id, type, payload required")
            sid = f"sig_{uuid.uuid4().hex}"
            cur.execute(
                "INSERT INTO webrtc_signals (id,stream_id,viewer_id,type,payload) VALUES (%s,%s,%s,%s,%s)",
                (sid, stream_id, viewer_id, sig_type, json.dumps(payload) if not isinstance(payload, str) else payload)
            )
            conn.commit()
            # Удаляем старые сигналы этого типа для этой пары (оставляем только последний)
            if sig_type in ("offer", "answer"):
                cur.execute(
                    "DELETE FROM webrtc_signals WHERE stream_id=%s AND viewer_id=%s AND type=%s AND id!=%s",
                    (stream_id, viewer_id, sig_type, sid)
                )
                conn.commit()
            return ok({"ok": True, "id": sid})

        if action == "signal_get":
            stream_id = qs.get("stream_id") or body.get("stream_id")
            viewer_id = qs.get("viewer_id") or body.get("viewer_id")
            sig_type  = qs.get("type") or body.get("type")
            if not all([stream_id, viewer_id, sig_type]):
                return err("stream_id, viewer_id, type required")
            cur.execute(
                "SELECT * FROM webrtc_signals WHERE stream_id=%s AND viewer_id=%s AND type=%s ORDER BY created_at DESC LIMIT 1",
                (stream_id, viewer_id, sig_type)
            )
            row = cur.fetchone()
            if not row:
                return ok(None)
            payload = row["payload"]
            try:
                payload = json.loads(payload)
            except Exception:
                pass
            return ok({"id": row["id"], "type": row["type"], "payload": payload})

        if action == "signal_get_viewers":
            # Вещатель получает список зрителей, у которых есть незаотвеченный offer-запрос
            stream_id = qs.get("stream_id") or body.get("stream_id")
            if not stream_id:
                return err("stream_id required")
            # Находим viewer_id у которых есть offer но нет answer от вещателя
            cur.execute("""
                SELECT DISTINCT viewer_id FROM webrtc_signals
                WHERE stream_id=%s AND type='offer'
                AND created_at > NOW() - INTERVAL '5 minutes'
            """, (stream_id,))
            rows = cur.fetchall()
            return ok([r["viewer_id"] for r in rows])

        if action == "signal_ice_get":
            # Получить все ICE кандидаты для данной пары
            stream_id = qs.get("stream_id") or body.get("stream_id")
            viewer_id = qs.get("viewer_id") or body.get("viewer_id")
            sig_type  = qs.get("type") or body.get("type")  # ice-broadcaster | ice-viewer
            after_id  = qs.get("after_id") or body.get("after_id", "")
            if not all([stream_id, viewer_id, sig_type]):
                return err("stream_id, viewer_id, type required")
            if after_id:
                cur.execute(
                    "SELECT * FROM webrtc_signals WHERE stream_id=%s AND viewer_id=%s AND type=%s AND id>%s ORDER BY created_at ASC",
                    (stream_id, viewer_id, sig_type, after_id)
                )
            else:
                cur.execute(
                    "SELECT * FROM webrtc_signals WHERE stream_id=%s AND viewer_id=%s AND type=%s ORDER BY created_at ASC",
                    (stream_id, viewer_id, sig_type)
                )
            rows = cur.fetchall()
            result = []
            for r in rows:
                payload = r["payload"]
                try:
                    payload = json.loads(payload)
                except Exception:
                    pass
                result.append({"id": r["id"], "payload": payload})
            return ok(result)

        if action == "signal_cleanup":
            stream_id = body.get("stream_id")
            if stream_id:
                cur.execute("DELETE FROM webrtc_signals WHERE stream_id=%s", (stream_id,))
                conn.commit()
            return ok({"ok": True})

        # ─────────── WAREHOUSES ───────────
        if action == "get_warehouses":
            seller_id = qs.get("seller_id") or body.get("seller_id")
            if not seller_id:
                return err("seller_id required")
            cur.execute("SELECT * FROM warehouses WHERE seller_id=%s ORDER BY is_default DESC, created_at ASC", (seller_id,))
            rows = cur.fetchall()
            return ok([_fmt_warehouse(r) for r in rows])

        if action == "add_warehouse":
            seller_id = body.get("seller_id")
            name = body.get("name", "").strip()
            city_code = body.get("city_code")
            city_name = body.get("city_name", "").strip()
            address = body.get("address", "").strip()
            if not all([seller_id, name, city_code, city_name]):
                return err("seller_id, name, city_code, city_name required")
            wid = f"wh_{uuid.uuid4().hex}"
            cur.execute("SELECT COUNT(*) as cnt FROM warehouses WHERE seller_id=%s", (seller_id,))
            is_first = cur.fetchone()["cnt"] == 0
            cur.execute("""
                INSERT INTO warehouses (id, seller_id, name, city_code, city_name, address, is_default)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
            """, (wid, seller_id, name, int(city_code), city_name, address, is_first))
            conn.commit()
            return ok(_fmt_warehouse(cur.fetchone()), 201)

        if action == "update_warehouse":
            wid = body.get("id")
            if not wid:
                return err("id required")
            fields, vals = [], []
            for f in ("name", "address"):
                if f in body:
                    fields.append(f"{f}=%s")
                    vals.append(body[f])
            if not fields:
                return err("nothing to update")
            vals.append(wid)
            cur.execute(f"UPDATE warehouses SET {', '.join(fields)} WHERE id=%s RETURNING *", vals)
            conn.commit()
            row = cur.fetchone()
            return ok(_fmt_warehouse(row)) if row else err("not found", 404)

        if action == "set_default_warehouse":
            wid = body.get("id")
            seller_id = body.get("seller_id")
            if not wid or not seller_id:
                return err("id and seller_id required")
            cur.execute("UPDATE warehouses SET is_default=FALSE WHERE seller_id=%s", (seller_id,))
            cur.execute("UPDATE warehouses SET is_default=TRUE WHERE id=%s AND seller_id=%s RETURNING *", (wid, seller_id))
            conn.commit()
            row = cur.fetchone()
            return ok(_fmt_warehouse(row)) if row else err("not found", 404)

        if action == "delete_warehouse":
            wid = body.get("id") or qs.get("id")
            if not wid:
                return err("id required")
            cur.execute("DELETE FROM warehouses WHERE id=%s", (wid,))
            conn.commit()
            return ok({"ok": True})

        return err("unknown action", 404)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        cur.close()
        conn.close()


def _clean_images(images):
    """Отфильтровываем base64 — оставляем только http(s) URL."""
    result = []
    for img in (images or []):
        if isinstance(img, str) and img.startswith("http"):
            result.append(img)
    return result

def _fmt_seller(r):
    if not r:
        return None
    return {
        "userId":       r["user_id"],
        "legalType":    r["legal_type"],
        "legalName":    r["legal_name"],
        "inn":          r["inn"],
        "bankAccount":  r["bank_account"],
        "bankName":     r["bank_name"],
        "bik":          r["bik"],
        "contactPhone": r["contact_phone"],
        "contactEmail": r["contact_email"],
        "cdekId":       r["cdek_id"],
        "agreedOffer":  r["agreed_offer"],
        "agreedPd":     r["agreed_pd"],
        "verified":     r["verified"],
        "createdAt":    r["created_at"].strftime("%d.%m.%Y") if r["created_at"] else "",
    }

def _fmt_order(r):
    items = r["items"]
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except Exception:
            items = []
    return {
        "id":                 r["id"],
        "buyerId":            r["buyer_id"],
        "buyerName":          r["buyer_name"],
        "buyerPhone":         r["buyer_phone"],
        "buyerEmail":         r["buyer_email"],
        "deliveryType":       r["delivery_type"],
        "deliveryCityCode":   r["delivery_city_code"],
        "deliveryCityName":   r["delivery_city_name"],
        "deliveryAddress":    r["delivery_address"],
        "deliveryTariffCode": r["delivery_tariff_code"],
        "deliveryTariffName": r["delivery_tariff_name"],
        "deliveryCost":       float(r["delivery_cost"]),
        "items":              items,
        "goodsTotal":         float(r["goods_total"]),
        "orderTotal":         float(r["order_total"]),
        "status":             r["status"],
        "paymentMethod":      r["payment_method"],
        "createdAt":          r["created_at"].strftime("%d.%m.%Y %H:%M") if r["created_at"] else "",
    }

def _fmt_product(r):
    return {
        "id":             r["id"],
        "name":           r["name"],
        "price":          float(r["price"]),
        "category":       r["category"],
        "description":    r["description"],
        "images":         _clean_images(r["images"]),
        "sellerId":       r["seller_id"],
        "sellerName":     r["seller_name"],
        "sellerAvatar":   r["seller_avatar"],
        "inStock":        r["in_stock"],
        "weightG":        r.get("weight_g", 500),
        "lengthCm":       r.get("length_cm", 20),
        "widthCm":        r.get("width_cm", 15),
        "heightCm":       r.get("height_cm", 10),
        "cdekEnabled":    r.get("cdek_enabled", True),
        "nalogEnabled":   r.get("nalog_enabled", False),
        "fittingEnabled": r.get("fitting_enabled", False),
        "fromCityCode":   r.get("from_city_code", 0),
        "fromCityName":   r.get("from_city_name", ""),
        "createdAt":      r["created_at"].strftime("%d %B %Y") if r["created_at"] else "",
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
        "videoUrl":     r.get("video_url"),
        "thumbnail":    r.get("thumbnail"),
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

def _fmt_seller_review(r):
    return {
        "id":         r["id"],
        "sellerId":   r["seller_id"],
        "userId":     r["user_id"],
        "userName":   r["user_name"],
        "userAvatar": r["user_avatar"],
        "rating":     r["rating"],
        "text":       r["text"],
        "createdAt":  r["created_at"].strftime("%d %b %Y") if r["created_at"] else "",
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