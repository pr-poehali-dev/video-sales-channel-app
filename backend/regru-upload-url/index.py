"""
Генерирует presigned URL для прямой загрузки файлов в Reg.ru S3 (strimbazar).
Браузер загружает файл напрямую в S3 — функция только подписывает URL (~100мс).
Поддерживает фото (image/*) и видео (video/*).
"""
import json
import os
import uuid
import boto3
from botocore.client import Config

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

REGRU_CDN_BASE = "https://strimbazar.s3.regru.cloud"
BUCKET = "strimbazar"


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://s3.regru.cloud",
        aws_access_key_id=os.environ["REGRU_S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["REGRU_S3_SECRET_KEY"],
        config=Config(signature_version="s3v4"),
    )


def ok(data):
    return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data)}


def err(msg):
    return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}


def handler(event: dict, context) -> dict:
    """Выдаёт presigned PUT URL для прямой загрузки фото/видео в Reg.ru S3 из браузера."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    content_type = body.get("content_type", "")  # напр. "image/jpeg" или "video/mp4"
    folder = body.get("folder", "products")       # "products" или "thumbnails"

    if not content_type or not content_type.startswith(("image/", "video/")):
        return err("content_type обязателен (image/* или video/*)")

    # Определяем расширение
    ext = content_type.split("/")[1].split(";")[0]
    if ext in ("jpeg",): ext = "jpeg"
    if ext in ("quicktime", "x-mp4"): ext = "mp4"
    if ext in ("x-matroska",): ext = "webm"

    key = f"{folder}/{uuid.uuid4().hex}.{ext}"

    s3 = get_s3()
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET,
            "Key": key,
            "ContentType": content_type,
            "ACL": "public-read",
        },
        ExpiresIn=300,  # 5 минут
    )

    cdn_url = f"{REGRU_CDN_BASE}/{key}"
    print(f"[REGRU_UPLOAD_URL] key={key} content_type={content_type}")
    return ok({"upload_url": upload_url, "cdn_url": cdn_url})
