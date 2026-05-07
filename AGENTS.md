# Lab Equipment Checkout — AI Agent Guide

This file documents the codebase for AI coding agents (Claude Code, Codex, etc.).  
Read this alongside `CLAUDE.md` for full context.

## Critical rule: virtual environment

Every shell command that invokes Python must be prefixed with:

```bash
source .venv/bin/activate &&
```

This applies to `python`, `uvicorn`, `pip`, `uv pip`, and any CLI tool installed into the venv.  
Failure to do so will import system packages instead of project dependencies and produce confusing import errors.

## How to start the server

```bash
source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

The `--reload` flag watches for file changes. Use `--port` to avoid conflicts with other services.

## Where things live

| What you want to change | File(s) to edit |
|-------------------------|-----------------|
| Database schema | `app/models.py` + matching `app/schemas.py` fields |
| API endpoints | `app/routers/<domain>_router.py` |
| Auth / password policy | `app/auth.py` |
| Checkout policy logic | `app/routers/checkouts_router.py` → `create_checkout` |
| Policy serialisation (JSON ↔ Python) | `app/routers/equipment_router.py` → `_policy_to_schema` |
| Frontend styles | `static/css/app.css` (CSS custom properties at top of file) |
| Shared JS utilities | `static/js/api.js` — `apiFetch`, `showError`, `toast`, `fmtDate` |
| User-facing equipment view | `static/dashboard.html` + `static/js/dashboard.js` |
| Admin panel | `static/admin.html` + `static/js/admin.js` |

## Design decisions an agent must respect

### Password hashing

`app/auth.py` uses **Argon2id** via `argon2-cffi` with OWASP-recommended minimum parameters:

```python
PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1, hash_len=32, salt_len=16)
```

Do **not** downgrade to bcrypt, PBKDF2, or plain SHA-256. Do not change the parameters without a documented security justification.

### JWT secret key

The secret is loaded from the `JWT_SECRET_KEY` environment variable, falling back to a file-based key at `.secret_key` (auto-generated on first run, gitignored). Never hardcode a secret or log the key value.

### Policy storage format

`CheckoutPolicy.allowed_days` and `allowed_users` are stored as **JSON strings** in SQLite (not as a SQLAlchemy JSON column type). The helpers `_policy_to_schema()` in `equipment_router.py` and the serialisation block in `checkouts_router.py` own the encode/decode logic. Keep the canonical representation consistent:

- `allowed_days`: `None` (SQL NULL) → any day; `"[0,1,2,3,4]"` → Mon–Fri (0-indexed, 0 = Monday)
- `allowed_users`: `"all"` (literal string) → no restriction; `"[1,3]"` (JSON string) → user IDs

### Role enforcement

`require_admin` (a FastAPI `Depends`) is declared in `app/auth.py` and applied as a dependency on every admin-only endpoint. Do not inline role checks in route functions; always use the dependency.

### Frontend JS patterns

- `api.js` is loaded on every HTML page before any page-specific script.
- Use `apiFetch(path, options)` for all API calls — it injects the `Authorization` header and handles 401 redirects automatically.
- Use `showError(el, msg)` to display error text inside alert `<div>`s; do **not** set `el.textContent` directly (it would destroy the child `<i>` icon element).
- Use `escHtml(str)` before interpolating any server-provided strings into `innerHTML`.
- `toast(msg, type)` accepts `'success'` or `'error'` as the type.

### No build step

There is no bundler, transpiler, or npm in this project. All JS is plain ES2020 (supported by any modern browser). Keep it that way — do not introduce `package.json` unless the user explicitly asks for it.

## Common tasks

### Add a field to Equipment

1. Add the column to `class Equipment` in `app/models.py`.
2. Add the field to `EquipmentBase` in `app/schemas.py` (pick up by `EquipmentCreate`, `EquipmentUpdate`, `EquipmentOut` automatically if inherited).
3. Render it in `equipmentCard()` (`dashboard.js`) and the admin table (`admin.js` → `renderEquipmentTable`).
4. Add the input to the equipment modal in `admin.html`.
5. Drop `lab_equipment.db` and re-run `seed.py` (dev) or write an Alembic migration (prod).

### Add a new API route

1. Add the function to the appropriate router in `app/routers/`.
2. Import and use `get_current_user` or `require_admin` as a `Depends` parameter for auth.
3. Return a Pydantic schema instance; FastAPI serialises it automatically.

### Change checkout policy enforcement

All policy logic lives in `create_checkout()` in `app/routers/checkouts_router.py`. The function checks:
1. Equipment exists and is active
2. No active checkout already exists (1-at-a-time)
3. Today's weekday is in `allowed_days` (if restricted)
4. Current user is in `allowed_users` (if restricted)

Add new enforcement rules inside this function before the `Checkout` object is created.

### Test the API without a browser

```bash
# Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

# Use it
curl -s http://localhost:8000/api/equipment -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

The OpenAPI UI at http://localhost:8000/api/docs also supports interactive testing with the Authorize button.

## What not to do

- Do not add `__pycache__`, `*.pyc`, `lab_equipment.db`, or `.secret_key` to version control — they are gitignored.
- Do not bypass `require_admin` with inline role checks.
- Do not store passwords in plain text or with a weaker hash than Argon2id.
- Do not set `el.textContent` on alert divs — use `showError(el, msg)` instead.
- Do not install packages with bare `pip install`; always use `uv pip install` inside the activated venv.
