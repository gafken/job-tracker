FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

COPY Backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements.txt

COPY Backend/ /app/Backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "Backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
