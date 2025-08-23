"""
FastAPI Server for Medical Ontology and Semantic Enhancement Services
Provides REST API endpoints for ontology-based medical text processing
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import uvicorn
import logging
from datetime import datetime
import asyncio

from medical_ontology import (
    MedicalOntology, 
    Patient, 
    MedicalReport, 
    Diagnosis, 
    Finding,
    EntityType,
    RelationshipType,
    ModalityType
)
from integration_api import SemanticEnhancementService
from semantic_layer import MedicalSemanticETL

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="MedEssence Ontology Service",
    description="Semantic enhancement and ontology services for medical transcription",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://medessencev3-test.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
semantic_service = SemanticEnhancementService()
ontology = MedicalOntology()
etl = MedicalSemanticETL()

# Pydantic models for API requests/responses
class TranscriptionEnhancementRequest(BaseModel):
    transcription_text: str = Field(..., description="Medical transcription text in German")
    modality: Optional[str] = Field("mammographie", description="Medical imaging modality")
    patient_id: Optional[str] = Field(None, description="Patient identifier")
    language: str = Field("de", description="Language code")

class ICDSuggestionRequest(BaseModel):
    text: str = Field(..., description="Medical text for ICD code suggestion")
    modality: Optional[str] = Field(None, description="Medical modality for context")
    max_results: int = Field(10, description="Maximum number of suggestions")

class ReportAnalysisRequest(BaseModel):
    report_text: str = Field(..., description="Medical report text")
    report_type: str = Field("radiology", description="Type of medical report")
    extract_entities: bool = Field(True, description="Extract medical entities")
    generate_relationships: bool = Field(True, description="Generate entity relationships")

class PatientOntologyRequest(BaseModel):
    patient_id: str = Field(..., description="Patient identifier")
    patient_age: Optional[int] = Field(None, description="Patient age")
    patient_gender: Optional[str] = Field(None, description="Patient gender")

class OntologyEntity(BaseModel):
    entity_type: str
    name: str
    description: str
    metadata: Dict[str, Any] = {}
    confidence_score: float = 1.0

class OntologyRelationship(BaseModel):
    relationship_type: str
    source_entity_id: str
    target_entity_id: str
    confidence: float = 1.0

# API Endpoints

@app.get("/")
async def root():
    """Health check and service information"""
    return {
        "service": "MedEssence Ontology Service",
        "status": "operational",
        "version": "1.0.0",
        "endpoints": {
            "enhance_transcription": "/api/enhance-transcription",
            "suggest_icd_codes": "/api/suggest-icd-codes",
            "analyze_report": "/api/analyze-report",
            "create_patient": "/api/ontology/patient",
            "get_statistics": "/api/ontology/statistics"
        }
    }

@app.post("/api/enhance-transcription")
async def enhance_transcription(request: TranscriptionEnhancementRequest):
    """
    Enhance medical transcription with semantic annotations
    """
    try:
        logger.info(f"Enhancing transcription: {len(request.transcription_text)} chars")
        
        enhancement = await semantic_service.enhance_transcription(
            request.transcription_text,
            request.modality
        )
        
        # Add patient context if provided
        if request.patient_id:
            patient = ontology.find_patient_by_id(request.patient_id)
            if patient:
                enhancement['patient_context'] = {
                    'id': patient.patient_id,
                    'age': patient.age,
                    'gender': patient.gender
                }
        
        return {
            "success": True,
            "data": enhancement,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error enhancing transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/suggest-icd-codes")
async def suggest_icd_codes(request: ICDSuggestionRequest):
    """
    Suggest ICD-10-GM codes based on medical text
    """
    try:
        logger.info(f"Suggesting ICD codes for text: {len(request.text)} chars")
        
        # Initialize service if needed
        await semantic_service.initialize()
        
        # Get ICD suggestions
        suggestions = semantic_service.icd_database.search_by_text(
            request.text, 
            max_results=request.max_results
        )
        
        # Add modality-specific suggestions
        modality_suggestions = []
        if request.modality:
            modality_codes = semantic_service.icd_database.suggest_codes_for_modality(
                request.modality
            )
            modality_suggestions = modality_codes[:5]
        
        # Format response
        result = {
            "text_based_suggestions": [
                {
                    "code": s.icd_code,
                    "description": s.label,
                    "chapter": s.chapter_nr,
                    "terminal": s.is_terminal,
                    "confidence": 0.8
                }
                for s in suggestions
            ],
            "modality_specific_suggestions": [
                {
                    "code": s.icd_code,
                    "description": s.label,
                    "chapter": s.chapter_nr,
                    "terminal": s.is_terminal,
                    "confidence": 0.9
                }
                for s in modality_suggestions
            ] if modality_suggestions else [],
            "total_suggestions": len(suggestions) + len(modality_suggestions)
        }
        
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error suggesting ICD codes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-report")
async def analyze_report(request: ReportAnalysisRequest):
    """
    Analyze medical report and extract entities and relationships
    """
    try:
        logger.info(f"Analyzing report: {len(request.report_text)} chars")
        
        # Create report entity
        report = MedicalReport(
            report_text=request.report_text,
            language="de"
        )
        report_id = ontology.add_entity(report)
        
        analysis = {
            "report_id": report_id,
            "entities": [],
            "relationships": [],
            "findings": [],
            "icd_suggestions": []
        }
        
        if request.extract_entities:
            # Extract medical entities using NLP
            findings = etl.medical_nlp.extract_findings(request.report_text)
            
            for finding_text in findings:
                finding = Finding(
                    finding_text=finding_text,
                    finding_type="extracted"
                )
                finding_id = ontology.add_entity(finding)
                
                analysis["entities"].append({
                    "id": finding_id,
                    "type": "finding",
                    "text": finding_text
                })
                
                if request.generate_relationships:
                    # Create relationship between report and finding
                    from medical_ontology import MedicalRelationship
                    rel = MedicalRelationship(
                        relationship_type=RelationshipType.CONTAINS_FINDING,
                        source_entity_id=report_id,
                        target_entity_id=finding_id
                    )
                    rel_id = ontology.add_relationship(rel)
                    
                    analysis["relationships"].append({
                        "id": rel_id,
                        "type": "contains_finding",
                        "source": report_id,
                        "target": finding_id
                    })
            
            analysis["findings"] = findings
        
        # Get ICD suggestions
        icd_suggestions = semantic_service.icd_database.search_by_text(
            request.report_text, 
            max_results=5
        )
        
        analysis["icd_suggestions"] = [
            {
                "code": s.icd_code,
                "description": s.label,
                "confidence": 0.85
            }
            for s in icd_suggestions
        ]
        
        return {
            "success": True,
            "data": analysis,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error analyzing report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ontology/patient")
async def create_patient_entity(request: PatientOntologyRequest):
    """
    Create or update patient entity in ontology
    """
    try:
        # Check if patient exists
        existing = ontology.find_patient_by_id(request.patient_id)
        
        if existing:
            # Update existing patient
            if request.patient_age is not None:
                existing.age = request.patient_age
            if request.patient_gender is not None:
                existing.gender = request.patient_gender
            existing.updated_at = datetime.now()
            
            return {
                "success": True,
                "data": {
                    "patient_id": existing.patient_id,
                    "entity_id": existing.id,
                    "action": "updated"
                }
            }
        else:
            # Create new patient
            patient = Patient(
                patient_id=request.patient_id,
                age=request.patient_age,
                gender=request.patient_gender
            )
            entity_id = ontology.add_entity(patient)
            
            return {
                "success": True,
                "data": {
                    "patient_id": request.patient_id,
                    "entity_id": entity_id,
                    "action": "created"
                }
            }
            
    except Exception as e:
        logger.error(f"Error creating patient entity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ontology/statistics")
async def get_ontology_statistics():
    """
    Get current ontology statistics
    """
    try:
        stats = ontology.get_statistics()
        
        return {
            "success": True,
            "data": stats,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ontology/export")
async def export_ontology():
    """
    Export ontology for knowledge graph visualization
    """
    try:
        export_data = ontology.export_for_knowledge_graph()
        
        return {
            "success": True,
            "data": export_data,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error exporting ontology: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting MedEssence Ontology Service...")
    await semantic_service.initialize()
    logger.info("Ontology Service ready!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Ontology Service...")

if __name__ == "__main__":
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )