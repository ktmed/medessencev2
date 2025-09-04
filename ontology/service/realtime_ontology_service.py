#!/usr/bin/env python3
"""
Real-time Medical Ontology Service
FastAPI service for real-time transcription correction and findings extraction
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Set
import json
import re
import logging
from pathlib import Path
from fuzzywuzzy import fuzz, process
from datetime import datetime
import asyncio
from collections import defaultdict
import uvicorn

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models
class TranscriptionRequest(BaseModel):
    text: str
    context: Optional[str] = None
    confidence_threshold: float = 0.8

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
    confidence: float

class EntityExtractionRequest(BaseModel):
    text: str
    extract_relationships: bool = True
    extract_measurements: bool = True

class ExtractedEntity(BaseModel):
    text: str
    category: str
    confidence: float
    position: int
    context: str

class EntityExtractionResult(BaseModel):
    entities: List[ExtractedEntity]
    relationships: List[Dict[str, str]]
    measurements: List[Dict[str, str]]
    patterns: List[str]

class RealtimeOntologyService:
    """Real-time medical ontology service optimized for fast lookups"""
    
    def __init__(self, ontology_path: str = None):
        # Default to relative path from service directory
        if ontology_path is None:
            ontology_path = Path(__file__).parent.parent / 'data' / 'ontology_output'
        self.ontology_path = Path(ontology_path)
        self.ontology = {}
        self.lookup_structures = {}
        self.entity_index = {}
        self.fuzzy_cache = {}
        self.abbreviations = {}
        self.load_ontology()
        
    def load_ontology(self):
        """Load ontology and build optimized lookup structures"""
        logger.info("Loading medical ontology...")
        
        # Load main ontology
        ontology_file = self.ontology_path / "medical_ontology.json"
        if not ontology_file.exists():
            logger.error(f"Ontology file not found: {ontology_file}")
            return
            
        with open(ontology_file, 'r', encoding='utf-8') as f:
            self.ontology = json.load(f)
            
        # Load lookup structures if available
        lookup_file = self.ontology_path / "lookup_structures.json"
        if lookup_file.exists():
            with open(lookup_file, 'r', encoding='utf-8') as f:
                self.lookup_structures = json.load(f)
        else:
            self.build_lookup_structures()
            
        # Build entity index for fast lookups
        self.build_entity_index()
        
        # Load abbreviations
        self.abbreviations = self.ontology.get('abbreviations', {})
        
        logger.info(f"Loaded ontology with {len(self.entity_index)} entities")
        
    def build_lookup_structures(self):
        """Build optimized lookup structures"""
        logger.info("Building lookup structures...")
        
        self.lookup_structures = {
            'entity_lookup': {},
            'prefix_lookup': defaultdict(list),
            'fuzzy_lookup': {},
            'abbreviation_lookup': {}
        }
        
        # Categories to process (skip metadata)
        entity_categories = ['anatomy', 'pathology', 'procedures', 'measurements', 
                           'modifiers', 'medications', 'symptoms']
        
        # Build from ontology entities
        for category in entity_categories:
            if category in self.ontology:
                data = self.ontology[category]
                if isinstance(data, dict):
                    # Data is in format {term: frequency}
                    for entity, frequency in data.items():
                        entity_lower = entity.lower()
                        
                        # Entity lookup
                        self.lookup_structures['entity_lookup'][entity_lower] = {
                            'category': category,
                            'original': entity,
                            'frequency': frequency
                        }
                        
                        # Prefix lookup
                        for i in range(1, min(len(entity_lower) + 1, 15)):
                            prefix = entity_lower[:i]
                            self.lookup_structures['prefix_lookup'][prefix].append({
                                'entity': entity,
                                'category': category,
                                'frequency': frequency
                            })
                        
        # Sort prefix lookups by frequency
        for prefix in self.lookup_structures['prefix_lookup']:
            self.lookup_structures['prefix_lookup'][prefix].sort(
                key=lambda x: x['frequency'], reverse=True
            )
            
    def build_entity_index(self):
        """Build fast entity index for real-time lookups"""
        self.entity_index = {}
        
        # Categories to process (skip metadata)
        entity_categories = ['anatomy', 'pathology', 'procedures', 'measurements', 
                           'modifiers', 'medications', 'symptoms']
        
        for category in entity_categories:
            if category in self.ontology:
                data = self.ontology[category]
                if isinstance(data, dict):
                    # Data is in format {term: frequency}
                    for entity, frequency in data.items():
                        variations = [
                            entity,
                            entity.lower(),
                            entity.upper(),
                            entity.capitalize()
                        ]
                        
                        for variation in variations:
                            self.entity_index[variation] = {
                                'category': category,
                                'canonical': entity,
                                'frequency': frequency
                            }
                        
    async def correct_transcription(self, request: TranscriptionRequest) -> List[CorrectionSuggestion]:
        """Real-time transcription correction"""
        corrections = []
        text = request.text
        
        # Tokenize text
        words = re.findall(r'\b\w+\b', text)
        
        for i, word in enumerate(words):
            word_lower = word.lower()
            
            # Direct lookup first (fastest)
            if word_lower in self.entity_index:
                entity_info = self.entity_index[word_lower]
                if entity_info['canonical'] != word:  # Needs correction
                    corrections.append(CorrectionSuggestion(
                        original=word,
                        suggested=entity_info['canonical'],
                        confidence=1.0,
                        category=entity_info['category'],
                        position=i
                    ))
            else:
                # Fuzzy matching for potential corrections
                fuzzy_match = await self.fuzzy_match(word, request.confidence_threshold)
                if fuzzy_match:
                    corrections.append(CorrectionSuggestion(
                        original=word,
                        suggested=fuzzy_match['entity'],
                        confidence=fuzzy_match['confidence'],
                        category=fuzzy_match['category'],
                        position=i
                    ))
                    
        return corrections
        
    async def fuzzy_match(self, word: str, threshold: float = 0.8) -> Optional[Dict]:
        """Fuzzy matching with caching"""
        # Check cache first
        cache_key = f"{word.lower()}_{threshold}"
        if cache_key in self.fuzzy_cache:
            return self.fuzzy_cache[cache_key]
            
        # Get all entity candidates
        candidates = []
        for entity, info in self.entity_index.items():
            if len(entity) > 2:  # Skip very short entities
                candidates.append((entity, info))
                
        if not candidates:
            return None
            
        # Use fuzzy string matching
        entity_names = [candidate[0] for candidate in candidates]
        matches = process.extract(word, entity_names, limit=3, scorer=fuzz.ratio)
        
        best_match = None
        for match_text, confidence in matches:
            confidence_normalized = confidence / 100.0
            if confidence_normalized >= threshold:
                # Find the entity info
                for candidate_text, info in candidates:
                    if candidate_text == match_text:
                        best_match = {
                            'entity': info['canonical'],
                            'confidence': confidence_normalized,
                            'category': info['category']
                        }
                        break
                break
                
        # Cache result
        self.fuzzy_cache[cache_key] = best_match
        
        # Limit cache size
        if len(self.fuzzy_cache) > 10000:
            # Remove oldest entries
            keys_to_remove = list(self.fuzzy_cache.keys())[:1000]
            for key in keys_to_remove:
                del self.fuzzy_cache[key]
                
        return best_match
        
    async def get_autocomplete(self, request: AutoCompleteRequest) -> List[AutoCompleteResult]:
        """Get auto-completion suggestions"""
        prefix_lower = request.prefix.lower()
        results = []
        
        # Get from prefix lookup
        if prefix_lower in self.lookup_structures.get('prefix_lookup', {}):
            candidates = self.lookup_structures['prefix_lookup'][prefix_lower]
            
            # Filter by category if specified
            if request.category_filter:
                candidates = [c for c in candidates if c['category'] in request.category_filter]
                
            # Convert to results
            for candidate in candidates[:request.max_results]:
                results.append(AutoCompleteResult(
                    suggestion=candidate['entity'],
                    category=candidate['category'],
                    frequency=candidate['frequency'],
                    confidence=1.0  # Exact prefix match
                ))
                
        # If not enough results, try fuzzy matching
        if len(results) < request.max_results:
            fuzzy_results = await self.fuzzy_autocomplete(
                request.prefix, 
                request.max_results - len(results),
                request.category_filter
            )
            results.extend(fuzzy_results)
            
        return results[:request.max_results]
        
    async def fuzzy_autocomplete(self, prefix: str, max_results: int, category_filter: Optional[List[str]] = None) -> List[AutoCompleteResult]:
        """Fuzzy auto-completion for partial matches"""
        results = []
        candidates = []
        
        # Get candidates from entity index
        for entity, info in self.entity_index.items():
            if len(entity) >= len(prefix):
                if category_filter and info['category'] not in category_filter:
                    continue
                candidates.append((entity, info))
                
        if not candidates:
            return results
            
        # Use fuzzy matching
        entity_names = [candidate[0] for candidate in candidates]
        matches = process.extract(prefix, entity_names, limit=max_results * 2, scorer=fuzz.partial_ratio)
        
        seen_canonical = set()
        for match_text, confidence in matches:
            if len(results) >= max_results:
                break
                
            confidence_normalized = confidence / 100.0
            if confidence_normalized < 0.6:  # Lower threshold for autocomplete
                continue
                
            # Find entity info
            for candidate_text, info in candidates:
                if candidate_text == match_text and info['canonical'] not in seen_canonical:
                    results.append(AutoCompleteResult(
                        suggestion=info['canonical'],
                        category=info['category'],
                        frequency=info['frequency'],
                        confidence=confidence_normalized
                    ))
                    seen_canonical.add(info['canonical'])
                    break
                    
        return results
        
    async def extract_entities(self, request: EntityExtractionRequest) -> EntityExtractionResult:
        """Extract structured medical entities from text"""
        text = request.text
        entities = []
        relationships = []
        measurements = []
        patterns = []
        
        # Extract entities using pattern matching and fuzzy lookup
        words = re.finditer(r'\b\w+\b', text)
        
        for match in words:
            word = match.group()
            position = match.start()
            
            # Check direct lookup
            if word.lower() in self.entity_index:
                entity_info = self.entity_index[word.lower()]
                
                # Get context (10 chars before and after)
                context_start = max(0, position - 10)
                context_end = min(len(text), position + len(word) + 10)
                context = text[context_start:context_end].strip()
                
                entities.append(ExtractedEntity(
                    text=entity_info['canonical'],
                    category=entity_info['category'],
                    confidence=1.0,
                    position=position,
                    context=context
                ))
                
        # Extract measurements if requested
        if request.extract_measurements:
            measurement_patterns = [
                r'(\d+(?:\.\d+)?)\s*(mm|cm|°|grad)',
                r'(grad|stadium)\s*([I-V]+|\d+)',
                r'(\d+)\s*prozent'
            ]
            
            for pattern in measurement_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    measurements.append({
                        'value': match.group(1),
                        'unit': match.group(2) if len(match.groups()) > 1 else '',
                        'position': match.start(),
                        'context': text[max(0, match.start()-10):match.end()+10].strip()
                    })
                    
        # Extract relationships if requested
        if request.extract_relationships:
            relationship_patterns = [
                (r'(\w+)\s+(von|der|des)\s+(\w+)', 'located_in'),
                (r'(\w+)\s+(mit|bei)\s+(\w+)', 'associated_with'),
                (r'(\w+)\s+(zeigt|weist auf)\s+(\w+)', 'shows'),
                (r'(\w+)-bedingte?\s+(\w+)', 'causes')
            ]
            
            for pattern, relation_type in relationship_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    if len(match.groups()) >= 3:
                        relationships.append({
                            'subject': match.group(1),
                            'predicate': relation_type,
                            'object': match.group(3),
                            'position': match.start()
                        })
                        
        # Extract common patterns
        common_patterns = [
            r'es zeigt sich \w+',
            r'darstellung \w+ \w+',
            r'im \w+ \w+ \w+',
            r'verdacht auf \w+',
            r'zustand nach \w+'
        ]
        
        for pattern in common_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            patterns.extend(matches)
            
        return EntityExtractionResult(
            entities=entities,
            relationships=relationships,
            measurements=measurements,
            patterns=patterns
        )
        
    async def expand_abbreviation(self, abbrev: str) -> Optional[str]:
        """Expand medical abbreviations"""
        return self.abbreviations.get(abbrev.upper())

# Initialize FastAPI app
app = FastAPI(
    title="Medical Ontology Service",
    description="Real-time medical ontology service for German radiology reports",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize service
ontology_service = None

@app.on_event("startup")
async def startup_event():
    """Initialize the ontology service on startup"""
    global ontology_service
    # Service will automatically use relative path to data directory
    ontology_service = RealtimeOntologyService()
    logger.info("Medical Ontology Service started successfully")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "entities_loaded": len(ontology_service.entity_index) if ontology_service else 0
    }

@app.post("/correct", response_model=List[CorrectionSuggestion])
async def correct_transcription(request: TranscriptionRequest):
    """Real-time transcription correction"""
    if not ontology_service:
        raise HTTPException(status_code=503, detail="Ontology service not initialized")
    
    try:
        corrections = await ontology_service.correct_transcription(request)
        return corrections
    except Exception as e:
        logger.error(f"Error in transcription correction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/autocomplete", response_model=List[AutoCompleteResult])
async def get_autocomplete(request: AutoCompleteRequest):
    """Get auto-completion suggestions"""
    if not ontology_service:
        raise HTTPException(status_code=503, detail="Ontology service not initialized")
        
    try:
        suggestions = await ontology_service.get_autocomplete(request)
        return suggestions
    except Exception as e:
        logger.error(f"Error in auto-completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract", response_model=EntityExtractionResult)
async def extract_entities(request: EntityExtractionRequest):
    """Extract structured medical entities"""
    if not ontology_service:
        raise HTTPException(status_code=503, detail="Ontology service not initialized")
        
    try:
        result = await ontology_service.extract_entities(request)
        return result
    except Exception as e:
        logger.error(f"Error in entity extraction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/expand/{abbreviation}")
async def expand_abbreviation(abbreviation: str):
    """Expand medical abbreviation"""
    if not ontology_service:
        raise HTTPException(status_code=503, detail="Ontology service not initialized")
        
    expanded = await ontology_service.expand_abbreviation(abbreviation)
    if expanded:
        return {"abbreviation": abbreviation, "expanded": expanded}
    else:
        return {"abbreviation": abbreviation, "expanded": abbreviation}

@app.get("/stats")
async def get_ontology_stats():
    """Get ontology statistics"""
    if not ontology_service:
        raise HTTPException(status_code=503, detail="Ontology service not initialized")
        
    return {
        "total_entities": len(ontology_service.entity_index),
        "categories": len(ontology_service.ontology.get('entities', {})),
        "abbreviations": len(ontology_service.abbreviations),
        "cache_size": len(ontology_service.fuzzy_cache),
        "ontology_metadata": ontology_service.ontology.get('metadata', {})
    }

if __name__ == "__main__":
    uvicorn.run(
        "realtime_ontology_service:app",
        host="0.0.0.0",
        port=8002,  # Different port from existing services
        reload=True,
        log_level="info"
    )