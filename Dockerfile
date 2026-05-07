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

# The SQLite database (lab_equipment.db) and the auto-generated JWT secret
# (.secret_key) are written to /app at runtime.  Mount a named volume there
# to persist data across container restarts:
#
#   docker run -v lab-data:/app ...
#
# The JWT secret can also be supplied via environment variable to avoid
# storing a secret inside a volume:
#
#   docker run -e JWT_SECRET_KEY=<random-hex-64-chars> ...

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8000/login.html')" \
    || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
