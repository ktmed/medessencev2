"""
Unified Backend Service for MedEssence
Includes ontology service and other backend functionality
"""
import os
import sys
from pathlib import Path

# Add ontology service to path
sys.path.insert(0, str(Path(__file__).parent / 'ontology' / 'service'))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Import database-backed ontology service
from db_ontology_service import app as ontology_app

# Create main app
app = FastAPI(title="MedEssence Backend", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount ontology service under /ontology path
app.mount("/ontology", ontology_app)

# Root endpoint
@app.get("/")
async def root():
    return {
        "service": "MedEssence Backend",
        "version": "1.0.0",
        "endpoints": {
            "ontology": "/ontology/docs",
            "health": "/health"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "medessence-backend"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)