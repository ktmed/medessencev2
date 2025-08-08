"""
Main FastAPI application for Patient-Friendly Summary Generation Service.
Converts complex German medical reports to patient-friendly summaries in multiple languages.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import health, summaries, languages, complexity
from app.core.config import get_settings
from app.core.database import init_db
from app.core.exceptions import SummaryGenerationException
from app.utils.logging_config import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    logger.info("Starting Summary Generation Service...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized successfully")
    
    yield
    
    logger.info("Shutting down Summary Generation Service...")


# Create FastAPI application
app = FastAPI(
    title="Patient-Friendly Summary Generation Service",
    description="Converts complex German medical reports to patient-friendly summaries in multiple languages",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(SummaryGenerationException)
async def summary_generation_exception_handler(request: Request, exc: SummaryGenerationException):
    logger.error(f"Summary generation error: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "type": "summary_generation_error"}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "type": "internal_error"}
    )


# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(summaries.router, prefix="", tags=["Summaries"])
app.include_router(languages.router, prefix="/languages", tags=["Languages"])
app.include_router(complexity.router, prefix="/complexity-levels", tags=["Complexity"])


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Patient-Friendly Summary Generation",
        "version": "1.0.0",
        "status": "active",
        "description": "Converts complex German medical reports to patient-friendly summaries"
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )