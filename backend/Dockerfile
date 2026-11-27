FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

COPY backend/pyproject.toml backend/pyproject.toml
COPY backend/app backend/app
RUN pip install --no-cache-dir ./backend

COPY backend/alembic.ini backend/alembic.ini
COPY backend/alembic backend/alembic
COPY backend/seed.py backend/seed.py

RUN mkdir -p /app/backend/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
