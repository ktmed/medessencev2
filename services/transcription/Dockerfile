# Multi-stage build for production-ready transcription service

# Build stage
FROM python:3.11-slim as builder

# Set build arguments
ARG WHISPER_MODEL=base
ARG ENABLE_CUDA=false

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download Whisper model (commented out for dev)
# RUN python -c "import whisper; whisper.load_model('${WHISPER_MODEL}')"

# Production stage
FROM python:3.11-slim as production

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/opt/venv/bin:$PATH" \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies for production
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r transcription && useradd -r -g transcription -d /app -s /sbin/nologin transcription

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy Whisper models from builder (commented out for dev)
# COPY --from=builder /root/.cache/whisper /app/.cache/whisper

# Set working directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/uploads /app/temp /app/models /app/data/medical_dictionaries /app/logs \
    && chown -R transcription:transcription /app

# Copy application code
COPY --chown=transcription:transcription . .

# Create data directories and set permissions
RUN mkdir -p /app/data/medical_dictionaries && \
    chown -R transcription:transcription /app/data

# Health check script
COPY --chown=transcription:transcription <<EOF /app/healthcheck.py
#!/usr/bin/env python3
import sys
import asyncio
import aiohttp

async def health_check():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('http://localhost:8001/health', timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('status') == 'healthy':
                        sys.exit(0)
        sys.exit(1)
    except Exception:
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(health_check())
EOF

RUN chmod +x /app/healthcheck.py

# Switch to non-root user
USER transcription

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python /app/healthcheck.py

# Default environment variables
ENV HOST=0.0.0.0 \
    PORT=8001 \
    WORKERS=4 \
    WHISPER_MODEL=base \
    USE_LOCAL_WHISPER=true \
    WHISPER_DEVICE=cpu \
    REDIS_HOST=redis \
    REDIS_PORT=6379 \
    LOG_LEVEL=INFO \
    TEMP_DIR=/app/temp \
    UPLOAD_DIR=/app/uploads \
    MODEL_CACHE_DIR=/app/models \
    MEDICAL_DICT_PATH=/app/data/medical_dictionaries

# Command to run the application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]