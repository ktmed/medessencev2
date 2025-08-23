"""
PostgreSQL-based Semantic Integration API for MedEssenceAI
High-performance version using direct database queries
"""

from typing import Dict, List, Optional, Any
import asyncio
import logging
from datetime import datetime

from medical_ontology import MedicalOntology, Patient, MedicalReport, Diagnosis, Finding
from postgres_connector import get_postgres_ontology

logger = logging.getLogger(__name__)


class PostgreSQLSemanticService:
    """PostgreSQL-based semantic enhancement service"""
    
    def __init__(self):
        self.pg_ontology = get_postgres_ontology()
        self.medical_ontology = MedicalOntology()  # Keep for entity management
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize semantic services"""
        if self._initialized:
            return
        
        logger.info("Initializing PostgreSQL semantic enhancement service...")
        
        # Connect to PostgreSQL
        await self.pg_ontology.connect()
        
        # Get statistics
        stats = await self.pg_ontology.get_statistics()
        logger.info(f"PostgreSQL connected: {stats['icd_count']} ICD codes, {stats['total_cases']} medical cases")
        
        self._initialized = True
        logger.info("PostgreSQL semantic service initialized")
    
    async def enhance_transcription(self, transcription_text: str, 
                                  modality: str = "mammographie") -> Dict[str, Any]:
        """Enhance German medical transcription with semantic annotations"""
        
        await self.initialize()
        
        logger.info(f"Enhancing transcription for {modality}")
        
        # Get ICD suggestions from PostgreSQL
        icd_result = await self.pg_ontology.get_icd_suggestions_for_text(
            transcription_text, 
            modality
        )
        
        # Extract medical findings (using simple pattern matching for now)
        findings = self._extract_findings(transcription_text)
        
        # Calculate quality score
        quality_score = self._calculate_quality_score(transcription_text, len(findings))
        
        result = {
            'original_text': transcription_text,
            'language': 'de',
            'modality': modality,
            'semantic_annotations': [],  # Could add NER results here
            'suggested_icd_codes': icd_result['suggested_icd_codes'],
            'extracted_findings': findings,
            'quality_score': quality_score,
            'confidence': 0.85,
            'enhanced': True
        }
        
        logger.info(f"Enhancement complete: {len(icd_result['suggested_icd_codes'])} ICD codes, {len(findings)} findings")
        
        return result
    
    async def suggest_icd_codes_for_text(self, text: str, 
                                        patient_context: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Suggest ICD codes for medical text"""
        
        await self.initialize()
        
        # Extract modality from patient context if available
        modality = None
        if patient_context and 'modality' in patient_context:
            modality = patient_context['modality']
        
        # Get suggestions from PostgreSQL
        result = await self.pg_ontology.get_icd_suggestions_for_text(text, modality)
        
        return result['suggested_icd_codes']
    
    async def search_similar_cases(self, text: str, 
                                  modality: Optional[str] = None,
                                  limit: int = 10) -> List[Dict[str, Any]]:
        """Search for similar medical cases in the database"""
        
        await self.initialize()
        
        # Extract key terms
        keywords = self.pg_ontology._extract_medical_keywords(text)
        
        # Search cases with most relevant keyword
        if keywords:
            cases = await self.pg_ontology.search_medical_cases(
                text_search=keywords[0],
                exam_type=modality,
                limit=limit
            )
            return cases
        
        return []
    
    async def analyze_report(self, report_text: str) -> Dict[str, Any]:
        """Analyze a medical report"""
        
        await self.initialize()
        
        # Get ICD suggestions
        icd_suggestions = await self.pg_ontology.get_icd_suggestions_for_text(report_text)
        
        # Extract findings
        findings = self._extract_findings(report_text)
        
        # Search similar cases
        similar_cases = await self.search_similar_cases(report_text, limit=5)
        
        return {
            'icd_suggestions': icd_suggestions['suggested_icd_codes'][:5],
            'findings': findings,
            'similar_cases': similar_cases,
            'entities': [],  # Placeholder for NER results
            'relationships': []  # Placeholder for relationship extraction
        }
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics"""
        
        await self.initialize()
        
        stats = await self.pg_ontology.get_statistics()
        
        return {
            'database_stats': stats,
            'ontology_stats': {
                'entities': len(self.medical_ontology.entities),
                'relationships': len(self.medical_ontology.relationships)
            },
            'supported_modalities': ['mammographie', 'sonographie', 'ct', 'mrt', 'röntgen'],
            'language': 'de',
            'backend': 'postgresql'
        }
    
    def _extract_findings(self, text: str) -> List[Dict[str, str]]:
        """Extract medical findings from text"""
        findings = []
        
        # Look for common finding patterns in German
        finding_patterns = {
            'normal': ['unauffällig', 'regelrecht', 'normal', 'ohne befund'],
            'abnormal': ['auffällig', 'suspekt', 'pathologisch', 'verändert'],
            'uncertain': ['unklar', 'fraglich', 'möglich', 'verdacht']
        }
        
        text_lower = text.lower()
        sentences = text.split('.')
        
        for sentence in sentences:
            if len(sentence.strip()) < 10:
                continue
                
            sentence_lower = sentence.lower()
            finding_type = 'unknown'
            
            # Determine finding type
            for ftype, patterns in finding_patterns.items():
                if any(pattern in sentence_lower for pattern in patterns):
                    finding_type = ftype
                    break
            
            findings.append({
                'text': sentence.strip(),
                'type': finding_type
            })
        
        return findings[:10]  # Limit to 10 findings
    
    def _calculate_quality_score(self, text: str, finding_count: int) -> float:
        """Calculate quality score for transcription"""
        score = 0.5  # Base score
        
        # Length bonus
        if len(text) > 100:
            score += 0.2
        if len(text) > 500:
            score += 0.1
        
        # Finding bonus
        if finding_count > 0:
            score += min(0.2, finding_count * 0.05)
        
        return min(1.0, score)
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.pg_ontology:
            await self.pg_ontology.close()


# Global semantic service instance
semantic_service = None

def get_pg_semantic_service():
    """Get singleton PostgreSQL semantic service"""
    global semantic_service
    if semantic_service is None:
        semantic_service = PostgreSQLSemanticService()
    return semantic_service


async def enhance_medical_transcription(text: str, modality: str = "mammographie") -> Dict[str, Any]:
    """Main function for enhancing medical transcription with semantic data"""
    service = get_pg_semantic_service()
    return await service.enhance_transcription(text, modality)


async def generate_semantic_report(text: str, patient_info: Optional[Dict] = None, 
                                 modality: str = "mammographie") -> Dict[str, Any]:
    """Generate structured medical report with semantic enhancement"""
    service = get_pg_semantic_service()
    
    # Enhance transcription
    enhancement = await service.enhance_transcription(text, modality)
    
    # Add patient info if available
    if patient_info:
        enhancement['patient_info'] = patient_info
    
    return enhancement


async def suggest_icd_codes(text: str, patient_context: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """Suggest ICD codes for medical text"""
    service = get_pg_semantic_service()
    return await service.suggest_icd_codes_for_text(text, patient_context)


if __name__ == "__main__":
    # Test PostgreSQL semantic enhancement
    import asyncio
    
    async def test_enhancement():
        test_text = "Mammographie beidseits zeigt unauffällige Befunde. Keine Hinweise auf Malignität. BI-RADS 1."
        
        print("Testing PostgreSQL semantic enhancement...")
        
        enhancement = await enhance_medical_transcription(test_text, "mammographie")
        print("\nEnhancement result:")
        print(f"  ICD suggestions: {len(enhancement['suggested_icd_codes'])}")
        if enhancement['suggested_icd_codes']:
            for icd in enhancement['suggested_icd_codes'][:3]:
                print(f"    - {icd['code']}: {icd['description'][:50]}... (confidence: {icd['confidence']:.2f})")
        print(f"  Findings: {len(enhancement['extracted_findings'])}")
        print(f"  Quality score: {enhancement['quality_score']:.2f}")
        
        # Test ICD suggestions
        icd_suggestions = await suggest_icd_codes(test_text)
        print(f"\nDirect ICD suggestions: {len(icd_suggestions)}")
        
        # Get statistics
        service = get_pg_semantic_service()
        stats = await service.get_statistics()
        print(f"\nDatabase statistics:")
        print(f"  ICD codes: {stats['database_stats']['icd_count']}")
        print(f"  Medical cases: {stats['database_stats']['total_cases']}")
        
        # Cleanup
        await service.cleanup()
    
    asyncio.run(test_enhancement())