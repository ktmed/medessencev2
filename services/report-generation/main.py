"""
Medical Report Generation Service
FastAPI service for generating structured German medical reports from transcribed text.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from app.api.routes import reports, templates, health
from app.core.config import get_settings
from app.core.database import init_db, get_db
from app.core.exceptions import (
    MedicalReportException,
    DatabaseException,
    OpenAIException,
    ValidationException
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Medical Report Generation Service")
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Medical Report Generation Service")


# Create FastAPI app
app = FastAPI(
    title="Medical Report Generation Service",
    description="AI-powered medical report generation for radiology departments",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(MedicalReportException)
async def medical_report_exception_handler(request, exc: MedicalReportException):
    logger.error(f"Medical report error: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "type": "medical_report_error"}
    )


@app.exception_handler(DatabaseException)
async def database_exception_handler(request, exc: DatabaseException):
    logger.error(f"Database error: {exc.message}")
    return JSONResponse(
        status_code=500,
        content={"error": "Database error occurred", "type": "database_error"}
    )


@app.exception_handler(OpenAIException)
async def openai_exception_handler(request, exc: OpenAIException):
    logger.error(f"OpenAI API error: {exc.message}")
    return JSONResponse(
        status_code=503,
        content={"error": "AI service temporarily unavailable", "type": "ai_service_error"}
    )


@app.exception_handler(ValidationException)
async def validation_exception_handler(request, exc: ValidationException):
    logger.warning(f"Validation error: {exc.message}")
    return JSONResponse(
        status_code=400,
        content={"error": exc.message, "type": "validation_error"}
    )


# Include routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Medical Report Generation Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=settings.DEBUG,
        log_level="info"
    )