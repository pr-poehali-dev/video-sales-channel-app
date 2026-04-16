"""
Загрузка видео в S3. Вынесена отдельно чтобы иметь больший таймаут выполнения.
Принимает base64 data_url, сохраняет в poehali S3, возвращает CDN URL.
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

def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
    )

CDN_BASE = f"https://cdn.poehali.dev/projects/{os.environ.get('AWS_ACCESS_KEY_ID','')}/bucket"

def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data)}

def err(msg):
    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": msg})}

def handler(event: dict, context) -> dict:
    """Загрузка видео товара/эфира в S3. Таймаут должен быть 120+ сек."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    data_url = body.get("data_url", "")
    if not data_url.startswith("data:video/"):
        return err("invalid video data")

    header, encoded = data_url.split(",", 1)
    mime = header.split(";")[0].replace("data:", "")
    ext = mime.split("/")[1].split("+")[0].split(";")[0]

    if ext in ("mp4", "quicktime", "x-mp4"):
        mime = "video/mp4"
        ext = "mp4"
    elif ext in ("webm", "x-matroska"):
        mime = "video/webm"
        ext = "webm"

    video_bytes = base64.b64decode(encoded)
    folder = body.get("folder", "products")
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"

    s3 = get_s3()
    s3.put_object(
        Bucket="files",
        Key=key,
        Body=video_bytes,
        ContentType=mime,
        ContentDisposition="inline",
    )

    cdn_url = f"{CDN_BASE}/{key}"
    return ok({"url": cdn_url})
