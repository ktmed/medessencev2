"""
FastAPI Server with PostgreSQL Backend for Medical Ontology Services
High-performance version using direct database queries
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import uvicorn
import logging
from datetime import datetime
import asyncio
import os

# Import PostgreSQL-based semantic service
from integration_api_pg import (
    get_pg_semantic_service,
    enhance_medical_transcription,
    suggest_icd_codes,
    generate_semantic_report
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="MedEssence Ontology Service (PostgreSQL)",
    description="High-performance semantic enhancement using PostgreSQL backend",
    version="2.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3010", 
        "http://localhost:3002",
        "https://medessencev3-test.vercel.app",
        "https://medessencev3.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class TranscriptionEnhancementRequest(BaseModel):
    transcription_text: str = Field(..., description="German medical transcription text")
    modality: Optional[str] = Field("mammographie", description="Medical imaging modality")
    patient_id: Optional[str] = Field(None, description="Patient identifier")
    language: Optional[str] = Field("de", description="Language code")

class ICDSuggestionRequest(BaseModel):
    text: str = Field(..., description="Medical text for ICD code suggestion")
    modality: Optional[str] = Field(None, description="Medical modality context")
    patient_context: Optional[Dict[str, Any]] = Field(None, description="Additional patient context")

class ReportAnalysisRequest(BaseModel):
    report_text: str = Field(..., description="Medical report text to analyze")
    modality: Optional[str] = Field(None, description="Medical modality")
    language: Optional[str] = Field("de", description="Language code")

class SimilarCaseSearchRequest(BaseModel):
    text: Optional[str] = Field(None, description="Text to search for")
    icd_code: Optional[str] = Field(None, description="ICD code filter")
    exam_type: Optional[str] = Field(None, description="Exam type filter")
    limit: Optional[int] = Field(10, description="Maximum results to return")

# Root endpoint
@app.get("/")
async def root():
    """Service status and information"""
    return {
        "service": "MedEssence Ontology Service (PostgreSQL)",
        "status": "operational",
        "version": "2.0.0",
        "backend": "PostgreSQL",
        "endpoints": {
            "enhance_transcription": "/api/enhance-transcription",
            "suggest_icd_codes": "/api/suggest-icd-codes",
            "analyze_report": "/api/analyze-report",
            "search_cases": "/api/search-cases",
            "statistics": "/api/statistics"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        service = get_pg_semantic_service()
        stats = await service.get_statistics()
        
        return {
            "status": "healthy",
            "database": "connected",
            "icd_codes": stats['database_stats']['icd_count'],
            "medical_cases": stats['database_stats']['total_cases']
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

# Main API endpoints
@app.post("/api/enhance-transcription")
async def enhance_transcription_endpoint(request: TranscriptionEnhancementRequest):
    """Enhance medical transcription with semantic annotations and ICD suggestions"""
    try:
        logger.info(f"Enhancing transcription: {len(request.transcription_text)} chars")
        
        result = await enhance_medical_transcription(
            request.transcription_text,
            request.modality
        )
        
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error enhancing transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/suggest-icd-codes")
async def suggest_icd_codes_endpoint(request: ICDSuggestionRequest):
    """Suggest ICD-10-GM codes for medical text"""
    try:
        logger.info(f"Suggesting ICD codes for text: {len(request.text)} chars")
        
        patient_context = request.patient_context or {}
        if request.modality:
            patient_context['modality'] = request.modality
        
        suggestions = await suggest_icd_codes(request.text, patient_context)
        
        return {
            "success": True,
            "data": {
                "suggested_codes": suggestions,
                "total": len(suggestions)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error suggesting ICD codes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-report")
async def analyze_report_endpoint(request: ReportAnalysisRequest):
    """Analyze medical report for entities, findings, and ICD codes"""
    try:
        logger.info(f"Analyzing report: {len(request.report_text)} chars")
        
        service = get_pg_semantic_service()
        analysis = await service.analyze_report(request.report_text)
        
        return {
            "success": True,
            "data": analysis,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error analyzing report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search-cases")
async def search_similar_cases_endpoint(request: SimilarCaseSearchRequest):
    """Search for similar medical cases in database"""
    try:
        logger.info(f"Searching cases with filters")
        
        service = get_pg_semantic_service()
        pg_ontology = service.pg_ontology
        
        cases = await pg_ontology.search_medical_cases(
            icd_code=request.icd_code,
            exam_type=request.exam_type,
            text_search=request.text,
            limit=request.limit
        )
        
        return {
            "success": True,
            "data": {
                "cases": cases,
                "total": len(cases)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error searching cases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/statistics")
async def get_statistics():
    """Get database and ontology statistics"""
    try:
        service = get_pg_semantic_service()
        stats = await service.get_statistics()
        
        return {
            "success": True,
            "data": stats,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting MedEssence Ontology Service with PostgreSQL backend...")
    
    # Initialize semantic service
    service = get_pg_semantic_service()
    await service.initialize()
    
    # Get initial statistics
    stats = await service.get_statistics()
    logger.info(f"PostgreSQL Ontology Service ready!")
    logger.info(f"  - ICD codes: {stats['database_stats']['icd_count']}")
    logger.info(f"  - Medical cases: {stats['database_stats']['total_cases']}")
    logger.info(f"  - Backend: PostgreSQL")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down PostgreSQL Ontology Service...")
    
    service = get_pg_semantic_service()
    await service.cleanup()
    
    logger.info("PostgreSQL connections closed")

# Run the server
if __name__ == "__main__":
    port = int(os.getenv("ONTOLOGY_PORT", "8001"))
    
    uvicorn.run(
        "api_server_pg:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        reload_dirs=["services/semantic"],
        log_level="info"
    )