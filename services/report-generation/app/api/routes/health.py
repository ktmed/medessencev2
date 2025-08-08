"""
Health check endpoints
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import openai

from app.core.database import get_db
from app.core.config import get_settings
from app.schemas.report_schemas import HealthResponse

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.get(
    "/",
    response_model=HealthResponse,
    summary="Health check",
    description="Check the health status of the medical report generation service"
)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check for the service"""
    
    try:
        # Check database connectivity
        database_status = await _check_database_health(db)
        
        # Check OpenAI API connectivity
        openai_status = await _check_openai_health()
        
        # Check other dependencies
        dependencies = {
            "database": database_status,
            "openai_api": openai_status,
            "redis": "not_implemented",  # Would check Redis if implemented
            "file_storage": "not_implemented"  # Would check file storage if implemented
        }
        
        # Determine overall status
        overall_status = "healthy" if all(
            status == "healthy" for status in dependencies.values() 
            if status != "not_implemented"
        ) else "unhealthy"
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.utcnow().isoformat(),
            version=settings.VERSION,
            database_status=database_status,
            openai_status=openai_status,
            dependencies=dependencies
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


@router.get(
    "/ready",
    summary="Readiness check",
    description="Check if the service is ready to accept requests"
)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Check if service is ready to handle requests"""
    
    try:
        # Basic database connectivity check
        await db.execute(text("SELECT 1"))
        
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Service is ready to accept requests"
        }
        
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Service not ready")


@router.get(
    "/live",
    summary="Liveness check",
    description="Check if the service is alive and running"
)
async def liveness_check():
    """Simple liveness check"""
    
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Service is alive"
    }


@router.get(
    "/metrics",
    summary="Service metrics",
    description="Get basic service metrics and statistics"
)
async def get_metrics(db: AsyncSession = Depends(get_db)):
    """Get service metrics"""
    
    try:
        # This would typically return metrics like:
        # - Number of reports generated
        # - Average processing time
        # - Error rates
        # - Database connection pool status
        # - Memory usage
        # etc.
        
        # For now, return placeholder metrics
        metrics = {
            "reports_generated_total": 0,  # Would be actual count from database
            "reports_generated_today": 0,
            "average_processing_time_seconds": 0.0,
            "error_rate_percent": 0.0,
            "active_database_connections": 0,
            "memory_usage_mb": 0,
            "cpu_usage_percent": 0.0,
            "uptime_seconds": 0
        }
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        }
        
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving metrics")


async def _check_database_health(db: AsyncSession) -> str:
    """Check database health"""
    
    try:
        # Execute a simple query
        result = await db.execute(text("SELECT version()"))
        version = result.scalar()
        
        if version:
            logger.debug(f"Database connection healthy, version: {version}")
            return "healthy"
        else:
            return "unhealthy"
            
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return "unhealthy"


async def _check_openai_health() -> str:
    """Check OpenAI API health"""
    
    try:
        # Try to make a simple API call to check connectivity
        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Make a minimal API call
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",  # Use cheaper model for health check
            messages=[{"role": "user", "content": "Health check"}],
            max_tokens=5,
            temperature=0
        )
        
        if response and response.choices:
            logger.debug("OpenAI API connection healthy")
            return "healthy"
        else:
            return "unhealthy"
            
    except openai.APIError as e:
        logger.error(f"OpenAI API health check failed: {e}")
        return "unhealthy"
    except Exception as e:
        logger.error(f"OpenAI health check error: {e}")
        return "unhealthy"