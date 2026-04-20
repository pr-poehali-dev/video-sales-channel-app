import os
import json
import urllib.request

def handler(event: dict, context) -> dict:
    """Поиск данных организации/ИП по ИНН через dadata.ru"""

    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': ''
        }

    body = json.loads(event.get('body') or '{}')
    inn = body.get('inn', '').strip()

    if not inn or not inn.isdigit():
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Некорректный ИНН'})
        }

    api_key = os.environ['DADATA_API_KEY']

    url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party'
    payload = json.dumps({'query': inn, 'count': 1}).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Token {api_key}',
        }
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    suggestions = data.get('suggestions', [])
    if not suggestions:
        return {
            'statusCode': 404,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Организация не найдена'})
        }

    s = suggestions[0]
    d = s.get('data', {})

    ogrn = d.get('ogrn', '') or ''
    name_full = d.get('name', {}).get('full_with_opf', '') or s.get('value', '')
    name_short = d.get('name', {}).get('short_with_opf', '') or name_full
    address = d.get('address', {}).get('value', '') if d.get('address') else ''
    kpp = d.get('kpp', '') or ''
    status = d.get('state', {}).get('status', '') if d.get('state') else ''

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'inn': inn,
            'ogrn': ogrn,
            'name_full': name_full,
            'name_short': name_short,
            'address': address,
            'kpp': kpp,
            'status': status,
        }, ensure_ascii=False)
    }
