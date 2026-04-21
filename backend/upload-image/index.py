"""
Загрузка фото товаров в Reg.ru S3 (strimbazar).
Вынесена отдельно чтобы иметь увеличенный таймаут и не блокировать store-api.
Принимает base64 data_url, возвращает публичный URL.
"""
import json
import os
import uuid
import base64
import boto3
from botocore.client import Config

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

REGRU_CDN_BASE = "https://strimbazar.s3.regru.cloud"


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
    """Загрузка фото товара в Reg.ru S3. Таймаут 60 сек."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    data_url = body.get("data_url", "")
    if not data_url.startswith("data:image/"):
        return err("invalid image data")

    header, encoded = data_url.split(",", 1)
    ext = header.split("/")[1].split(";")[0]  # jpeg, png, webp

    img_bytes = base64.b64decode(encoded)
    folder = body.get("folder", "products")
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"

    s3 = get_s3()
    s3.put_object(
        Bucket="strimbazar",
        Key=key,
        Body=img_bytes,
        ContentType=f"image/{ext}",
        ACL="public-read",
    )

    url = f"{REGRU_CDN_BASE}/{key}"
    print(f"[UPLOAD_IMAGE] ok key={key} size={len(img_bytes)}")
    return ok({"url": url})
