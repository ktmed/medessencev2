#!/bin/bash

# Start script for Patient-Friendly Summary Generation Service

set -e

echo "Starting Patient-Friendly Summary Generation Service..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Using default environment variables."
    echo "Please copy .env.example to .env and configure your settings."
fi

# Set default values if not provided
export DEBUG=${DEBUG:-false}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-8003}
export LOG_LEVEL=${LOG_LEVEL:-INFO}

# Database migration (if using Alembic)
# echo "Running database migrations..."
# alembic upgrade head

# Start the application
echo "Starting application on ${HOST}:${PORT}..."
exec python -m uvicorn main:app \
    --host "${HOST}" \
    --port "${PORT}" \
    --log-level "${LOG_LEVEL,,}" \
    --access-log \
    --use-colors