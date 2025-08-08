"""Health check endpoint."""

import logging
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.core.config import get_settings
from app.schemas.summary_schemas import HealthCheckResponse

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.get("", response_model=HealthCheckResponse)
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthCheckResponse:
    """Health check endpoint."""
    try:
        # Check database connection
        try:
            await db.execute(text("SELECT 1"))
            db_status = "healthy"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            db_status = "unhealthy"
        
        # Check OpenAI service
        openai_status = "healthy" if settings.OPENAI_API_KEY else "not_configured"
        
        # Check Redis (if configured)
        redis_status = "healthy" if settings.REDIS_URL else "not_configured"
        
        dependencies = {
            "database": db_status,
            "openai": openai_status,
            "redis": redis_status
        }
        
        # Overall status
        overall_status = "healthy" if all(
            status in ["healthy", "not_configured"] for status in dependencies.values()
        ) else "unhealthy"
        
        return HealthCheckResponse(
            status=overall_status,
            timestamp=datetime.utcnow(),
            version="1.0.0",
            dependencies=dependencies
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")