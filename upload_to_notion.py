"""
upload_to_notion.py
Sube los 260 casos de kb_combined.json a la base de datos de Notion.

Uso:
    python3 upload_to_notion.py

Requiere:
    - kb_combined.json en la misma carpeta
    - Variables de entorno NOTION_TOKEN y NOTION_DATABASE_ID
      o editar directamente las constantes abajo.
"""

import json
import time
import urllib.request
import urllib.error
import os

# ── Configuración ──────────────────────────────────────────────────────
# Puedes poner los valores directamente aquí o usar variables de entorno
NOTION_TOKEN       = os.environ.get("NOTION_TOKEN", "")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "")
KB_FILE            = "kb_combined.json"

# Delay entre requests para no superar el rate limit de Notion (3 req/s)
DELAY_SECONDS = 0.4
# ───────────────────────────────────────────────────────────────────────


def notion_request(endpoint, payload):
    """Makes a POST request to the Notion API."""
    url = f"https://api.notion.com/v1/{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def create_page(case):
    """Creates a single page (row) in the Notion database."""
    # Notion text limit per property is 2000 chars
    sintomas  = str(case.get("sintomas",  ""))[:2000]
    causa     = str(case.get("causa",     ""))[:2000]
    solucion  = str(case.get("solucion",  ""))[:2000]
    categoria = str(case.get("categoria", ""))
    case_id   = int(case.get("id", 0))

    payload = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "Síntomas": {
                "title": [{"text": {"content": sintomas}}]
            },
            "Categoría": {
                "select": {"name": categoria}
            },
            "Causa": {
                "rich_text": [{"text": {"content": causa}}]
            },
            "Solución": {
                "rich_text": [{"text": {"content": solucion}}]
            },
            "ID": {
                "number": case_id
            },
            "Activo": {
                "checkbox": True
            },
        }
    }
    return notion_request("pages", payload)


def main():
    # Load KB
    with open(KB_FILE, encoding="utf-8") as f:
        cases = json.load(f)

    total   = len(cases)
    success = 0
    errors  = []

    print(f"Subiendo {total} casos a Notion...")
    print(f"Base de datos: {NOTION_DATABASE_ID}\n")

    for i, case in enumerate(cases, 1):
        try:
            create_page(case)
            success += 1
            if i % 10 == 0 or i == total:
                print(f"  ✓ {i}/{total} — Caso #{case['id']}: {case['sintomas'][:50]}...")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode(errors="replace")
            errors.append((case["id"], f"HTTP {e.code}: {err_body[:120]}"))
            print(f"  ✗ {i}/{total} — Caso #{case['id']} ERROR: HTTP {e.code}")
        except Exception as ex:
            errors.append((case["id"], str(ex)))
            print(f"  ✗ {i}/{total} — Caso #{case['id']} ERROR: {ex}")

        time.sleep(DELAY_SECONDS)

    print(f"\n{'='*50}")
    print(f"  Completado: {success}/{total} casos subidos correctamente")
    if errors:
        print(f"  Errores ({len(errors)}):")
        for case_id, msg in errors:
            print(f"    Caso #{case_id}: {msg}")
    else:
        print("  Sin errores.")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
