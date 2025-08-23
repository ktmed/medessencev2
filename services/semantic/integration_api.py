"""
Semantic Integration API for MedEssenceAI
Provides semantic enhancement services for medical transcription and report generation
"""

from typing import Dict, List, Optional, Any
import asyncio
import logging
from datetime import datetime

from medical_ontology import MedicalOntology, Patient, MedicalReport, Diagnosis, Finding
from semantic_layer import MedicalSemanticETL, create_semantic_layer_from_excel
from icd_database import ICDDatabase, create_icd_database

logger = logging.getLogger(__name__)


class SemanticEnhancementService:
    """Semantic enhancement service for medical transcription"""
    
    def __init__(self):
        self.icd_database = create_icd_database()
        self.ontology = MedicalOntology()
        self.etl = MedicalSemanticETL()
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize semantic services"""
        if self._initialized:
            return
        
        logger.info("Initializing semantic enhancement service...")
        
        # Skip Excel loading for now - use base ontology
        # excel_path = "/Users/keremtomak/Documents/work/development/REPOS/med-essence/development/experiments/testcode/latestcompleteexplanations3.xlsx"
        # try:
        #     self.ontology = create_semantic_layer_from_excel(excel_path)
        #     logger.info(f"Loaded ontology with {len(self.ontology.entities)} entities")
        # except Exception as e:
        #     logger.warning(f"Could not load Excel data: {str(e)}")
        
        logger.info(f"Using base ontology with {len(self.ontology.entities)} entities")
        self._initialized = True
        logger.info("Semantic enhancement service initialized")
    
    async def enhance_transcription(self, transcription_text: str, 
                                  modality: str = "mammographie") -> Dict[str, Any]:
        """Enhance German medical transcription with semantic annotations"""
        await self.initialize()
        
        logger.info(f"Enhancing transcription for {modality}")
        
        enhancement = {
            'original_text': transcription_text,
            'language': 'de',
            'modality': modality,
            'semantic_annotations': [],
            'suggested_icd_codes': [],
            'extracted_findings': [],
            'quality_score': 0.0,
            'confidence': 0.0
        }
        
        try:
            # Extract medical concepts
            findings = self.etl.medical_nlp.extract_findings(transcription_text)
            enhancement['extracted_findings'] = findings
            
            # Suggest relevant ICD codes
            suggested_codes = self.icd_database.search_by_text(transcription_text, max_results=5)
            enhancement['suggested_icd_codes'] = [
                {
                    'code': entry.icd_code,
                    'description': entry.label,
                    'chapter': entry.chapter_nr,
                    'terminal': entry.is_terminal,
                    'confidence': 0.8  # Base confidence, could be improved with ML
                }
                for entry in suggested_codes
            ]
            
            # Add modality-specific suggestions
            if modality:
                modality_codes = self.icd_database.suggest_codes_for_modality(modality)
                for entry in modality_codes[:3]:  # Top 3 modality-specific codes
                    enhancement['suggested_icd_codes'].append({
                        'code': entry.icd_code,
                        'description': entry.label,
                        'chapter': entry.chapter_nr,
                        'terminal': entry.is_terminal,
                        'confidence': 0.9,  # Higher confidence for modality match
                        'modality_specific': True
                    })
            
            # Calculate quality metrics
            enhancement['quality_score'] = self._calculate_quality_score(transcription_text, findings)
            enhancement['confidence'] = min(enhancement['quality_score'] * 1.2, 1.0)
            
            logger.info(f"Enhancement complete: {len(enhancement['suggested_icd_codes'])} ICD codes, "
                       f"{len(enhancement['extracted_findings'])} findings")
            
        except Exception as e:
            logger.error(f"Error during transcription enhancement: {str(e)}")
            enhancement['error'] = str(e)
        
        return enhancement
    
    async def generate_structured_report(self, transcription_text: str, 
                                       patient_info: Optional[Dict] = None,
                                       modality: str = "mammographie") -> Dict[str, Any]:
        """Generate structured medical report with semantic annotations"""
        await self.initialize()
        
        logger.info("Generating structured report with semantic enhancement")
        
        # First enhance the transcription
        enhancement = await self.enhance_transcription(transcription_text, modality)
        
        # Create structured report sections
        report = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'language': 'de',
                'modality': modality,
                'patient_info': patient_info or {}
            },
            'sections': {
                'anamnese': self._extract_anamnesis(transcription_text),
                'befund': self._extract_findings_section(transcription_text, enhancement['extracted_findings']),
                'beurteilung': self._generate_assessment(enhancement),
                'empfehlung': self._generate_recommendations(enhancement)
            },
            'semantic_data': {
                'icd_codes': enhancement['suggested_icd_codes'],
                'findings': enhancement['extracted_findings'],
                'quality_metrics': {
                    'completeness': enhancement['quality_score'],
                    'confidence': enhancement['confidence']
                }
            }
        }
        
        return report
    
    async def suggest_icd_codes_for_text(self, text: str, 
                                       patient_context: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Suggest ICD codes for German medical text with patient context"""
        await self.initialize()
        
        # Get base suggestions from text
        search_results = self.icd_database.search_by_text(text, max_results=10)
        
        suggestions = []
        for entry in search_results:
            suggestion = {
                'code': entry.icd_code,
                'description': entry.label,
                'chapter': entry.chapter_nr,
                'chapter_name': self.icd_database.chapter_names.get(entry.chapter_nr, ''),
                'terminal': entry.is_terminal,
                'gender_specific': entry.is_gender_specific,
                'confidence': 0.7,  # Base confidence
                'reasoning': f"Textuelle Übereinstimmung mit '{text[:50]}...'"
            }
            
            # Adjust confidence based on patient context
            if patient_context:
                if entry.is_gender_specific and patient_context.get('gender'):
                    if ((entry.gender_specific == 'F' and patient_context['gender'].lower() in ['female', 'weiblich']) or
                        (entry.gender_specific == 'M' and patient_context['gender'].lower() in ['male', 'männlich'])):
                        suggestion['confidence'] += 0.2
                        suggestion['reasoning'] += " + Geschlechtsspezifisch passend"
                
                if entry.has_age_restriction and patient_context.get('age'):
                    age = patient_context['age']
                    if ((entry.age_min is None or age >= entry.age_min) and 
                        (entry.age_max is None or age <= entry.age_max)):
                        suggestion['confidence'] += 0.1
                        suggestion['reasoning'] += " + Altersgerecht"
            
            # Boost terminal codes (billable)
            if entry.is_terminal:
                suggestion['confidence'] += 0.1
                suggestion['reasoning'] += " + Abrechnungsfähig"
            
            suggestions.append(suggestion)
        
        # Sort by confidence
        suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        
        return suggestions[:5]  # Return top 5
    
    def _calculate_quality_score(self, text: str, findings: List[Dict]) -> float:
        """Calculate quality score for medical text"""
        score = 0.0
        
        # Length factor (longer texts generally more complete)
        if len(text) > 100:
            score += 0.3
        if len(text) > 300:
            score += 0.2
        
        # Medical terminology density
        german_medical_count = sum(1 for term in ['befund', 'untersuchung', 'patient', 'diagnose', 
                                                'mammographie', 'sonographie', 'unauffällig', 'auffällig']
                                 if term in text.lower())
        score += min(german_medical_count * 0.1, 0.3)
        
        # Findings extraction success
        if findings:
            score += min(len(findings) * 0.1, 0.2)
        
        return min(score, 1.0)
    
    def _extract_anamnesis(self, text: str) -> str:
        """Extract anamnesis section from German medical text"""
        # Look for history/background information
        anamnesis_indicators = ['anamnese', 'vorgeschichte', 'geschichte', 'symptome', 'beschwerden']
        
        sentences = text.split('.')
        anamnesis_sentences = []
        
        for sentence in sentences:
            sentence = sentence.strip()
            if any(indicator in sentence.lower() for indicator in anamnesis_indicators):
                anamnesis_sentences.append(sentence)
        
        if anamnesis_sentences:
            return '. '.join(anamnesis_sentences) + '.'
        else:
            return "Keine spezifische Anamnese dokumentiert."
    
    def _extract_findings_section(self, text: str, findings: List[Dict]) -> str:
        """Extract and format findings section"""
        if not findings:
            return "Befunde werden analysiert..."
        
        finding_texts = []
        for finding in findings:
            if finding.get('type') == 'normal':
                finding_texts.append(f"• {finding['text']} - unauffällig")
            elif finding.get('type') == 'abnormal':
                severity = finding.get('severity', '')
                if severity:
                    finding_texts.append(f"• {finding['text']} - auffällig ({severity})")
                else:
                    finding_texts.append(f"• {finding['text']} - auffällig")
            else:
                finding_texts.append(f"• {finding['text']}")
        
        return '\n'.join(finding_texts)
    
    def _generate_assessment(self, enhancement: Dict) -> str:
        """Generate assessment based on semantic enhancement"""
        assessment_parts = []
        
        # Analyze findings
        findings = enhancement.get('extracted_findings', [])
        normal_findings = [f for f in findings if f.get('type') == 'normal']
        abnormal_findings = [f for f in findings if f.get('type') == 'abnormal']
        
        if normal_findings and not abnormal_findings:
            assessment_parts.append("Unauffällige Befunde ohne pathologische Veränderungen.")
        elif abnormal_findings:
            assessment_parts.append(f"{len(abnormal_findings)} auffällige Befunde identifiziert.")
            
            # Add ICD context if available
            icd_codes = enhancement.get('suggested_icd_codes', [])
            if icd_codes:
                primary_code = icd_codes[0]
                assessment_parts.append(f"Differentialdiagnostisch kommt {primary_code['description']} ({primary_code['code']}) in Betracht.")
        
        if not assessment_parts:
            assessment_parts.append("Beurteilung basierend auf vorliegenden Befunden.")
        
        return ' '.join(assessment_parts)
    
    def _generate_recommendations(self, enhancement: Dict) -> str:
        """Generate recommendations based on findings"""
        recommendations = []
        
        findings = enhancement.get('extracted_findings', [])
        abnormal_findings = [f for f in findings if f.get('type') == 'abnormal']
        
        if abnormal_findings:
            recommendations.append("Weitere diagnostische Abklärung empfohlen.")
            recommendations.append("Kontrolle in 6-12 Monaten oder bei Symptomverschlechterung.")
        else:
            recommendations.append("Reguläre Nachkontrolle entsprechend Screening-Intervallen.")
        
        # Add ICD-specific recommendations
        icd_codes = enhancement.get('suggested_icd_codes', [])
        if icd_codes:
            primary_code = icd_codes[0]
            if primary_code['chapter'] == 2:  # Neubildungen
                recommendations.append("Interdisziplinäre Tumorboard-Vorstellung bei Bedarf.")
        
        return ' '.join(recommendations)
    
    async def get_semantic_statistics(self) -> Dict[str, Any]:
        """Get semantic system statistics"""
        await self.initialize()
        
        return {
            'ontology_stats': self.ontology.get_statistics(),
            'icd_database_stats': self.icd_database.get_statistics(),
            'supported_modalities': ['mammographie', 'sonographie', 'computertomographie', 'mrt', 'röntgen'],
            'language': 'de',
            'initialization_status': self._initialized
        }


# Global semantic service instance
semantic_service = SemanticEnhancementService()


async def enhance_medical_transcription(text: str, modality: str = "mammographie") -> Dict[str, Any]:
    """Main function for enhancing medical transcription with semantic data"""
    return await semantic_service.enhance_transcription(text, modality)


async def generate_semantic_report(text: str, patient_info: Optional[Dict] = None, 
                                 modality: str = "mammographie") -> Dict[str, Any]:
    """Generate structured medical report with semantic enhancement"""
    return await semantic_service.generate_structured_report(text, patient_info, modality)


async def suggest_icd_codes(text: str, patient_context: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """Suggest ICD codes for medical text"""
    return await semantic_service.suggest_icd_codes_for_text(text, patient_context)


if __name__ == "__main__":
    # Test semantic enhancement
    import asyncio
    
    async def test_enhancement():
        test_text = "Mammographie-Untersuchung der Patientin zeigt unauffällige Befunde beidseits. Keine Hinweise auf Malignität."
        
        enhancement = await enhance_medical_transcription(test_text, "mammographie")
        print("Enhancement result:")
        print(f"  ICD suggestions: {len(enhancement['suggested_icd_codes'])}")
        print(f"  Findings: {len(enhancement['extracted_findings'])}")
        print(f"  Quality score: {enhancement['quality_score']:.2f}")
        
        # Test ICD suggestions
        icd_suggestions = await suggest_icd_codes(test_text)
        print(f"\nICD suggestions: {len(icd_suggestions)}")
        for suggestion in icd_suggestions[:3]:
            print(f"  {suggestion['code']}: {suggestion['description']} (Confidence: {suggestion['confidence']:.2f})")
    
    asyncio.run(test_enhancement())