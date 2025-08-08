"""
OpenAI GPT-4 integration service for medical report generation
"""

import json
import logging
from typing import Dict, Any, List, Optional
import openai
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.core.exceptions import OpenAIException, ValidationException

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class MedicalPrompts:
    """Medical prompts for different report sections"""
    
    SYSTEM_PROMPT = """
Sie sind ein erfahrener Radiologe und erstellen strukturierte deutsche medizinische Befundberichte. 
Ihre Aufgabe ist es, aus transkribierten Diktatstexten präzise, professionelle medizinische Berichte zu generieren.

Wichtige Richtlinien:
- Verwenden Sie ausschließlich deutsche medizinische Fachterminologie
- Struktur: Klinische Fragestellung, Technische Durchführung, Befund, Beurteilung
- Seien Sie präzise und verwenden Sie standardisierte Formulierungen
- Geben Sie Maße in mm/cm an, wenn verfügbar
- Verwenden Sie die Terminologie der deutschen Radiologie
- Achten Sie auf medizinische Genauigkeit und Vollständigkeit
- Berücksichtigen Sie rechtliche Anforderungen deutscher Befundberichte
"""

    REPORT_GENERATION_PROMPT = """
Erstellen Sie einen strukturierten deutschen radiologischen Befundbericht aus dem folgenden transkribierten Text:

Transkription: "{transcription}"
Untersuchungsart: {examination_type}
Klinische Fragestellung: {clinical_indication}

Strukturieren Sie den Bericht in folgende Abschnitte:

1. BEFUND: 
   - Detaillierte Beschreibung der radiologischen Befunde
   - Anatomische Strukturen systematisch bewerten
   - Maße und Lokalisationen präzise angeben
   - Vergleich mit Normalbefunden wo relevant

2. BEURTEILUNG:
   - Zusammenfassung der wichtigsten Befunde
   - Diagnosevorschläge basierend auf den Befunden
   - Differentialdiagnosen wenn angebracht
   - Empfehlungen für weitere Maßnahmen

3. TECHNISCHE_PARAMETER (wenn im Text erwähnt):
   - Untersuchungsparameter
   - Kontrastmittelanwendung
   - Besondere Techniken

Verwenden Sie ausschließlich deutsche medizinische Fachterminologie und folgen Sie deutschen Befundstandards.
"""

    ICD_SUGGESTION_PROMPT = """
Basierend auf dem folgenden medizinischen Befund, schlagen Sie passende ICD-10-GM Codes vor:

Befund: "{findings}"
Beurteilung: "{assessment}"

Geben Sie eine Liste der relevantesten ICD-10-GM Codes zurück im Format:
[{{"code": "ICD-Code", "description": "Deutsche Beschreibung", "confidence": 0.9}}]

Berücksichtigen Sie:
- Deutsche ICD-10-GM Klassifikation
- Relevanz für radiologische Befunde
- Haupt- und Nebendiagnosen
- Confidence-Score (0.0-1.0)
"""

    QUALITY_CHECK_PROMPT = """
Überprüfen Sie die Qualität des folgenden medizinischen Berichts:

Bericht: "{report_content}"

Bewerten Sie folgende Aspekte (0-100 Punkte):
1. Medizinische Genauigkeit
2. Vollständigkeit der Befundung
3. Verwendung korrekter Fachterminologie
4. Strukturierte Darstellung
5. Rechtliche Anforderungen

Geben Sie das Ergebnis als JSON zurück:
{{"overall_score": 85, "aspects": {{"accuracy": 90, "completeness": 85, "terminology": 88, "structure": 90, "compliance": 80}}, "recommendations": ["Empfehlung 1", "Empfehlung 2"]}}
"""


class OpenAIService:
    """Service for OpenAI GPT-4 integration"""
    
    def __init__(self):
        self.client = client
        self.prompts = MedicalPrompts()
    
    async def generate_medical_report(
        self,
        transcription: str,
        examination_type: str,
        clinical_indication: Optional[str] = None,
        template_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate structured medical report from transcription"""
        
        try:
            # Prepare the prompt
            user_prompt = self.prompts.REPORT_GENERATION_PROMPT.format(
                transcription=transcription,
                examination_type=examination_type,
                clinical_indication=clinical_indication or "Nicht angegeben"
            )
            
            # Add template-specific instructions if available
            if template_config and "ai_prompt_additions" in template_config:
                user_prompt += f"\n\nZusätzliche Anweisungen: {template_config['ai_prompt_additions']}"
            
            logger.info(f"Generating medical report for {examination_type}")
            
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": self.prompts.SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            if not content:
                raise OpenAIException("Empty response from OpenAI")
            
            # Parse the structured response
            structured_content = json.loads(content)
            
            # Validate required sections
            required_sections = ["BEFUND", "BEURTEILUNG"]
            for section in required_sections:
                if section not in structured_content:
                    raise ValidationException(f"Missing required section: {section}")
            
            logger.info("Medical report generated successfully")
            return structured_content
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response: {e}")
            raise OpenAIException("Invalid response format from OpenAI")
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise OpenAIException(f"OpenAI API error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in report generation: {e}")
            raise OpenAIException(f"Report generation failed: {str(e)}")
    
    async def suggest_icd_codes(
        self,
        findings: str,
        assessment: str
    ) -> List[Dict[str, Any]]:
        """Suggest ICD-10-GM codes based on findings and assessment"""
        
        try:
            user_prompt = self.prompts.ICD_SUGGESTION_PROMPT.format(
                findings=findings,
                assessment=assessment
            )
            
            logger.info("Generating ICD code suggestions")
            
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "Sie sind ein medizinischer Kodierspezialist für ICD-10-GM."},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            if not content:
                return []
            
            result = json.loads(content)
            icd_codes = result.get("icd_codes", [])
            
            logger.info(f"Generated {len(icd_codes)} ICD code suggestions")
            return icd_codes
            
        except Exception as e:
            logger.error(f"Error generating ICD codes: {e}")
            return []
    
    async def check_report_quality(
        self,
        report_content: str
    ) -> Dict[str, Any]:
        """Check quality of generated medical report"""
        
        try:
            user_prompt = self.prompts.QUALITY_CHECK_PROMPT.format(
                report_content=report_content
            )
            
            logger.info("Checking report quality")
            
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "Sie sind ein Qualitätsprüfer für medizinische Berichte."},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            if not content:
                raise OpenAIException("Empty quality check response")
            
            quality_result = json.loads(content)
            
            logger.info(f"Quality check completed. Score: {quality_result.get('overall_score', 0)}")
            return quality_result
            
        except Exception as e:
            logger.error(f"Error in quality check: {e}")
            return {
                "overall_score": 0,
                "aspects": {},
                "recommendations": ["Qualitätsprüfung fehlgeschlagen"]
            }
    
    async def enhance_medical_terminology(
        self,
        text: str,
        examination_type: str
    ) -> str:
        """Enhance medical terminology in text"""
        
        try:
            prompt = f"""
Verbessern Sie die medizinische Fachterminologie im folgenden Text für eine {examination_type}-Untersuchung:

Text: "{text}"

Aufgaben:
- Korrigieren Sie medizinische Fachbegriffe
- Standardisieren Sie Terminologie gemäß deutscher Radiologie
- Verbessern Sie Präzision und Klarheit
- Behalten Sie die ursprüngliche Bedeutung bei

Geben Sie nur den verbesserten Text zurück.
"""
            
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "Sie sind ein medizinischer Terminologie-Experte."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.2
            )
            
            enhanced_text = response.choices[0].message.content
            return enhanced_text.strip() if enhanced_text else text
            
        except Exception as e:
            logger.error(f"Error enhancing terminology: {e}")
            return text
    
    async def validate_medical_content(
        self,
        content: str,
        examination_type: str
    ) -> Dict[str, Any]:
        """Validate medical content for accuracy and completeness"""
        
        try:
            prompt = f"""
Validieren Sie den folgenden medizinischen Inhalt für eine {examination_type}-Untersuchung:

Inhalt: "{content}"

Prüfen Sie:
1. Medizinische Genauigkeit
2. Anatomische Korrektheit
3. Verwendung korrekter Fachterminologie
4. Vollständigkeit der Beschreibung
5. Konsistenz der Aussagen

Geben Sie das Ergebnis als JSON zurück:
{{"is_valid": true/false, "confidence": 0.95, "issues": ["Problem 1"], "suggestions": ["Verbesserung 1"]}}
"""
            
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "Sie sind ein medizinischer Validierungsexperte."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            if not content:
                return {"is_valid": False, "confidence": 0.0, "issues": ["Validation failed"], "suggestions": []}
            
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Error validating content: {e}")
            return {
                "is_valid": False,
                "confidence": 0.0,
                "issues": [f"Validation error: {str(e)}"],
                "suggestions": []
            }


# Global instance
openai_service = OpenAIService()