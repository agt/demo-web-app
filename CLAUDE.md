# Lab Equipment Checkout — Developer Guide

## Project overview

A single-server web application for managing laboratory equipment checkouts. Users browse available equipment and check items in/out; administrators manage equipment, define per-item checkout policies, and manage user accounts.

## Running the app

```bash
# First run: create the venv and install dependencies
uv venv .venv
source .venv/bin/activate && uv pip install -r requirements.txt

# Seed the database with sample data and a default admin account
source .venv/bin/activate && python seed.py

# Start the development server (auto-reload on file changes)
source .venv/bin/activate && uvicorn app.main:app --reload
```

Open http://localhost:8000. The browser is redirected to `/login.html`.

**Default seed credentials**

| Username | Password  | Role          |
|----------|-----------|---------------|
| admin    | admin123  | Administrator |
| alice    | alice123  | User          |
| bob      | bob123    | User          |

Interactive API docs: http://localhost:8000/api/docs

## IMPORTANT: virtual environment

All Python commands **must** be prefixed with `source .venv/bin/activate &&`.  
Never run `python`, `uvicorn`, `pip`, or `uv pip` outside the venv.

## Architecture

```
demo-web-app/
├── app/                  Python package — FastAPI application
│   ├── main.py           App entry point; mounts routers + static files
│   ├── database.py       SQLAlchemy engine, session factory, Base class
│   ├── models.py         ORM models (User, Equipment, CheckoutPolicy, Checkout)
│   ├── schemas.py        Pydantic request/response models
│   ├── auth.py           Password hashing (Argon2id), JWT creation/validation
│   └── routers/
│       ├── auth_router.py      POST /api/auth/login, GET /api/auth/me
│       ├── users_router.py     CRUD /api/users  (admin-only writes)
│       ├── equipment_router.py CRUD /api/equipment + PUT /api/equipment/{id}/policy
│       └── checkouts_router.py GET|POST /api/checkouts, PUT /api/checkouts/{id}/return
├── static/               Served as-is by FastAPI StaticFiles at "/"
│   ├── index.html        Redirect shim (→ login or dashboard)
│   ├── login.html
│   ├── dashboard.html    Equipment catalog + user's own checkouts
│   ├── admin.html        Admin panel (equipment / users / all checkouts)
│   ├── css/app.css       Single stylesheet; CSS custom properties for theming
│   └── js/
│       ├── api.js        fetch wrapper, auth helpers, toast/date utils (loaded on every page)
│       ├── login.js
│       ├── dashboard.js
│       └── admin.js
├── seed.py               One-shot database seeding script
├── requirements.txt
└── .gitignore
```

FastAPI serves both the REST API (under `/api/`) and the static frontend from the same process on the same origin, so no CORS configuration is required.

## Technology choices

### Backend

| Choice | Rationale |
|--------|-----------|
| **FastAPI** | Async-capable, automatic OpenAPI docs, Pydantic validation built in |
| **SQLAlchemy 2 ORM** | Declarative models, relationship loading, portable across databases |
| **SQLite** | Zero-configuration, file-based, sufficient for single-lab concurrency |
| **Argon2id** (argon2-cffi) | OWASP #1 recommendation for new applications; memory-hard, resists GPU/ASIC attacks; parameters: m=19456 MiB, t=2, p=1 |
| **python-jose** | JWT creation and validation; HS256 algorithm; 8-hour token lifetime |

The JWT secret key is generated on first startup and stored in `.secret_key` (gitignored). Override with the `JWT_SECRET_KEY` environment variable in production.

### Frontend

| Choice | Rationale |
|--------|-----------|
| **Vanilla HTML/CSS/JS** | No build step, no bundler, no framework dependency — easy to modify and audit |
| **CSS custom properties** | Consistent theming without a preprocessor |
| **Font Awesome 6 (CDN)** | Icon set without adding a build pipeline |
| **localStorage JWT** | Simple for a same-origin SPA; tokens expire after 8 hours |

## Data model

```
User ──< Checkout >── Equipment ── CheckoutPolicy
```

- **User**: `id, username, email, full_name, password_hash, role, is_active, created_at`
- **Equipment**: `id, name, description, serial_number, location, is_active, created_at, created_by_id`
- **CheckoutPolicy**: `equipment_id (1:1), allowed_days (JSON|NULL), max_checkout_days, allowed_users ("all"|JSON array of IDs), updated_at`
- **Checkout**: `id, equipment_id, user_id, checked_out_at, due_date, returned_at, status ("active"|"returned"), notes`

`allowed_days` and `allowed_users` are stored as JSON strings in SQLite (SQLAlchemy JSON type not used to keep the SQLite dependency explicit).

## API surface

All API routes live under `/api/`. Authentication uses `Authorization: Bearer <JWT>`.

```
POST   /api/auth/login              — returns JWT token
GET    /api/auth/me                 — current user info

GET    /api/users                   — list users (admin)
POST   /api/users                   — create user (admin)
PUT    /api/users/{id}              — update user (admin)
DELETE /api/users/{id}              — deactivate user (admin)

GET    /api/equipment               — list active equipment (authenticated)
GET    /api/equipment/{id}          — single item with policy + availability
POST   /api/equipment               — create (admin)
PUT    /api/equipment/{id}          — update (admin)
DELETE /api/equipment/{id}          — deactivate (admin)
PUT    /api/equipment/{id}/policy   — set checkout policy (admin)

GET    /api/checkouts               — own checkouts (admin: all checkouts)
POST   /api/checkouts               — check out equipment
PUT    /api/checkouts/{id}/return   — return equipment
```

## Extending the app

**Add a new equipment field** — add the column to `models.py`, add the field to `schemas.py` (`EquipmentBase`/`EquipmentUpdate`), and render it in the equipment card/table in the frontend. Drop `lab_equipment.db` and re-run `seed.py` during development (or write an Alembic migration for production).

**Switch from SQLite to PostgreSQL** — change `SQLALCHEMY_DATABASE_URL` in `database.py` and remove `check_same_thread`. No ORM changes needed.

**Add email notifications** — hook into `create_checkout` and `return_checkout` in `checkouts_router.py`; FastAPI-Mail or smtplib both work.

**Production hardening checklist**
- Set `JWT_SECRET_KEY` to a strong random value via environment variable
- Run behind a reverse proxy (nginx/caddy) with TLS
- Move to PostgreSQL for concurrent write safety
- Add rate limiting on `/api/auth/login`
- Set `Secure; HttpOnly; SameSite=Strict` cookies if moving away from localStorage JWT
