FROM python:3.13-slim

WORKDIR /app

# Install Python dependencies in a separate layer so they are cached
# as long as requirements.txt has not changed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source (code changes do not bust the dependency cache)
COPY app/     ./app/
COPY static/  ./static/
COPY seed.py  .

# Run as a non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

# ── Runtime configuration ────────────────────────────────────────────────────
# All three variables are optional; the defaults work out of the box.
#
#  DATABASE_URL     Full SQLAlchemy URL (overrides SQLITE_DB_PATH).
#                   Default: sqlite:///./lab_equipment.db  (inside /app)
#
#  SQLITE_DB_PATH   Absolute path to the SQLite file when you want to place it
#                   on a volume without writing a full URL.
#                   Example: -e SQLITE_DB_PATH=/data/lab.db -v lab-db:/data
#
#  JWT_SECRET_KEY   Secret used to sign tokens.  Provide this so the key is not
#                   stored inside the container filesystem.
#                   Example: -e JWT_SECRET_KEY=$(openssl rand -hex 32)
#
#  SECRET_KEY_FILE  Path to the auto-generated key file when JWT_SECRET_KEY is
#                   not set.  Default: /app/.secret_key
#                   Example: -e SECRET_KEY_FILE=/secrets/jwt.key -v secrets:/secrets
#
# Minimal persistent-data example:
#   docker run -p 8000:8000 \
#     -e SQLITE_DB_PATH=/data/lab.db \
#     -e JWT_SECRET_KEY=$(openssl rand -hex 32) \
#     -v lab-data:/data \
#     lab-checkout

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8000/login.html')" \
    || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
