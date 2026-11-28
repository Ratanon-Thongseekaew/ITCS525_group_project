FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /workspace

COPY backend/pyproject.toml ./backend/pyproject.toml
COPY backend/app ./backend/app
COPY backend/alembic ./backend/alembic
COPY backend/alembic.ini ./backend/alembic.ini
COPY backend/seed.py ./backend/seed.py

RUN pip install --no-cache-dir ./backend \
    && addgroup --system app \
    && adduser --system --ingroup app app \
    && mkdir -p /workspace/backend/uploads \
    && chown -R app:app /workspace/backend/uploads

USER app

EXPOSE 8000

CMD ["sh", "-c", "alembic -c backend/alembic.ini upgrade head && uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000"]
