#!/usr/bin/env python3
"""
Database-backed Medical Ontology Service
FastAPI service using PostgreSQL for real-time transcription correction
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor
import logging
from datetime import datetime
from fuzzywuzzy import fuzz
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models
class TranscriptionRequest(BaseModel):
    text: str
    context: Optional[str] = None
    confidence_threshold: float = 0.7

class CorrectionSuggestion(BaseModel):
    original: str
    suggested: str
    confidence: float
    category: str
    position: int
    
class AutoCompleteRequest(BaseModel):
    prefix: str
    max_results: int = 10
    category_filter: Optional[List[str]] = None
    
class AutoCompleteResult(BaseModel):
    suggestion: str
    category: str
    frequency: int

class DatabaseOntologyService:
    """PostgreSQL-backed medical ontology service"""
    
    def __init__(self):
        self.pool = None
        self.entity_count = 0
        self.init_database()
        
    def init_database(self):
        """Initialize database connection pool"""
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            logger.warning("DATABASE_URL not set, ontology service will not be available")
            return
        
        # Handle Heroku's postgres:// URL format
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        try:
            self.pool = SimpleConnectionPool(1, 5, database_url)
            logger.info("Database connection pool created")
            
            # Get entity count
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) FROM medical_entities")
                    self.entity_count = cursor.fetchone()[0]
                    logger.info(f"Loaded {self.entity_count} medical entities from database")
                    
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            self.pool = None
    
    def get_connection(self):
        """Get a connection from the pool"""
        if not self.pool:
            raise HTTPException(status_code=503, detail="Database not available")
        return self.pool.getconn()
    
    def return_connection(self, conn):
        """Return connection to pool"""
        if self.pool and conn:
            self.pool.putconn(conn)
    
    def correct_text(self, text: str, confidence_threshold: float = 0.7) -> List[CorrectionSuggestion]:
        """Correct misspelled medical terms using database"""
        if not self.pool:
            return []
        
        corrections = []
        words = text.split()
        
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                for i, word in enumerate(words):
                    # Skip short words
                    if len(word) < 3:
                        continue
                    
                    # First try exact match
                    cursor.execute("""
                        SELECT term, category, frequency 
                        FROM medical_entities 
                        WHERE term_lower = LOWER(%s)
                        LIMIT 1
                    """, (word,))
                    
                    result = cursor.fetchone()
                    if result:
                        continue  # Word is correct
                    
                    # Try fuzzy matching for potential corrections
                    # Use a lower threshold for SQL query to get more candidates
                    sql_threshold = max(0.2, confidence_threshold - 0.3)
                    cursor.execute("""
                        SELECT term, category, frequency,
                               similarity(LOWER(%s), term_lower) as sim
                        FROM medical_entities
                        WHERE LENGTH(term) BETWEEN %s AND %s
                        AND similarity(LOWER(%s), term_lower) > %s
                        ORDER BY sim DESC, frequency DESC
                        LIMIT 5
                    """, (word, len(word) - 3, len(word) + 3, word, sql_threshold))
                    
                    matches = cursor.fetchall()
                    if matches:
                        # Try multiple fuzzy matching methods and use the best one
                        for match in matches[:3]:  # Check top 3 matches
                            # Try different fuzzy matching algorithms
                            ratio1 = fuzz.ratio(word.lower(), match['term'].lower()) / 100.0
                            ratio2 = fuzz.partial_ratio(word.lower(), match['term'].lower()) / 100.0
                            # Use the better score
                            ratio = max(ratio1, ratio2)
                            
                            if ratio >= confidence_threshold:
                                corrections.append(CorrectionSuggestion(
                                    original=word,
                                    suggested=match['term'],
                                    confidence=ratio,
                                    category=match['category'],
                                    position=i
                                ))
                                break  # Only add the first good match
                            
        except Exception as e:
            logger.error(f"Error in correct_text: {e}")
        finally:
            if conn:
                self.return_connection(conn)
        
        return corrections
    
    def autocomplete(self, prefix: str, max_results: int = 10, 
                    category_filter: Optional[List[str]] = None) -> List[AutoCompleteResult]:
        """Get autocomplete suggestions from database"""
        if not self.pool or len(prefix) < 2:
            return []
        
        suggestions = []
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                if category_filter:
                    cursor.execute("""
                        SELECT term, category, frequency
                        FROM medical_entities
                        WHERE term_lower LIKE LOWER(%s) || '%%'
                        AND category = ANY(%s)
                        ORDER BY frequency DESC, LENGTH(term)
                        LIMIT %s
                    """, (prefix, category_filter, max_results))
                else:
                    cursor.execute("""
                        SELECT term, category, frequency
                        FROM medical_entities
                        WHERE term_lower LIKE LOWER(%s) || '%%'
                        ORDER BY frequency DESC, LENGTH(term)
                        LIMIT %s
                    """, (prefix, max_results))
                
                results = cursor.fetchall()
                for row in results:
                    suggestions.append(AutoCompleteResult(
                        suggestion=row['term'],
                        category=row['category'],
                        frequency=row['frequency']
                    ))
                    
        except Exception as e:
            logger.error(f"Error in autocomplete: {e}")
        finally:
            if conn:
                self.return_connection(conn)
        
        return suggestions
    
    def extract_entities(self, text: str) -> List[Dict]:
        """Extract medical entities from text"""
        if not self.pool:
            return []
        
        entities = []
        words = text.lower().split()
        
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Check single words and bigrams
                for i in range(len(words)):
                    # Single word
                    cursor.execute("""
                        SELECT term, category, frequency
                        FROM medical_entities
                        WHERE term_lower = %s
                        LIMIT 1
                    """, (words[i],))
                    
                    result = cursor.fetchone()
                    if result:
                        entities.append({
                            'text': result['term'],
                            'category': result['category'],
                            'position': i,
                            'confidence': 1.0
                        })
                    
                    # Bigram
                    if i < len(words) - 1:
                        bigram = f"{words[i]} {words[i+1]}"
                        cursor.execute("""
                            SELECT term, category, frequency
                            FROM medical_entities
                            WHERE term_lower = %s
                            LIMIT 1
                        """, (bigram,))
                        
                        result = cursor.fetchone()
                        if result:
                            entities.append({
                                'text': result['term'],
                                'category': result['category'],
                                'position': i,
                                'confidence': 1.0
                            })
                            
        except Exception as e:
            logger.error(f"Error in extract_entities: {e}")
        finally:
            if conn:
                self.return_connection(conn)
        
        return entities

# Create FastAPI app
app = FastAPI(title="Database Ontology Service", version="2.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize service
service = DatabaseOntologyService()

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("Starting Database Ontology Service...")
    if service.entity_count > 0:
        logger.info(f"Service ready with {service.entity_count} entities")
    else:
        logger.warning("Service started but no entities loaded")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    if service.pool:
        service.pool.closeall()
        logger.info("Database connections closed")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if service.pool else "degraded",
        "timestamp": datetime.now().isoformat(),
        "entities_loaded": service.entity_count,
        "database_connected": service.pool is not None
    }

@app.post("/correct")
async def correct_transcription(request: TranscriptionRequest):
    """Correct medical terms in transcription"""
    if not service.pool:
        raise HTTPException(status_code=503, detail="Ontology service not available")
    
    corrections = service.correct_text(request.text, request.confidence_threshold)
    return [c.dict() for c in corrections]

@app.post("/autocomplete")
async def autocomplete(request: AutoCompleteRequest):
    """Get autocomplete suggestions"""
    if not service.pool:
        return []
    
    suggestions = service.autocomplete(
        request.prefix, 
        request.max_results, 
        request.category_filter
    )
    return [s.dict() for s in suggestions]

@app.post("/extract")
async def extract_entities(text: str):
    """Extract medical entities from text"""
    if not service.pool:
        return {"entities": []}
    
    entities = service.extract_entities(text)
    return {"entities": entities}

@app.get("/stats")
async def get_statistics():
    """Get ontology statistics"""
    if not service.pool:
        return {"error": "Database not available"}
    
    stats = {}
    conn = None
    try:
        conn = service.get_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Get category counts
            cursor.execute("""
                SELECT category, COUNT(*) as count
                FROM medical_entities
                GROUP BY category
                ORDER BY count DESC
            """)
            stats['categories'] = cursor.fetchall()
            
            # Get top terms
            cursor.execute("""
                SELECT term, category, frequency
                FROM medical_entities
                ORDER BY frequency DESC
                LIMIT 20
            """)
            stats['top_terms'] = cursor.fetchall()
            
            stats['total_entities'] = service.entity_count
            
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        stats['error'] = str(e)
    finally:
        if conn:
            service.return_connection(conn)
    
    return stats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)