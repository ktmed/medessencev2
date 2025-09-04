# Medical Ontology System

Real-time medical term correction and extraction service for German radiology reports.

## Overview

This ontology system processes 6.3M+ medical entities extracted from 116,495 German radiology reports to provide:
- Real-time transcription correction
- Medical term auto-completion
- Entity extraction and classification
- Pattern-based report generation

## Structure

```
ontology/
├── service/                      # Python ontology service
│   ├── realtime_ontology_service.py  # FastAPI service (port 8002)
│   ├── medical_ontology_builder.py   # Build ontology from medical reports
│   └── advanced_pattern_matcher.py   # Extract medical patterns
├── data/                         # Ontology data files
│   └── ontology_output/         # Generated ontology JSON files
│       ├── medical_ontology.json    # 6.3M+ medical entities
│       └── ontology_statistics.json # Usage statistics
├── client/                      # TypeScript client
│   └── frontend_ontology_client.ts  # Frontend integration
└── requirements.txt            # Python dependencies
```

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start Service
```bash
cd service
python realtime_ontology_service.py
```

Service runs on: http://localhost:8002
API docs: http://localhost:8002/docs

## API Endpoints

### Health Check
```bash
GET /health
```

### Real-time Correction
```bash
POST /correct
{
  "text": "lymphknoten und torax zeigen stenose",
  "confidence_threshold": 0.7
}
```

### Auto-completion
```bash
POST /autocomplete
{
  "prefix": "lymph",
  "max_results": 5
}
```

### Entity Extraction
```bash
POST /extract
{
  "text": "MRT der LWS zeigt Bandscheibenprotrusion",
  "extract_relationships": true,
  "extract_measurements": true
}
```

## Statistics

- **Total Entities**: 6,367,534
- **Loaded Entities**: 6,259 (core medical terms)
- **Categories**: anatomy, pathology, procedures, measurements, modifiers, medications, symptoms
- **Top Terms**: Lymphknoten (452K), Thorax (66K), MRT (376K), Sonographie (296K)

## Integration

The ontology service integrates with the main application through:
- Frontend API route: `/api/ontology/route.ts`
- Service client: `services/ontologyService.ts`
- Speech hook: `hooks/useEnhancedSpeechToText.ts`

## Building New Ontology

To rebuild the ontology from new medical reports:

```bash
cd service
python medical_ontology_builder.py --data-path /path/to/reports
python advanced_pattern_matcher.py
```

## Performance

- Response time: <200ms for corrections
- Cache: 5-minute LRU cache for frequent queries
- Fuzzy matching: 90%+ accuracy on misspellings
- Auto-complete: Instant prefix-based suggestions